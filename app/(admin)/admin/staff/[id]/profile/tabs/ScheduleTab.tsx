"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const DAYS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ScheduleTab({ teacherId }: { teacherId: string }) {
  const [availability, setAvailability] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchData() {
      setLoading(true);

      const [avail, classTch] = await Promise.all([
        supabase
          .from("teacher_availability")
          .select("*")
          .eq("teacher_id", teacherId)
          .order("day_of_week"),
        supabase
          .from("class_teachers")
          .select("classes(*)")
          .eq("teacher_id", teacherId),
      ]);

      setAvailability(avail.data || []);
      setClasses(
        (classTch.data || [])
          .map((ct: any) => ct.classes)
          .filter((c: any) => c && c.is_active)
      );
      setLoading(false);
    }

    fetchData();
  }, [teacherId]);

  if (loading) {
    return <div className="animate-pulse space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-cloud rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Availability Slots */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Availability Slots</h3>
        {availability.length === 0 ? (
          <p className="text-sm text-slate-500">No availability slots configured.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-cloud">
                  <th className="pb-2 pr-4">Day</th>
                  <th className="pb-2 pr-4">Time</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Published</th>
                  <th className="pb-2">Booked</th>
                </tr>
              </thead>
              <tbody>
                {availability.map((slot: any) => (
                  <tr key={slot.id} className="border-b border-cloud/50">
                    <td className="py-2 pr-4">{DAYS[slot.day_of_week] || slot.day_of_week}</td>
                    <td className="py-2 pr-4">{slot.start_time}&#8211;{slot.end_time}</td>
                    <td className="py-2 pr-4">{slot.slot_type || "—"}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${slot.is_published ? "bg-success/10 text-success" : "bg-cloud text-slate-400"}`}>
                        {slot.is_published ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${slot.is_booked ? "bg-gold/10 text-gold-dark" : "bg-cloud text-slate-400"}`}>
                        {slot.is_booked ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Teaching Schedule */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Teaching Schedule</h3>
        {classes.length === 0 ? (
          <p className="text-sm text-slate-500">No active classes.</p>
        ) : (
          <div className="space-y-1">
            {classes.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-2 bg-white rounded border border-cloud text-sm">
                <span className="font-medium w-10 text-slate-500">{DAYS[c.day_of_week] || c.day_of_week}</span>
                <span className="text-slate-500 w-28">{c.start_time}&#8211;{c.end_time}</span>
                <span className="font-medium">{c.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Studio Closures */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Studio Closures</h3>
        <div className="p-4 bg-cloud/50 rounded-lg border border-dashed border-cloud-dark text-sm text-slate-500 text-center">
          Studio closures will appear here when configured
        </div>
      </section>
    </div>
  );
}
