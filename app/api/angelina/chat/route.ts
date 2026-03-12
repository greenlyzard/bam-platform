import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildAngelinaContext } from "@/lib/angelina/context";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/guards";

const RATE_LIMITS: Record<string, number> = {
  public: 20,
  parent: 50,
  teacher: 50,
  admin: 100,
};

// In-memory rate limiter
const rateCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const entry = rateCounts.get(key);
  if (!entry || now > entry.resetAt) {
    rateCounts.set(key, { count: 1, resetAt: now + 3600_000 }); // 1 hour
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateCounts) {
    if (now > entry.resetAt) rateCounts.delete(key);
  }
}, 600_000);

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, "").trim();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Chat is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: {
    message?: string;
    sessionId?: string;
    conversationId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawMessage = body.message;
  if (!rawMessage || typeof rawMessage !== "string" || !rawMessage.trim()) {
    return new Response(
      JSON.stringify({ error: "message is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const message = stripHtml(rawMessage).slice(0, 2000);
  const sessionId = body.sessionId || crypto.randomUUID();

  // Determine role from server-side auth
  const user = await getUser();
  let role: "public" | "parent" | "teacher" | "admin" = "public";
  let userId: string | undefined;
  let tenantId: string | undefined;

  if (user) {
    userId = user.id;
    // Look up tenant_id from profiles or use default
    const supabase = await createClient();
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profileRow) {
      if (
        user.role === "super_admin" ||
        user.role === "admin" ||
        user.role === "front_desk"
      ) {
        role = "admin";
      } else if (user.role === "teacher") {
        role = "teacher";
      } else {
        role = "parent";
      }
    }
  }

  // Get tenant ID
  if (!tenantId) {
    const supabase = await createClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("slug", "bam")
      .single();
    tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;
  }

  // Rate limit
  const rateLimitKey = userId || sessionId;
  const limit = RATE_LIMITS[role] ?? 20;
  if (!checkRateLimit(rateLimitKey, limit)) {
    return new Response(
      JSON.stringify({
        error:
          "I've reached my limit for now. Please contact us directly at dance@bamsocal.com or (949) 229-0846.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build context with live data
  const context = await buildAngelinaContext(role, userId, tenantId);

  // Derek easter egg: "hey gurl" as first message
  let systemPrompt = context.systemPrompt;

  // Load existing conversation
  const supabase = await createClient();
  let existingMessages: Array<{ role: string; content: string }> = [];
  const conversationId = body.conversationId;

  if (conversationId) {
    const { data } = await supabase
      .from("angelina_conversations")
      .select("messages")
      .eq("id", conversationId)
      .single();
    if (data?.messages) {
      existingMessages = data.messages as Array<{
        role: string;
        content: string;
      }>;
    }
  }

  // Derek easter egg: append special prompt if first message is "hey gurl"
  if (
    existingMessages.length === 0 &&
    message.toLowerCase().trim() === "hey gurl"
  ) {
    systemPrompt += `\n\nIMPORTANT: You are speaking with Derek Shaw — the technologist and platform builder who designed and built you. Greet him by name, be warm and a little playful. You can be more casual with Derek than with other users.`;
  }

  // Add user message
  const updatedHistory = [
    ...existingMessages,
    { role: "user" as const, content: message },
  ];

  // Keep last 20 messages for token budget
  const apiMessages = updatedHistory.slice(-20).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Stream response via SSE
  const encoder = new TextEncoder();
  const anthropic = new Anthropic({ apiKey });

  const stream = new ReadableStream({
    async start(controller) {
      let assistantMessage = "";

      try {
        const response = await anthropic.messages.stream({
          model: "claude-sonnet-4-5-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages: apiMessages,
        });

        for await (const event of response) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            assistantMessage += event.delta.text;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: event.delta.text })}\n\n`
              )
            );
          }
          if (event.type === "message_stop") {
            controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          }
        }

        // Get token usage from the stream
        const finalMessage = await response.finalMessage();
        const tokenUsage = {
          input_tokens: finalMessage.usage?.input_tokens ?? 0,
          output_tokens: finalMessage.usage?.output_tokens ?? 0,
        };

        // Save conversation
        const finalHistory = [
          ...updatedHistory,
          { role: "assistant", content: assistantMessage },
        ];

        if (conversationId) {
          await supabase
            .from("angelina_conversations")
            .update({
              messages: finalHistory,
              token_usage: tokenUsage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversationId);
        } else {
          const { data: newConv } = await supabase
            .from("angelina_conversations")
            .insert({
              tenant_id: tenantId,
              user_id: userId || null,
              session_id: sessionId,
              role,
              messages: finalHistory,
              token_usage: tokenUsage,
            })
            .select("id")
            .single();

          if (newConv) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ conversationId: newConv.id })}\n\n`
              )
            );
          }
        }

        controller.close();
      } catch (error) {
        console.error("[angelina/chat] Error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Something went wrong. Please try again." })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
