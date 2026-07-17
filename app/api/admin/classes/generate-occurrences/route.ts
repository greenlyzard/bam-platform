import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { regenerateClassOccurrences } from "@/lib/schedule/generate";

/**
 * POST { classId } — regenerate a class's schedule occurrences (task 19). Called best-effort from
 * the admin class save flow; the drawer does not block or fail the save on this.
 */
export async function POST(req: Request) {
  await requireAdmin();

  const body = await req.json().catch(() => ({}));
  const classId = body?.classId;
  if (!classId || typeof classId !== "string") {
    return NextResponse.json({ error: "classId required" }, { status: 400 });
  }

  try {
    const result = await regenerateClassOccurrences(classId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/admin/classes/generate-occurrences]", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
