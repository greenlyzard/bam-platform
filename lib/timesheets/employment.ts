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

/**
 * `owner_draw` is NOT a payroll bucket. An owner still logs timesheets — those
 * hours reconcile against private billing whether or not a draw is taken — but
 * payments to them are equity distributions, not wages. Owner hours and value
 * must never be folded into wage expense, W-2 totals, or 1099 totals.
 */
export type PayrollClass = "w2" | "1099" | "owner_draw" | "unclassified";

export const PAYROLL_CLASS_LABELS: Record<PayrollClass, string> = {
  w2: "W-2 Employee",
  "1099": "1099 Contractor",
  owner_draw: "Owner Draw",
  unclassified: "Unclassified",
};

/**
 * The raw `teachers.employment_type` vocabulary — every value permitted by the
 * CHECK constraint, in the order an admin should see them. This is the single
 * source for any control that *writes* the column; the PayrollClass values
 * above are the derived read-side buckets and must never be written to the DB.
 */
export const EMPLOYMENT_TYPE_VALUES = [
  "employee",
  "full_time",
  "part_time",
  "contract",
  "contractor_1099",
  "owner",
  "pending_classification",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPE_VALUES)[number];

export const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentType; label: string }[] =
  [
    { value: "employee", label: "Employee" },
    { value: "full_time", label: "Full Time" },
    { value: "part_time", label: "Part Time" },
    { value: "contract", label: "Contract" },
    { value: "contractor_1099", label: "Contractor (1099)" },
    { value: "owner", label: "Owner" },
    { value: "pending_classification", label: "Pending Classification" },
  ];

/** Shared option list for every employment-type filter dropdown. */
export const EMPLOYMENT_FILTER_OPTIONS: { value: PayrollClass; label: string }[] =
  [
    { value: "w2", label: "W-2 Employees" },
    { value: "1099", label: "1099 Contractors" },
    { value: "owner_draw", label: "Owner Draws" },
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
    case "owner":
      return "owner_draw";
    default:
      // pending_classification, null, or any value added to the CHECK
      // constraint later. Never drop or mislabel the teacher — surface them
      // as unclassified so an admin can triage before filing payroll.
      return "unclassified";
  }
}
