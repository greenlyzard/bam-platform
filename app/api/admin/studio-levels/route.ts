import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID;

  const { data } = await supabase
    .from("studio_levels")
    .select("id, name, description, age_min, age_max, sort_order, is_active, color_hex")
    .eq("tenant_id", tenantId!)
    .order("sort_order");

  return NextResponse.json({ levels: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));

  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("slug", "bam").single();
  const tenantId = tenant?.id ?? user.tenantId ?? process.env.DEFAULT_TENANT_ID!;

  const action = body.action as string;

  if (action === "create") {
    const { data, error } = await supabase
      .from("studio_levels")
      .insert({
        tenant_id: tenantId,
        name: body.name,
        description: body.description || null,
        age_min: body.age_min ?? null,
        age_max: body.age_max ?? null,
        color_hex: body.color_hex || null,
        sort_order: body.sort_order ?? 0,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data.id });
  }

  if (action === "update") {
    const { error } = await supabase
      .from("studio_levels")
      .update({
        name: body.name,
        description: body.description || null,
        age_min: body.age_min ?? null,
        age_max: body.age_max ?? null,
        color_hex: body.color_hex || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const { error } = await supabase.from("studio_levels").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === "reorder") {
    const ids = body.ids as string[];
    for (let i = 0; i < ids.length; i++) {
      await supabase.from("studio_levels").update({ sort_order: i }).eq("id", ids[i]);
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
