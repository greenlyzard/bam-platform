"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SUB_TABS = ["Current Classes", "Past Classes", "Private Sessions"] as const;

export default function ClassesTab({ teacherId }: { teacherId: string }) {
  const [activeTab, setActiveTab] = useState<(typeof SUB_TABS)[number]>("Current Classes");
  const [currentClasses, setCurrentClasses] = useState<any[]>([]);
  const [pastClasses, setPastClasses] = useState<any[]>([]);
  const [privateSessions, setPrivateSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchData() {
      setLoading(true);

      // Current classes
      const { data: currentCt } = await supabase
        .from("class_teachers")
        .select("classes(*)")
        .eq("teacher_id", teacherId);
      const allClasses = (currentCt || []).map((ct: any) => ct.classes).filter(Boolean);
      setCurrentClasses(allClasses.filter((c: any) => c.is_active));
      setPastClasses(allClasses.filter((c: any) => !c.is_active));

      // Private sessions
      const { data: sessions } = await supabase
        .from("private_sessions")
        .select("id, session_type, session_date, start_time, end_time, duration_minutes, status, student_ids")
        .eq("primary_teacher_id", teacherId)
        .order("session_date", { ascending: false })
        .limit(50);

      if (sessions && sessions.length > 0) {
        const studentIds = [...new Set(sessions.flatMap((s: any) => s.student_ids || []))];
        const { data: students } = studentIds.length
          ? await supabase.from("students").select("id, first_name, last_name").in("id", studentIds)
          : { data: [] };
        const nameMap = Object.fromEntries(
          (students || []).map((s: any) => [s.id, `${s.first_name} ${s.last_name}`])
        );
        setPrivateSessions(
          sessions.map((s: any) => ({
            ...s,
            student_names: (s.student_ids || []).map((id: string) => nameMap[id] || "Unknown").join(", "),
          }))
        );
      }

      setLoading(false);
    }

    fetchData();
  }, [teacherId]);

  if (loading) {
    return <div className="animate-pulse space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-cloud rounded-lg" />)}</div>;
  }

  const grouped = pastClasses.reduce((acc: Record<string, any[]>, c: any) => {
    const key = c.season || "Ungrouped";
    (acc[key] ||= []).push(c);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? "bg-lavender text-white" : "bg-cloud text-slate-600 hover:bg-cloud-dark"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Current Classes" && (
        <div className="space-y-2">
          {currentClasses.length === 0 && <p className="text-slate-500 text-sm">No current classes assigned.</p>}
          {currentClasses.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-cloud">
              <div>
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-slate-500">
                  {c.discipline} &middot; {DAYS[c.day_of_week] || c.day_of_week} &middot; {c.start_time}&#8211;{c.end_time} &middot; {c.room || "No room"}
                </p>
              </div>
              <span className="text-xs text-slate-500">{c.enrolled_count ?? 0}/{c.max_enrollment ?? "—"}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "Past Classes" && (
        <div className="space-y-4">
          {Object.keys(grouped).length === 0 && <p className="text-slate-500 text-sm">No past classes found.</p>}
          {Object.entries(grouped).map(([season, classes]) => (
            <div key={season}>
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">{season}</h4>
              <div className="space-y-2">
                {classes.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-cloud">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-slate-500">
                        {c.discipline} &middot; {DAYS[c.day_of_week] || c.day_of_week} &middot; {c.start_time}&#8211;{c.end_time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "Private Sessions" && (
        <div className="space-y-2">
          {privateSessions.length === 0 && <p className="text-slate-500 text-sm">No private sessions found.</p>}
          {privateSessions.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-cloud">
              <div>
                <p className="font-medium text-sm">{s.student_names || "No students"}</p>
                <p className="text-xs text-slate-500">
                  {s.session_date} &middot; {s.start_time}&#8211;{s.end_time} &middot; {s.duration_minutes}min
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                s.status === "completed" ? "bg-success/10 text-success" :
                s.status === "cancelled" ? "bg-red-100 text-red-600" :
                "bg-gold/10 text-gold-dark"
              }`}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
