"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-cloud text-slate-500",
  submitted: "bg-gold/10 text-gold-dark",
  approved: "bg-success/10 text-success",
  paid: "bg-info/10 text-info",
};

export default function TimecardsTab({ teacherId, canView }: { teacherId: string; canView: boolean }) {
  const [timesheets, setTimesheets] = useState<any[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [totalPay, setTotalPay] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView) return;
    const supabase = createClient();

    async function fetchData() {
      setLoading(true);
      const { data } = await supabase
        .from("timesheets")
        .select("*")
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: false });

      const sheets = data || [];
      setTimesheets(sheets);
      setTotalHours(sheets.reduce((sum: number, s: any) => sum + (s.total_hours || 0), 0));
      setTotalPay(sheets.reduce((sum: number, s: any) => sum + (s.total_pay || 0), 0));
      setLoading(false);
    }

    fetchData();
  }, [teacherId, canView]);

  if (!canView) {
    return (
      <div className="p-6 bg-cloud/50 rounded-lg text-center">
        <p className="text-sm text-slate-500">
          You don&apos;t have permission to view payroll data. Finance Admin or Studio Owner access required.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="animate-pulse space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-cloud rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded-lg border border-cloud">
          <p className="text-xs text-slate-400 uppercase">Total Lifetime Hours</p>
          <p className="text-2xl font-bold text-slate-800">{totalHours.toFixed(1)}</p>
        </div>
        <div className="p-4 bg-white rounded-lg border border-cloud">
          <p className="text-xs text-slate-400 uppercase">Total Lifetime Pay</p>
          <p className="text-2xl font-bold text-slate-800">
            ${totalPay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Timesheets Table */}
      {timesheets.length === 0 ? (
        <p className="text-sm text-slate-500">No timesheets found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-cloud">
                <th className="pb-2 pr-4">Period</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Hours</th>
                <th className="pb-2 pr-4">Pay</th>
                <th className="pb-2">Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {timesheets.map((ts: any) => (
                <tr key={ts.id} className="border-b border-cloud/50">
                  <td className="py-2 pr-4">
                    <Link href="/admin/timesheets" className="text-lavender hover:underline">
                      {ts.pay_period_id || new Date(ts.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[ts.status] || "bg-cloud text-slate-400"}`}>
                      {ts.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4">{ts.total_hours ?? "—"}</td>
                  <td className="py-2 pr-4">
                    {ts.total_pay != null
                      ? `$${Number(ts.total_pay).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="py-2 text-slate-400">
                    {ts.reviewed_at ? new Date(ts.reviewed_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
