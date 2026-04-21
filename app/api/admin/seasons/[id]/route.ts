import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const supabase = createAdminClient();

  // Handle "set active" — deactivate all others first
  if (body.set_active === true) {
    const { data: season } = await supabase
      .from("seasons")
      .select("tenant_id")
      .eq("id", id)
      .single();
    if (!season) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await supabase
      .from("seasons")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("tenant_id", season.tenant_id)
      .eq("is_active", true);

    await supabase
      .from("seasons")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", id);

    revalidatePath("/admin/settings/seasons");
    return NextResponse.json({ success: true });
  }

  // General update
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of [
    "name", "start_date", "end_date", "period", "year",
    "is_public", "is_ongoing", "registration_open", "display_priority",
  ]) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await supabase
    .from("seasons")
    .update(updates)
    .eq("id", id)
    .select("id, name, start_date, end_date, period, year, is_active, is_public, is_ongoing, registration_open, display_priority")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/admin/settings/seasons");
  return NextResponse.json({ success: true, season: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const supabase = createAdminClient();

  // Soft delete: deactivate, don't actually remove
  const { error } = await supabase
    .from("seasons")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  revalidatePath("/admin/settings/seasons");
  return NextResponse.json({ success: true });
}
