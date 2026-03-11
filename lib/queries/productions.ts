import { createClient } from "@/lib/supabase/server";

// ── All productions (admin list) ─────────────────────────
export async function getAllProductions() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("productions")
    .select("*")
    .order("performance_date", { ascending: false });

  if (error) {
    console.error("[productions:getAll]", error);
    return [];
  }

  // Get dance + casting counts per production
  const prodIds = (data ?? []).map((p) => p.id);
  if (prodIds.length === 0) return data ?? [];

  const { data: prodDances } = await supabase
    .from("production_dances")
    .select("id, production_id")
    .in("production_id", prodIds);

  const pdIds = (prodDances ?? []).map((pd) => pd.id);

  const { data: castings } = pdIds.length > 0
    ? await supabase.from("casting").select("id, production_dance_id").in("production_dance_id", pdIds)
    : { data: [] };

  const danceCountByProd: Record<string, number> = {};
  const pdToProd: Record<string, string> = {};
  for (const pd of prodDances ?? []) {
    danceCountByProd[pd.production_id] = (danceCountByProd[pd.production_id] ?? 0) + 1;
    pdToProd[pd.id] = pd.production_id;
  }

  const castCountByProd: Record<string, number> = {};
  for (const c of castings ?? []) {
    const prodId = pdToProd[c.production_dance_id];
    if (prodId) castCountByProd[prodId] = (castCountByProd[prodId] ?? 0) + 1;
  }

  // Get approver names
  const approverIds = [...new Set((data ?? []).map((p) => p.approved_by).filter(Boolean))] as string[];
  const approverNames: Record<string, string> = {};
  if (approverIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", approverIds);
    for (const p of profiles ?? []) {
      approverNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  return (data ?? []).map((p) => ({
    ...p,
    danceCount: danceCountByProd[p.id] ?? 0,
    castCount: castCountByProd[p.id] ?? 0,
    approvedByName: p.approved_by ? (approverNames[p.approved_by] ?? null) : null,
  }));
}

// ── Single production ────────────────────────────────────
export async function getProductionById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("productions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[productions:getById]", error);
    return null;
  }

  return data;
}

