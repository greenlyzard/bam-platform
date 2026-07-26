/**
 * Employment-type classification for payroll reporting.
 *
 * `teachers.employment_type` is CHECK-constrained in the live DB to:
 *   full_time | part_time | contract | employee | contractor_1099 | pending_classification
 *
 * It is NEVER literally 'w2' or '1099'. Any code that compares the raw column
 * against those strings silently matches nothing — that bug shipped four times
 * (payroll buckets, two employment-type filters, and the entry-drawer badge)
 * precisely because the mapping was written inline each time.
 *
 * Import from here. Do not re-inline this mapping.
 *
 * No server imports — safe to use from client components.
 */

export type PayrollClass = "w2" | "1099" | "unclassified";

export const PAYROLL_CLASS_LABELS: Record<PayrollClass, string> = {
  w2: "W-2 Employee",
  "1099": "1099 Contractor",
  unclassified: "Unclassified",
};

/** Shared option list for every employment-type filter dropdown. */
export const EMPLOYMENT_FILTER_OPTIONS: { value: PayrollClass; label: string }[] =
  [
    { value: "w2", label: "W-2 Employees" },
    { value: "1099", label: "1099 Contractors" },
    { value: "unclassified", label: "Unclassified" },
  ];

export function classifyEmployment(
  employmentType: string | null | undefined
): PayrollClass {
  switch (employmentType) {
    case "employee":
    case "full_time":
    case "part_time":
      return "w2";
    case "contract":
    case "contractor_1099":
      return "1099";
    default:
      // pending_classification, null, or any value added to the CHECK
      // constraint later. Never drop or mislabel the teacher — surface them
      // as unclassified so an admin can triage before filing payroll.
      return "unclassified";
  }
}
