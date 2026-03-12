import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let body: {
    conversationId?: string;
    messageIndex?: number;
    rating?: "helpful" | "not_helpful";
    comment?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { conversationId, messageIndex, rating } = body;

  if (!conversationId || messageIndex === undefined || !rating) {
    return NextResponse.json(
      { error: "conversationId, messageIndex, and rating are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Get tenant_id from conversation
  const { data: conv } = await supabase
    .from("angelina_conversations")
    .select("tenant_id")
    .eq("id", conversationId)
    .single();

  if (!conv) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 }
    );
  }

  const { error } = await supabase.from("angelina_feedback").insert({
    tenant_id: conv.tenant_id,
    conversation_id: conversationId,
    message_index: messageIndex,
    rating,
    comment: body.comment || null,
  });

  if (error) {
    console.error("[angelina/feedback] Insert error:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
