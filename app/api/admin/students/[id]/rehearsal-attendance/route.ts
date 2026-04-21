import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await requireAdmin();
  const { id: studentId } = await params;
  const supabase = createAdminClient();

  // rehearsal_attendance → rehearsals (FK) → production_dances (FK) → productions (FK)
  const { data: rows, error } = await supabase
    .from("rehearsal_attendance")
    .select(
      `id, status, notes,
       rehearsals!rehearsal_attendance_rehearsal_id_fkey (
         id, rehearsal_date, start_time, end_time, rehearsal_type,
         production_dances!rehearsals_production_dance_id_fkey (
           production_id,
           productions!production_dances_production_id_fkey (
             id, name, season, performance_date
           )
         )
       )`
    )
    .eq("student_id", studentId);

  if (error) {
    console.error("[student:rehearsal-attendance]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  interface RehearsalEntry {
    date: string;
    start_time: string;
    end_time: string;
    type: string;
    status: string;
    notes: string | null;
  }
  interface Prod {
    id: string;
    name: string;
    season: string | null;
    performance_date: string | null;
    rehearsals: RehearsalEntry[];
  }

  const prodMap = new Map<string, Prod>();

  for (const row of rows ?? []) {
    const reh = Array.isArray(row.rehearsals)
      ? row.rehearsals[0]
      : row.rehearsals;
    if (!reh) continue;
    const pd = Array.isArray((reh as Record<string, unknown>).production_dances)
      ? ((reh as Record<string, unknown>).production_dances as unknown[])[0]
      : (reh as Record<string, unknown>).production_dances;
    if (!pd) continue;
    const prod = Array.isArray((pd as Record<string, unknown>).productions)
      ? ((pd as Record<string, unknown>).productions as unknown[])[0]
      : (pd as Record<string, unknown>).productions;
    if (!prod) continue;
    const p = prod as { id: string; name: string; season: string | null; performance_date: string | null };

    if (!prodMap.has(p.id)) {
      prodMap.set(p.id, {
        id: p.id,
        name: p.name,
        season: p.season,
        performance_date: p.performance_date,
        rehearsals: [],
      });
    }
    const r = reh as { rehearsal_date: string; start_time: string; end_time: string; rehearsal_type: string };
    prodMap.get(p.id)!.rehearsals.push({
      date: r.rehearsal_date,
      start_time: r.start_time,
      end_time: r.end_time,
      type: r.rehearsal_type,
      status: row.status,
      notes: row.notes,
    });
  }

  // Sort rehearsals within each production by date
  const productions = Array.from(prodMap.values()).map((p) => {
    p.rehearsals.sort((a, b) => a.date.localeCompare(b.date));
    const present = p.rehearsals.filter(
      (r) => r.status === "present" || r.status === "late"
    ).length;
    return {
      ...p,
      total: p.rehearsals.length,
      present,
      rate: p.rehearsals.length > 0 ? Math.round((present / p.rehearsals.length) * 100) : 0,
    };
  });

  return NextResponse.json({ productions });
}
