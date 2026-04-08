import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Convert a lead to a student record.
 * Creates a family record (if no family_id on the lead) and a students record.
 * Updates the lead with returning_student_id pointer.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const supabase = createAdminClient();

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, first_name, last_name, email, phone, family_id, intake_form_data, tenant_id")
    .eq("id", id)
    .single();

  if (leadErr || !lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const tenantId = (lead.tenant_id as string | null) ?? user.tenantId!;

  // Determine student name — body overrides lead defaults
  const intake = (lead.intake_form_data as Record<string, unknown> | null) ?? {};
  const childFirstName =
    body?.first_name ||
    (intake.child_first_name as string | undefined) ||
    (intake.child_name && String(intake.child_name).split(" ")[0]) ||
    lead.first_name ||
    "Student";
  const childLastName =
    body?.last_name ||
    (intake.child_last_name as string | undefined) ||
    lead.last_name ||
    "";
  const dateOfBirth = body?.date_of_birth || (intake.date_of_birth as string | undefined) || null;

  if (!dateOfBirth) {
    return NextResponse.json(
      { error: "date_of_birth is required to create a student" },
      { status: 400 }
    );
  }

  // Create or reuse family
  let familyId: string | null = lead.family_id;
  if (!familyId) {
    const familyName = `${childLastName || childFirstName} Family`;
    const { data: family, error: familyErr } = await supabase
      .from("families")
      .insert({
        tenant_id: tenantId,
        family_name: familyName,
        billing_email: lead.email,
        billing_phone: lead.phone,
      })
      .select("id")
      .single();
    if (familyErr || !family) {
      console.error("[lead:convert] family insert failed:", familyErr);
      return NextResponse.json(
        { error: familyErr?.message ?? "Failed to create family" },
        { status: 500 }
      );
    }
    familyId = family.id;
  }

  // Create student
  const { data: student, error: studentErr } = await supabase
    .from("students")
    .insert({
      first_name: childFirstName,
      last_name: childLastName,
      date_of_birth: dateOfBirth,
      family_id: familyId,
      parent_id: user.id,
      tenant_id: tenantId,
      active: true,
    })
    .select("id")
    .single();

  if (studentErr || !student) {
    console.error("[lead:convert] student insert failed:", studentErr);
    return NextResponse.json(
      { error: studentErr?.message ?? "Failed to create student" },
      { status: 500 }
    );
  }

  // Link the lead to the new student
  await supabase
    .from("leads")
    .update({
      returning_student_id: student.id,
      family_id: familyId,
      pipeline_stage: "enrolled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ success: true, student_id: student.id, family_id: familyId });
}
