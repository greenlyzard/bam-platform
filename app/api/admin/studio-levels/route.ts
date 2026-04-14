import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
    .select("id, name, description, parent_id, age_min, age_max, sort_order, is_active, color_hex")
    .eq("tenant_id", tenantId!)
    .order("sort_order");

  // Sort hierarchically: parents by sort_order, children grouped under parent
  const all = data ?? [];
  const parents = all.filter((l) => !l.parent_id).sort((a, b) => a.sort_order - b.sort_order);
  const childMap = new Map<string, typeof all>();
  for (const l of all) {
    if (l.parent_id) {
      if (!childMap.has(l.parent_id)) childMap.set(l.parent_id, []);
      childMap.get(l.parent_id)!.push(l);
    }
  }
  for (const children of childMap.values()) {
    children.sort((a, b) => a.sort_order - b.sort_order);
  }

  const sorted: typeof all = [];
  for (const p of parents) {
    sorted.push(p);
    const kids = childMap.get(p.id);
    if (kids) sorted.push(...kids);
  }

  return NextResponse.json({ levels: sorted });
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
        parent_id: body.parent_id || null,
        age_min: body.age_min ?? null,
        age_max: body.age_max ?? null,
        color_hex: body.color_hex || null,
        sort_order: body.sort_order ?? 0,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath("/admin/settings/levels");
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
    revalidatePath("/admin/settings/levels");
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const { error } = await supabase.from("studio_levels").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath("/admin/settings/levels");
    return NextResponse.json({ success: true });
  }

  if (action === "reorder") {
    const ids = body.ids as string[];
    for (let i = 0; i < ids.length; i++) {
      await supabase.from("studio_levels").update({ sort_order: i }).eq("id", ids[i]);
    }
    revalidatePath("/admin/settings/levels");
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
