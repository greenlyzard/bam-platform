import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data: article, error } = await supabase
    .from("knowledge_articles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !article) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  return NextResponse.json({ article });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.content !== undefined) updates.content = body.content.trim();
  if (body.category !== undefined) updates.category = body.category;
  if (body.audience !== undefined) updates.audience = body.audience;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.last_reviewed_at !== undefined)
    updates.last_reviewed_at = body.last_reviewed_at;

  const { error } = await supabase
    .from("knowledge_articles")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("knowledge_articles")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