// ── Dances (global list for assignment) ──────────────────
export async function getAllDances() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("dances")
    .select("*")
    .order("title");

  if (error) {
    console.error("[productions:getAllDances]", error);
    return [];
  }

  // Get choreographer names
  const choreoIds = [...new Set((data ?? []).map((d) => d.choreographer_id).filter(Boolean))] as string[];
  const choreoNames: Record<string, string> = {};
  if (choreoIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", choreoIds);
    for (const p of profiles ?? []) {
      choreoNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  return (data ?? []).map((d) => ({
    ...d,
    choreographerName: d.choreographer_id ? (choreoNames[d.choreographer_id] ?? null) : null,
  }));
}

// ── Production dances (with dance details) ───────────────
export async function getProductionDances(productionId: string) {
  const supabase = await createClient();

  const { data: prodDances, error } = await supabase
    .from("production_dances")
    .select("*")
    .eq("production_id", productionId)
    .order("performance_order");

  if (error) {
    console.error("[productions:getProductionDances]", error);
    return [];
  }

  // Get dance details
  const danceIds = [...new Set((prodDances ?? []).map((pd) => pd.dance_id))];
  const danceMap: Record<string, { title: string; discipline: string; level: string | null; choreographer_id: string | null }> = {};
  if (danceIds.length > 0) {
    const { data: dances } = await supabase
      .from("dances")
      .select("id, title, discipline, level, choreographer_id")
      .in("id", danceIds);
    for (const d of dances ?? []) {
      danceMap[d.id] = d;
    }
  }

  // Get choreographer names
  const choreoIds = [...new Set(Object.values(danceMap).map((d) => d.choreographer_id).filter(Boolean))] as string[];
  const choreoNames: Record<string, string> = {};
  if (choreoIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", choreoIds);
    for (const p of profiles ?? []) {
      choreoNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  return (prodDances ?? []).map((pd) => {
    const dance = danceMap[pd.dance_id];
    return {
      ...pd,
      danceTitle: dance?.title ?? "Unknown",
      discipline: dance?.discipline ?? "",
      level: dance?.level ?? null,
      choreographerName: dance?.choreographer_id ? (choreoNames[dance.choreographer_id] ?? null) : null,
    };
  });
}

// ── Casting for a production (with student names) ────────
export async function getProductionCasting(productionId: string) {
  const supabase = await createClient();

  // Get all production_dances for this production
  const { data: prodDances } = await supabase
    .from("production_dances")
    .select("id")
    .eq("production_id", productionId);

  const pdIds = (prodDances ?? []).map((pd) => pd.id);
  if (pdIds.length === 0) return [];

  const { data: castings, error } = await supabase
    .from("casting")
    .select("*")
    .in("production_dance_id", pdIds);

  if (error) {
    console.error("[productions:getCasting]", error);
    return [];
  }

  // Get student names
  const studentIds = [...new Set((castings ?? []).map((c) => c.student_id))];
  const studentNames: Record<string, { first_name: string; last_name: string; current_level: string | null }> = {};
  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from("students")
      .select("id, first_name, last_name, current_level")
      .in("id", studentIds);
    for (const s of students ?? []) {
      studentNames[s.id] = s;
    }
  }

  return (castings ?? []).map((c) => ({
    ...c,
    studentFirstName: studentNames[c.student_id]?.first_name ?? "",
    studentLastName: studentNames[c.student_id]?.last_name ?? "",
    studentLevel: studentNames[c.student_id]?.current_level ?? null,
  }));
}

// ── Rehearsals for a production ──────────────────────────
export async function getProductionRehearsals(productionId: string) {
  const supabase = await createClient();

  const { data: prodDances } = await supabase
    .from("production_dances")
    .select("id")
    .eq("production_id", productionId);

  const pdIds = (prodDances ?? []).map((pd) => pd.id);
  if (pdIds.length === 0) return [];

  const { data, error } = await supabase
    .from("rehearsals")
    .select("*")
    .in("production_dance_id", pdIds)
    .order("rehearsal_date")
    .order("start_time");

  if (error) {
    console.error("[productions:getRehearsals]", error);
    return [];
  }

  // Get dance names via production_dances
  const { data: pdDetails } = await supabase
    .from("production_dances")
    .select("id, dance_id")
    .in("id", pdIds);

  const danceIds = [...new Set((pdDetails ?? []).map((pd) => pd.dance_id))];
  const danceNames: Record<string, string> = {};
  if (danceIds.length > 0) {
    const { data: dances } = await supabase
      .from("dances")
      .select("id, title")
      .in("id", danceIds);
    for (const d of dances ?? []) {
      danceNames[d.id] = d.title;
    }
  }

  const pdDanceMap: Record<string, string> = {};
  for (const pd of pdDetails ?? []) {
    pdDanceMap[pd.id] = pd.dance_id;
  }

  // Get approver names
  const approverIds = [...new Set((data ?? []).map((r) => r.approved_by).filter(Boolean))] as string[];
  const approverNames: Record<string, string> = {};
  if (approverIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", approverIds);
    for (const p of profiles ?? []) {
      approverNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  return (data ?? []).map((r) => ({
    ...r,
    danceTitle: danceNames[pdDanceMap[r.production_dance_id] ?? ""] ?? null,
    approvedByName: r.approved_by ? (approverNames[r.approved_by] ?? null) : null,
  }));
}

// ── All students (for casting search) ────────────────────
export async function getStudentsForCasting() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, current_level, date_of_birth, active")
    .eq("active", true)
    .order("last_name")
    .order("first_name");

  if (error) {
    console.error("[productions:getStudentsForCasting]", error);
    return [];
  }

  return data ?? [];
}
