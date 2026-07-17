import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dollarsToPriceCents } from "@/lib/billing/resolve-price";

/** Get all active classes with enrollment counts and teacher names */
export async function getClassCatalog(filters?: {
  style?: string;
  dayOfWeek?: number;
  ageMin?: number;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("classes")
    .select(
      `
      *,
      teacher:profiles!teacher_id(first_name, last_name),
      enrollments(id, status)
    `
    )
    .eq("is_active", true)
    .eq("is_hidden", false)
    .eq("is_rehearsal", false)
    .eq("is_performance", false)
    .order("day_of_week")
    .order("start_time");

  if (filters?.style) {
    query = query.eq("style", filters.style);
  }
  if (filters?.dayOfWeek !== undefined) {
    query = query.eq("day_of_week", filters.dayOfWeek);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[enroll:catalog]", error);
    return [];
  }

  // Resolve each class's home studio name (class-level location — spec §6 parent).
  const locationIds = [
    ...new Set((data ?? []).map((c) => c.location_id).filter(Boolean) as string[]),
  ];
  const locationNames: Record<string, string> = {};
  if (locationIds.length > 0) {
    const { data: locs } = await supabase
      .from("studio_locations")
      .select("id, name")
      .in("id", locationIds);
    for (const l of locs ?? []) locationNames[l.id] = l.name;
  }

  // Monthly tuition per class. Source of truth = the base-price row in class_pricing_rules
  // (DOLLARS); legacy fallback = classes.fee_cents (cents). Batched: one query for all catalog
  // classes, via the service-role client because class_pricing_rules RLS is authenticated-only
  // and this catalog is served to anonymous enrollees. Conversion goes through the single
  // dollarsToPriceCents helper.
  const classIds = (data ?? []).map((c) => c.id as string);
  const priceByClass: Record<string, number> = {};
  if (classIds.length > 0) {
    const admin = createAdminClient();
    const { data: rules } = await admin
      .from("class_pricing_rules")
      .select("class_id, amount")
      .in("class_id", classIds)
      .eq("is_base_price", true);
    for (const r of rules ?? []) {
      if (r.amount != null) {
        priceByClass[r.class_id as string] = dollarsToPriceCents(r.amount as number);
      }
    }
  }

  return (data ?? []).map((cls) => {
    const enrollments = cls.enrollments as { id: string; status: string }[];
    const activeCount = enrollments.filter(
      (e) => e.status === "active"
    ).length;
    const waitlistCount = enrollments.filter(
      (e) => e.status === "waitlist"
    ).length;

    const teacherRaw = cls.teacher as unknown;
    const teacher = (
      Array.isArray(teacherRaw) ? teacherRaw[0] : teacherRaw
    ) as { first_name: string; last_name: string } | null;

    return {
      id: cls.id as string,
      name: cls.name as string,
      style: cls.style as string,
      level: cls.level as string,
      description: cls.description as string | null,
      ageMin: cls.age_min as number | null,
      ageMax: cls.age_max as number | null,
      maxStudents: cls.max_students as number,
      dayOfWeek: cls.day_of_week as number,
      startTime: cls.start_time as string,
      endTime: cls.end_time as string,
      room: cls.room as string | null,
      locationId: (cls.location_id as string | null) ?? null,
      locationName: cls.location_id
        ? (locationNames[cls.location_id as string] ?? null)
        : null,
      teacherName: teacher
        ? `${teacher.first_name} ${teacher.last_name}`
        : null,
      activeCount,
      waitlistCount,
      spotsRemaining: Math.max(0, (cls.max_students as number) - activeCount),
      isFull: activeCount >= (cls.max_students as number),
      monthlyTuitionCents:
        priceByClass[cls.id as string] ?? (cls.fee_cents as number | null) ?? null,
      trialEligible: (cls.trial_eligible as boolean | null) ?? false,
    };
  });
}

/** Recommend classes based on quiz answers */
export async function recommendClasses(childAge: number, experience: string, interest: string) {
  const catalog = await getClassCatalog();

  // Filter by age range
  let matches = catalog.filter((cls) => {
    if (cls.ageMin && childAge < cls.ageMin) return false;
    if (cls.ageMax && childAge > cls.ageMax) return false;
    return true;
  });

  // Filter by interest/style if specified
  if (interest && interest !== "not_sure") {
    const styleMap: Record<string, string[]> = {
      ballet: ["ballet", "pre_ballet", "creative_movement"],
      jazz: ["jazz"],
      contemporary: ["contemporary", "lyrical"],
      musical_theatre: ["musical_theatre"],
    };
    const styles = styleMap[interest] ?? [];
    const styleFiltered = matches.filter((cls) => styles.includes(cls.style));
    if (styleFiltered.length > 0) matches = styleFiltered;
  }

  // Sort: prioritize level match based on experience
  const levelPriority: Record<string, string[]> = {
    none: ["petite", "beginner", "open"],
    some: ["beginner", "petite", "open"],
    yes: ["intermediate", "beginner", "advanced", "open"],
  };
  const priorities = levelPriority[experience] ?? ["beginner", "open"];

  matches.sort((a, b) => {
    const aIdx = priorities.indexOf(a.level);
    const bIdx = priorities.indexOf(b.level);
    const aPri = aIdx === -1 ? 99 : aIdx;
    const bPri = bIdx === -1 ? 99 : bIdx;
    return aPri - bPri;
  });

  return matches.slice(0, 3);
}

/** Get a single class by ID with full details */
export async function getClassById(classId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classes")
    .select(
      `
      *,
      teacher:profiles!teacher_id(first_name, last_name, bio:teachers(bio)),
      enrollments(id, status)
    `
    )
    .eq("id", classId)
    .single();

  if (!data) return null;

  const enrollments = (data.enrollments ?? []) as { id: string; status: string }[];
  const activeCount = enrollments.filter((e) => e.status === "active").length;

  return {
    ...data,
    activeCount,
    spotsRemaining: Math.max(0, (data.max_students as number) - activeCount),
    isFull: activeCount >= (data.max_students as number),
  };
}
