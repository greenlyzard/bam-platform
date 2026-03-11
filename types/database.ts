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
