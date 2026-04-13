import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("slug", "bam").single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  const { data: programs } = await supabase
    .from("studio_programs")
    .select("id, name, description, color_hex, requires_audition, has_contract, sort_order, is_active")
    .eq("tenant_id", tenantId)
    .order("sort_order");

  const programIds = (programs ?? []).map((p) => p.id);
  const { data: eligibles } = programIds.length
    ? await supabase
        .from("program_eligible_levels")
        .select("program_id, level_id")
        .in("program_id", programIds)
    : { data: [] };

  const eligMap: Record<string, string[]> = {};
  for (const e of eligibles ?? []) {
    if (!eligMap[e.program_id]) eligMap[e.program_id] = [];
    eligMap[e.program_id].push(e.level_id);
  }

  return NextResponse.json({
    programs: (programs ?? []).map((p) => ({
      ...p,
      eligible_level_ids: eligMap[p.id] ?? [],
    })),
  });
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
      .from("studio_programs")
      .insert({
        tenant_id: tenantId,
        name: body.name,
        description: body.description || null,
        color_hex: body.color_hex || null,
        requires_audition: body.requires_audition ?? false,
        has_contract: body.has_contract ?? false,
        sort_order: body.sort_order ?? 0,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (body.eligible_level_ids?.length) {
      const rows = (body.eligible_level_ids as string[]).map((lid: string) => ({
        program_id: data.id,
        level_id: lid,
      }));
      await supabase.from("program_eligible_levels").insert(rows);
    }
    return NextResponse.json({ success: true, id: data.id });
  }

  if (action === "update") {
    const { error } = await supabase
      .from("studio_programs")
      .update({
        name: body.name,
        description: body.description || null,
        color_hex: body.color_hex || null,
        requires_audition: body.requires_audition ?? false,
        has_contract: body.has_contract ?? false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Replace eligible levels
    await supabase.from("program_eligible_levels").delete().eq("program_id", body.id);
    if (body.eligible_level_ids?.length) {
      const rows = (body.eligible_level_ids as string[]).map((lid: string) => ({
        program_id: body.id,
        level_id: lid,
      }));
      await supabase.from("program_eligible_levels").insert(rows);
    }
    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const { error } = await supabase.from("studio_programs").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
