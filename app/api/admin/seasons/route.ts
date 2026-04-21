import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("slug", "bam").single();
  const tenantId = tenant?.id ?? process.env.DEFAULT_TENANT_ID!;

  const { data } = await supabase
    .from("seasons")
    .select("id, name, start_date, end_date, period, year, is_active, is_public, is_ongoing, registration_open, display_priority")
    .eq("tenant_id", tenantId)
    .order("start_date", { ascending: false });

  return NextResponse.json({ seasons: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  const body = await req.json().catch(() => ({}));
  const supabase = createAdminClient();
  const { data: tenant } = await supabase
    .from("tenants").select("id").eq("slug", "bam").single();
  const tenantId = tenant?.id ?? user.tenantId ?? process.env.DEFAULT_TENANT_ID!;

  const name = (body.name ?? "").trim();
  if (!name || !body.start_date || !body.end_date) {
    return NextResponse.json({ error: "Name, start_date, end_date required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("seasons")
    .insert({
      tenant_id: tenantId,
      name,
      start_date: body.start_date,
      end_date: body.end_date,
      period: body.period || null,
      year: body.year ?? null,
      is_active: false,
      is_public: body.is_public ?? false,
      is_ongoing: body.is_ongoing ?? false,
      registration_open: body.registration_open ?? false,
      display_priority: body.display_priority ?? 0,
    })
    .select("id, name, start_date, end_date, period, year, is_active, is_public, is_ongoing, registration_open, display_priority")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/admin/settings/seasons");
  return NextResponse.json({ success: true, season: data });
}
