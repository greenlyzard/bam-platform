import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { isTeacherOnly } from "@/lib/auth/role-check";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireAuth();
  const supabase = await createClient();

  if (!["super_admin", "admin", "teacher"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Teacher-only users cannot access email threads
  if (isTeacherOnly(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch thread
  const { data: thread, error: threadError } = await supabase
    .from("communication_threads")
    .select("*")
    .eq("id", id)
    .single();

  if (threadError || !thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Teacher scope check
  if (user.role === "teacher" && thread.assigned_to !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch messages
  const { data: messages } = await supabase
    .from("communication_messages")
    .select("*")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });

  // Mark as read for this user
  await supabase.from("communication_thread_reads").upsert(
    {
      thread_id: id,
      user_id: user.id,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "thread_id,user_id" }
  );

  return NextResponse.json({
    thread,
    messages: messages ?? [],
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireAuth();
  const supabase = await createClient();

  if (!["super_admin", "admin"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (body.state && ["open", "resolved", "archived", "spam"].includes(body.state)) {
    updates.state = body.state;
  }
  if (body.priority && ["normal", "flagged", "urgent"].includes(body.priority)) {
    updates.priority = body.priority;
  }
  if (body.assigned_to !== undefined) {
    updates.assigned_to = body.assigned_to;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 });
  }

  const { data: thread, error } = await supabase
    .from("communication_threads")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ thread });
}
