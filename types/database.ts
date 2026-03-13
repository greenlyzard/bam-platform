// Generated types will come from Supabase schema
// For now, define core types manually

export type UserRole = "parent" | "teacher" | "admin" | "student";

export type ClassStyle =
  | "ballet"
  | "pointe"
  | "jazz"
  | "contemporary"
  | "musical_theatre"
  | "lyrical"
  | "creative_movement"
  | "pre_ballet";

export type ClassLevel =
  | "petite"
  | "beginner"
  | "intermediate"
  | "advanced"
  | "pre_professional"
  | "open";

export type SubBrand = "recreational" | "performance" | "competition";

export type EnrollmentStatus =
  | "enrolled"
  | "waitlisted"
  | "dropped"
  | "completed"
  | "transferred";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export type BadgeCategory =
  | "technique"
  | "milestone"
  | "attendance"
  | "musicality"
  | "leadership"
  | "competition"
  | "special_program";

export type BadgeTier = "bronze" | "silver" | "gold" | "platinum";

export type SeasonStatus =
  | "draft"
  | "registration_open"
  | "active"
  | "completed"
  | "archived";

export type PerformanceStatus =
  | "planning"
  | "casting"
  | "rehearsing"
  | "tech_week"
  | "performing"
  | "completed"
  | "archived";

// ── Registration Phase 1 Types ──────────────────────────────

export type EnrollmentType = "full" | "trial" | "audit" | "comp";

export type ProrationMethod = "per_class" | "daily" | "split" | "custom" | "none";

export type PortalAccessLevel = "view_only" | "standard" | "full";

export type ContactType = "emergency" | "stream" | "both";

export interface Family {
  id: string;
  tenant_id: string;
  primary_contact_id: string | null;
  family_name: string;
  billing_email: string | null;
  billing_phone: string | null;
  stripe_customer_id: string | null;
  account_credit: number;
  notes: string | null;
  created_at: string;
}

export interface FamilyContact {
  id: string;
  tenant_id: string;
  family_id: string;
  contact_type: ContactType;
  first_name: string;
  last_name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  has_portal_account: boolean;
  user_id: string | null;
  notify_via_sms: boolean;
  notify_via_email: boolean;
  notify_via_app: boolean;
  is_primary: boolean;
  stream_authorized_student_ids: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnrollmentWindow {
  id: string;
  tenant_id: string;
  school_year: string;
  returning_open_at: string | null;
  returning_close_at: string | null;
  public_open_at: string | null;
  public_close_at: string | null;
  earlybird_discount_type: "percent" | "amount" | null;
  earlybird_discount_value: number | null;
  earlybird_applies_to: "registration_fee" | "first_month" | null;
  created_by: string | null;
  created_at: string;
}
