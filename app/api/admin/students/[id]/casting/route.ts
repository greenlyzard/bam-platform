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

  // casting → production_dances (FK exists) → productions (FK exists)
  const { data: rows, error } = await supabase
    .from("casting")
    .select(
      `id, role, is_alternate, costume_notes, notes, created_at,
       production_dances!casting_production_dance_id_fkey (
         id, music_title, music_artist, production_id,
         productions!production_dances_production_id_fkey (
           id, name, production_type, season, performance_date
         )
       )`
    )
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[student:casting]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by production
  interface Role {
    id: string;
    role: string;
    is_alternate: boolean;
    music_title: string | null;
    costume_notes: string | null;
    notes: string | null;
  }
  interface Prod {
    id: string;
    name: string;
    production_type: string;
    season: string | null;
    performance_date: string | null;
    roles: Role[];
  }

  const prodMap = new Map<string, Prod>();

  for (const row of rows ?? []) {
    const pd = Array.isArray(row.production_dances)
      ? row.production_dances[0]
      : row.production_dances;
    if (!pd) continue;
    const prod = Array.isArray(pd.productions)
      ? pd.productions[0]
      : pd.productions;
    if (!prod) continue;

    if (!prodMap.has(prod.id)) {
      prodMap.set(prod.id, {
        id: prod.id,
        name: prod.name,
        production_type: prod.production_type,
        season: prod.season,
        performance_date: prod.performance_date,
        roles: [],
      });
    }
    prodMap.get(prod.id)!.roles.push({
      id: row.id,
      role: row.role,
      is_alternate: row.is_alternate,
      music_title: (pd as Record<string, unknown>).music_title as string | null,
      costume_notes: row.costume_notes,
      notes: row.notes,
    });
  }

  const productions = Array.from(prodMap.values());

  return NextResponse.json({ productions });
}
