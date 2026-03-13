import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  if (!tenant) {
    return NextResponse.json({ articles: [] });
  }

  const { data: articles, error } = await supabase
    .from("knowledge_articles")
    .select("id, title, category, audience, is_active, last_reviewed_at, created_at, updated_at")
    .eq("tenant_id", tenant.id)
    .order("category")
    .order("title");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ articles: articles ?? [] });
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const supabase = await createClient();

  const body = await req.json();
  const { title, content, category, audience, is_active } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json(
      { error: "Title and content are required" },
      { status: 400 }
    );
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const { data: article, error } = await supabase
    .from("knowledge_articles")
    .insert({
      tenant_id: tenant.id,
      title: title.trim(),
      content: content.trim(),
      category: category || "faq",
      audience: audience || ["all"],
      is_active: is_active ?? true,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: article.id }, { status: 201 });
}
