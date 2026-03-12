import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  let body: {
    conversationId?: string;
    name?: string;
    email?: string;
    childAge?: number;
    childName?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { conversationId, name, email, childAge, childName } = body;

  if (!conversationId || !email) {
    return NextResponse.json(
      { error: "conversationId and email are required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Update the conversation with lead data
  const { error } = await supabase
    .from("angelina_conversations")
    .update({
      lead_name: name || null,
      lead_email: email,
      lead_child_age: childAge || null,
      lead_child_name: childName || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) {
    console.error("[angelina/lead] Update error:", error);
    return NextResponse.json(
      { error: "Failed to save lead" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
