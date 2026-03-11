import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/guards";
import type { AuthUser } from "@/lib/auth/guards";
import {
  getPublicPrompt,
  getStaffPrompt,
  getPortalPrompt,
  getTeacherPrompt,
} from "@/lib/ai/prompts";
import {
  getRehearsalsTool,
  executeGetRehearsals,
} from "@/lib/ai/tools/get-rehearsals";
import { createClient } from "@/lib/supabase/server";

// Simple in-memory rate limiter: max 20 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 300_000);

const MAX_TOOL_ITERATIONS = 3;

/**
 * Build system prompt and tools array based on user role.
 */
async function buildPromptAndTools(user: AuthUser | null): Promise<{
  systemPrompt: string;
  tools: object[] | undefined;
}> {
  const today = new Date().toISOString().split("T")[0];

  if (!user) {
    return { systemPrompt: getPublicPrompt(), tools: undefined };
  }

  switch (user.role) {
    case "super_admin":
    case "admin":
    case "front_desk":
      return {
        systemPrompt: getStaffPrompt(user, today),
        tools: [getRehearsalsTool],
      };

    case "parent":
    case "student": {
      // Fetch child names for the parent prompt
      const supabase = await createClient();
      const { data: children } = await supabase
        .from("students")
        .select("first_name, last_name")
        .eq("parent_id", user.id);

      const childNames = (children ?? []).map(
        (c) => `${c.first_name} ${c.last_name}`
      );

      return {
        systemPrompt: getPortalPrompt(user, childNames, today),
        tools: [getRehearsalsTool],
      };
    }

    case "teacher":
      return {
        systemPrompt: getTeacherPrompt(user, today),
        tools: [getRehearsalsTool],
      };

    default:
      return { systemPrompt: getPublicPrompt(), tools: undefined };
  }
}

/**
 * Call Anthropic Messages API.
 */
async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  messages: unknown[],
  tools?: object[]
) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
      ...(tools ? { tools } : {}),
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new AnthropicError(
      data.error?.message ?? "Chat request failed",
      response.status
    );
  }
  return data;
}

class AnthropicError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chat is not configured" },
      { status: 500 }
    );
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: "messages array is required" },
      { status: 400 }
    );
  }

  try {
    // Detect auth and build prompt/tools
    const user = await getUser();
    const { systemPrompt, tools } = await buildPromptAndTools(user);

    // Working copy of messages for the tool-calling loop
    const messages = [...body.messages];

    // Tool-calling loop
    for (let i = 0; i <= MAX_TOOL_ITERATIONS; i++) {
      const data = await callAnthropic(apiKey, systemPrompt, messages, tools);

      // If no tool use requested, return the final response
      if (data.stop_reason !== "tool_use") {
        return NextResponse.json(data);
      }

      // No tools available (shouldn't happen, but safety check)
      if (!user || !tools) {
        return NextResponse.json(data);
      }

      // Extract tool use blocks
      const toolUseBlocks = (data.content ?? []).filter(
        (block: { type: string }) => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        return NextResponse.json(data);
      }

      // Append assistant message with all content blocks
      messages.push({ role: "assistant", content: data.content });

      // Execute each tool and collect results
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        let result: string;
        if (toolUse.name === "get_rehearsals") {
          result = await executeGetRehearsals(toolUse.input, user);
        } else {
          result = `Unknown tool: ${toolUse.name}`;
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Append tool results
      messages.push({ role: "user", content: toolResults });
    }

    // If we exhausted iterations, make one final call without tools
    const finalData = await callAnthropic(
      apiKey,
      systemPrompt,
      messages,
      undefined
    );
    return NextResponse.json(finalData);
  } catch (err) {
    if (err instanceof AnthropicError) {
      console.error("[api/chat] Anthropic error:", err.message);
      return NextResponse.json(
        { error: err.message },
        { status: err.status }
      );
    }
    console.error("[api/chat] Request failed:", err);
    return NextResponse.json(
      { error: "Failed to reach chat service" },
      { status: 502 }
    );
  }
}
