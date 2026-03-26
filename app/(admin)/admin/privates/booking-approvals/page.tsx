import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { BookingApprovalsClient } from "./booking-approvals-client";

export default async function BookingApprovalsPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  // 1. Fetch all booking approvals for the tenant
  const { data: approvalRows } = await supabase
    .from("teacher_booking_approvals")
    .select("*")
    .eq("tenant_id", user.tenantId)
    .order("approved_at", { ascending: false });

  const approvals = approvalRows ?? [];

  // 2. Resolve teacher names via profiles
  const teacherIds = [
    ...new Set(approvals.map((a) => a.teacher_id).filter(Boolean) as string[]),
  ];

  const teacherMap: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: teacherRows } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);

    for (const t of teacherRows ?? []) {
      teacherMap[t.id] =
        [t.first_name, t.last_name].filter(Boolean).join(" ") || "Unknown";
    }
  }

  // 3. Resolve family names
  const familyIds = [
    ...new Set(approvals.map((a) => a.family_id).filter(Boolean) as string[]),
  ];

  const familyMap: Record<string, string> = {};
  if (familyIds.length > 0) {
    const { data: familyRows } = await supabase
      .from("families")
      .select("id, family_name")
      .in("id", familyIds);

    for (const f of familyRows ?? []) {
      familyMap[f.id] = f.family_name || "Unknown";
    }
  }

  // 4. Resolve student names for all referenced student_ids
  const allStudentIds = [
    ...new Set(approvals.flatMap((a) => a.student_ids ?? [])),
  ];

  const studentMap: Record<string, string> = {};
  if (allStudentIds.length > 0) {
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, first_name, last_name")
      .in("id", allStudentIds);

    for (const s of studentRows ?? []) {
      studentMap[s.id] =
        [s.first_name, s.last_name].filter(Boolean).join(" ") || "Unknown";
    }
  }

  // 5. Resolve approved_by names
  const approverIds = [
    ...new Set(
      approvals.map((a) => a.approved_by).filter(Boolean) as string[]
    ),
  ];

  const approverMap: Record<string, string> = {};
  if (approverIds.length > 0) {
    const { data: approverRows } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", approverIds);

    for (const a of approverRows ?? []) {
      approverMap[a.id] =
        [a.first_name, a.last_name].filter(Boolean).join(" ") || "Unknown";
    }
  }

  // 6. Fetch teacher list for form dropdown
  const { data: teacherProfileRows } = await supabase
    .from("teacher_profiles")
    .select("id, first_name, last_name")
    .eq("is_active", true)
    .order("first_name");

  const teachers = (teacherProfileRows ?? []).map((tp) => ({
    id: tp.id,
    name:
      [tp.first_name, tp.last_name].filter(Boolean).join(" ") || "Unknown",
  }));

  // 7. Fetch family list for form dropdown
  const { data: familyListRows } = await supabase
    .from("families")
    .select("id, family_name")
    .eq("tenant_id", user.tenantId)
    .order("family_name");

  const families = (familyListRows ?? []).map((f) => ({
    id: f.id,
    name: f.family_name || "Unknown",
  }));

  return (
    <BookingApprovalsClient
      approvals={approvals}
      teacherMap={teacherMap}
      familyMap={familyMap}
      studentMap={studentMap}
      approverMap={approverMap}
      teachers={teachers}
      families={families}
    />
  );
}
