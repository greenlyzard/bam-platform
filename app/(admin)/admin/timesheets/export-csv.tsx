"use client";

interface CsvRow {
  teacher: string;
  email: string;
  date: string;
  type: string;
  hours: number;
  description: string;
  status: string;
}

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function ExportCsvButton({ rows }: { rows: CsvRow[] }) {
  function handleExport() {
    const headers = [
      "Teacher",
      "Email",
      "Date",
      "Entry Type",
      "Hours",
      "Description",
      "Status",
    ];

    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          escapeCsv(r.teacher),
          escapeCsv(r.email),
          r.date,
          r.type,
          r.hours.toFixed(2),
          escapeCsv(r.description),
          r.status,
        ].join(",")
      ),
    ];

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const filename = `timesheets-${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}.csv`;
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="h-10 rounded-lg border border-silver bg-white hover:bg-cloud text-sm font-medium text-charcoal px-4 transition-colors"
    >
      Export CSV
    </button>
  );
}
