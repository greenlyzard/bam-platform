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

  const { data: teacher } = await supabase
    .from("teachers")
    .select("*")
    .eq("id", id)
    .single();

  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, phone, avatar_url, preferred_name")
    .eq("id", id)
    .single();

  return NextResponse.json({
    teacher: {
      ...teacher,
      first_name: profile?.first_name ?? null,
      last_name: profile?.last_name ?? null,
      preferred_name: profile?.preferred_name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      avatar_url: profile?.avatar_url ?? null,
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();

  // Update profiles table
  const profileUpdates: Record<string, unknown> = {};
  if (body.first_name !== undefined) profileUpdates.first_name = body.first_name;
  if (body.last_name !== undefined) profileUpdates.last_name = body.last_name;
  if (body.preferred_name !== undefined) profileUpdates.preferred_name = body.preferred_name;
  if (body.email !== undefined) profileUpdates.email = body.email;
  if (body.phone !== undefined) profileUpdates.phone = body.phone;

  if (Object.keys(profileUpdates).length > 0) {
    await supabase.from("profiles").update(profileUpdates).eq("id", id);
  }

  // Update teachers table
  const teacherUpdates: Record<string, unknown> = {};
  if (body.bio !== undefined) teacherUpdates.bio = body.bio;
  if (body.employment_type !== undefined) teacherUpdates.employment_type = body.employment_type;
  if (body.class_rate_cents !== undefined) teacherUpdates.class_rate_cents = body.class_rate_cents;
  if (body.private_rate_cents !== undefined) teacherUpdates.private_rate_cents = body.private_rate_cents;
  if (body.rehearsal_rate_cents !== undefined) teacherUpdates.rehearsal_rate_cents = body.rehearsal_rate_cents;
  if (body.admin_rate_cents !== undefined) teacherUpdates.admin_rate_cents = body.admin_rate_cents;
  if (body.is_mandated_reporter_certified !== undefined)
    teacherUpdates.is_mandated_reporter_certified = body.is_mandated_reporter_certified;
  if (body.mandated_reporter_cert_date !== undefined)
    teacherUpdates.mandated_reporter_cert_date = body.mandated_reporter_cert_date;
  if (body.background_check_complete !== undefined)
    teacherUpdates.background_check_complete = body.background_check_complete;
  if (body.background_check_expires_at !== undefined)
    teacherUpdates.background_check_expires_at = body.background_check_expires_at;
  if (body.w9_on_file !== undefined) teacherUpdates.w9_on_file = body.w9_on_file;
  if (body.can_be_scheduled !== undefined) teacherUpdates.can_be_scheduled = body.can_be_scheduled;
  if (body.internal_notes !== undefined) teacherUpdates.internal_notes = body.internal_notes;

  if (Object.keys(teacherUpdates).length > 0) {
    const { error } = await supabase
      .from("teachers")
      .update(teacherUpdates)
      .eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
