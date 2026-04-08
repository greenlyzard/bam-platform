"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Season { id: string; name: string }
interface Student {
  id: string;
  first_name: string;
  last_name: string;
  current_level: string | null;
  date_of_birth: string;
}
interface ClassRow {
  id: string;
  name: string;
  levels: string[] | null;
  max_enrollment: number | null;
  enrolled_count: number;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
}
interface Placement {
  id: string;
  student_id: string;
  class_id: string;
  status: string;
  placement_notes: string | null;
}
interface Bundle {
  id: string;
  name: string;
  trigger_type: string;
  trigger_value: number | null;
  discount_type: string;
  discount_value: number | null;
}

const UNPLACED_KEY = "Unplaced";

function calculateAge(dob: string): number {
  const d = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export function PlacementBoard({
  seasons,
  seasonId,
  students,
  classes,
  placements: initialPlacements,
  bundles,
}: {
  seasons: Season[];
  seasonId: string | null;
  students: Student[];
  classes: ClassRow[];
  placements: Placement[];
  bundles: Bundle[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [placements, setPlacements] = useState<Placement[]>(initialPlacements);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Group students by current_level
  const grouped = useMemo(() => {
    const map = new Map<string, Student[]>();
    for (const s of students) {
      const key = s.current_level && s.current_level.trim() !== "" ? s.current_level : UNPLACED_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === UNPLACED_KEY) return 1;
      if (b === UNPLACED_KEY) return -1;
      return a.localeCompare(b);
    });
  }, [students]);

  function placementsForStudent(studentId: string): Placement[] {
    return placements.filter((p) => p.student_id === studentId);
  }

  // Bundle upsell check: count of placements per student
  function bundleAlert(studentId: string): string | null {
    const count = placementsForStudent(studentId).length;
    const next = bundles.find(
      (b) => b.trigger_type === "class_count" && Number(b.trigger_value) === count + 1
    );
    if (next && next.discount_value != null) {
      return `Add 1 more class → ${next.name} ($${next.discount_value} off)`;
    }
    return null;
  }

  async function addPlacement(studentId: string, classId: string) {
    if (!seasonId) {
      setToast("Select a season first");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id: seasonId, student_id: studentId, class_id: classId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast(data.error ?? "Failed to add placement");
      } else {
        setPlacements((prev) => [...prev, data.placement]);
        setToast("Placement staged");
      }
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function removePlacement(placementId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/placements/${placementId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setToast(data.error ?? "Failed to remove");
      } else {
        setPlacements((prev) => prev.filter((p) => p.id !== placementId));
      }
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 2500);
    }
  }

  async function stageAll() {
    if (!seasonId) return;
    if (!confirm("Mark all placements for this season as staged?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/placements/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id: seasonId, action: "stage" }),
      });
      const data = await res.json();
      setToast(data.message ?? (res.ok ? "Staged" : "Failed"));
      if (res.ok) startTransition(() => router.refresh());
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function releaseAll() {
    if (!seasonId) return;
    if (!confirm("Release all staged placements? Families will be notified.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/placements/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id: seasonId, action: "release" }),
      });
      const data = await res.json();
      setToast(data.message ?? (res.ok ? "Released" : "Failed"));
      if (res.ok) startTransition(() => router.refresh());
    } finally {
      setBusy(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  function changeSeason(id: string) {
    router.push(`/admin/enrollment/placement?season=${id}`);
  }

  const totalPlaced = new Set(placements.map((p) => p.student_id)).size;
  const totalAwaiting = students.length - totalPlaced;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-charcoal text-white px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-charcoal">Pre-Placement</h1>
          <p className="mt-1 text-sm text-slate">
            {totalPlaced} placed · {totalAwaiting} awaiting · {students.length} total students
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={seasonId ?? ""}
            onChange={(e) => changeSeason(e.target.value)}
            className="h-9 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal"
          >
            {seasons.length === 0 && <option value="">No seasons</option>}
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            disabled={busy || !seasonId}
            onClick={stageAll}
            className="h-9 rounded-lg border border-silver bg-white px-4 text-sm font-medium text-slate hover:bg-cloud disabled:opacity-50"
          >
            Stage All
          </button>
          <button
            disabled={busy || !seasonId}
            onClick={releaseAll}
            className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-4 disabled:opacity-50"
          >
            Release All
          </button>
        </div>
      </div>

      {!seasonId && (
        <div className="rounded-xl border border-silver bg-white p-8 text-center text-sm text-mist">
          Create a season to start placing students.
        </div>
      )}

      {grouped.map(([levelKey, levelStudents]) => (
        <section key={levelKey} className="rounded-xl border border-silver bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-silver bg-cloud/40 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-charcoal">
              {levelKey === UNPLACED_KEY ? "Unplaced (no level assigned)" : levelKey}
            </h2>
            <span className="text-xs text-mist">{levelStudents.length} students</span>
          </div>
          <div className="divide-y divide-silver">
            {levelStudents.map((student) => {
              const studentPlacements = placementsForStudent(student.id);
              const alert = bundleAlert(student.id);
              const age = calculateAge(student.date_of_birth);
              return (
                <div key={student.id} className="px-5 py-3 flex items-start gap-4">
                  <div className="w-48 shrink-0">
                    <div className="text-sm font-medium text-charcoal">
                      {student.first_name} {student.last_name}
                    </div>
                    <div className="text-xs text-mist">Age {age}</div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {studentPlacements.length === 0 ? (
                        <span className="text-xs text-mist italic">No classes assigned</span>
                      ) : (
                        studentPlacements.map((p) => {
                          const cls = classes.find((c) => c.id === p.class_id);
                          return (
                            <span
                              key={p.id}
                              className="inline-flex items-center gap-1 rounded-full bg-lavender/10 text-lavender-dark px-2 py-1 text-xs"
                            >
                              {cls?.name ?? "Class"}
                              <button
                                onClick={() => removePlacement(p.id)}
                                disabled={busy}
                                className="text-lavender hover:text-error font-bold"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })
                      )}
                    </div>
                    {alert && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                        {alert}
                      </div>
                    )}
                  </div>
                  <div className="w-56 shrink-0">
                    <select
                      disabled={busy || !seasonId}
                      onChange={(e) => {
                        if (e.target.value) {
                          addPlacement(student.id, e.target.value);
                          e.target.value = "";
                        }
                      }}
                      defaultValue=""
                      className="w-full h-9 rounded-lg border border-silver bg-white px-2 text-xs text-charcoal disabled:opacity-50"
                    >
                      <option value="">+ Add a class…</option>
                      {classes
                        .filter((c) => !studentPlacements.some((p) => p.class_id === c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
