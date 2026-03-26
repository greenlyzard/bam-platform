"use client";

import { useTransition } from "react";
import { exportAndMarkPaid } from "./actions";

interface CsvRow {
  id: string;
  teacher: string;
  teacherLastName?: string;
  teacherFirstName?: string;
  email: string;
  employmentType?: string;
  date: string;
  type: string;
  hours: number;
  rate?: number | null;
  totalPay?: number | null;
  description: string;
  status: string;
  rateOverride?: boolean;
  notes?: string;
  productionTag?: string;
  isSubstitute?: boolean;
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function ExportCsvButton({ rows }: { rows: CsvRow[] }) {
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    const headers = [
      "Last Name",
      "First Name",
      "Employment Type",
      "Date",
      "Entry Type",
      "Description",
      "Hours",
      "Rate",
      "Total Pay",
      "Rate Override",
      "Notes",
      "Production/Competition",
      "Is Substitute",
      "Status",
    ];

    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          escapeCsv(r.teacherLastName ?? ""),
          escapeCsv(r.teacherFirstName ?? ""),
          escapeCsv(r.employmentType ?? ""),
          r.date,
          r.type,
          escapeCsv(r.description),
          r.hours.toFixed(2),
          r.rate != null ? r.rate.toFixed(2) : "",
          r.totalPay != null ? r.totalPay.toFixed(2) : "",
          r.rateOverride ? "Yes" : "No",
          escapeCsv(r.notes ?? ""),
          escapeCsv(r.productionTag ?? ""),
          r.isSubstitute ? "Yes" : "No",
          r.status,
        ].join(",")
      ),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const filename = `BAM_Payroll_${now.toLocaleDateString("en-US", { month: "long" })}_${now.getFullYear()}_${now.getTime()}.csv`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // Mark exported entries as paid (approved entries only)
    const approvedIds = rows.filter((r) => r.status === "approved").map((r) => r.id);
    if (approvedIds.length > 0) {
      startTransition(async () => {
        const fd = new FormData();
        fd.set("entryIds", JSON.stringify(approvedIds));
        await exportAndMarkPaid(fd);
      });
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={isPending}
      className="h-10 rounded-lg border border-silver bg-white hover:bg-cloud text-sm font-medium text-charcoal px-4 transition-colors disabled:opacity-50"
    >
      {isPending ? "Exporting..." : "Export CSV"}
    </button>
  );
}
