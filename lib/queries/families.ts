import { createClient } from "@/lib/supabase/server";

/**
 * Fetch all families with student counts and primary contact info.
 */
export async function getFamilies(search?: string) {
  const supabase = await createClient();

  let query = supabase
    .from("families")
    .select(
      `
      id,
      family_name,
      billing_email,
      billing_phone,
      account_credit,
      primary_contact_id,
      created_at,
      profiles:primary_contact_id (first_name, last_name, email)
    `
    )
    .order("family_name");

  if (search) {
    query = query.or(
      `family_name.ilike.%${search}%,billing_email.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error("[families:getFamilies]", error);
    return [];
  }

  // Get student counts per family
  const familyIds = (data ?? []).map((f) => f.id);
  if (familyIds.length === 0) return data ?? [];

  const { data: studentCounts } = await supabase
    .from("students")
    .select("family_id")
    .in("family_id", familyIds);

  const countMap: Record<string, number> = {};
  for (const s of studentCounts ?? []) {
    if (s.family_id) {
      countMap[s.family_id] = (countMap[s.family_id] ?? 0) + 1;
    }
  }

  return (data ?? []).map((f) => ({
    ...f,
    student_count: countMap[f.id] ?? 0,
  }));
}

/**
 * Fetch a single family by ID.
 */
export async function getFamilyById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("families")
    .select(
      `
      *,
      profiles:primary_contact_id (id, first_name, last_name, email, phone)
    `
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("[families:getFamilyById]", error);
    return null;
  }

  return data;
}

/**
 * Fetch all students belonging to a family.
 */
export async function getFamilyStudents(familyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("family_id", familyId)
    .order("first_name");

  if (error) {
    console.error("[families:getFamilyStudents]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch all contacts for a family.
 */
export async function getFamilyContacts(familyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("family_contacts")
    .select("*")
    .eq("family_id", familyId)
    .order("is_primary", { ascending: false })
    .order("first_name");

  if (error) {
    console.error("[families:getFamilyContacts]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch enrollments for all students in a family, with class details.
 */
export async function getFamilyEnrollments(familyId: string) {
  const supabase = await createClient();

  // Get student IDs for this family
  const { data: students } = await supabase
    .from("students")
    .select("id")
    .eq("family_id", familyId);

  if (!students?.length) return [];

  const studentIds = students.map((s) => s.id);

  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      enrollment_type,
      enrolled_at,
      student_id,
      class_id,
      billing_override,
      override_amount,
      students (id, first_name, last_name),
      classes (id, name, simple_name, day_of_week, start_time, end_time, room)
    `
    )
    .in("student_id", studentIds)
    .order("enrolled_at", { ascending: false });

  if (error) {
    console.error("[families:getFamilyEnrollments]", error);
    return [];
  }

  return data ?? [];
}

/**
 * Search families for enrollment modal (lightweight).
 */
export async function searchFamiliesForEnrollment(query: string) {
  const supabase = await createClient();

  const { data: families, error } = await supabase
    .from("families")
    .select("id, family_name")
    .ilike("family_name", `%${query}%`)
    .order("family_name")
    .limit(10);

  if (error || !families) return [];

  const familyIds = families.map((f) => f.id);
  if (familyIds.length === 0) return [];

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, family_id, date_of_birth, trial_used")
    .in("family_id", familyIds)
    .eq("active", true)
    .order("first_name");

  return families.map((f) => ({
    ...f,
    students: (students ?? []).filter((s) => s.family_id === f.id),
  }));
}

/**
 * Get enrollments for a specific class (admin view).
 */
export async function getClassEnrollments(classId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `
      id,
      status,
      enrollment_type,
      enrolled_at,
      student_id,
      family_id,
      billing_override,
      override_amount,
      students (id, first_name, last_name, date_of_birth, family_id),
      families:family_id (id, family_name)
    `
    )
    .eq("class_id", classId)
    .in("status", ["active", "trial", "waitlist", "pending_payment"])
    .order("enrolled_at", { ascending: true });

  if (error) {
    console.error("[families:getClassEnrollments]", error);
    return [];
  }

  return data ?? [];
}
