// ── Types ──────────────────────────────────────────────────────
// Shared types and constants for schedule module.
// Safe to import from client components.

export interface ScheduleClass {
  id: string;
  tenant_id: string;
  full_name: string | null;
  simple_name: string | null;
  short_name: string | null;
  display_name: string | null;
  name: string;
  class_type: string;
  program_division: string | null;
  levels: string[] | null;
  min_age: number | null;
  max_age: number | null;
  start_date: string | null;
  end_date: string | null;
  room: string | null;
  lead_teacher_id: string | null;
  assistant_teacher_ids: string[] | null;
  max_enrollment: number | null;
  min_enrollment: number | null;
  enrollment_count: number;
  production_id: string | null;
  status: string;
  is_published: boolean;
  is_open_enrollment: boolean;
  trial_eligible: boolean;
  trial_requires_approval: boolean;
  trial_max_per_class: number;
  back_to_back_class_ids: string[] | null;
  color_code: string | null;
  created_at: string;
  teacherName?: string | null;
  productionName?: string | null;
}

export interface ClassSession {
  id: string;
  tenant_id: string;
  class_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number | null;
  room: string | null;
  lead_teacher_id: string | null;
  assistant_teacher_ids: string[] | null;
  substitute_teacher_id: string | null;
  is_substitute_session: boolean;
  status: string;
  is_cancelled: boolean;
  cancellation_reason: string | null;
  needs_coverage: boolean;
  session_notes: string | null;
  attendance_locked_at: string | null;
  className?: string | null;
  classType?: string | null;
  teacherName?: string | null;
  teacherInitials?: string | null;
  subTeacherName?: string | null;
  enrollmentCount?: number;
}

export interface AdminTask {
  id: string;
  tenant_id: string;
  task_type: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  related_class_id: string | null;
  related_session_id: string | null;
  related_teacher_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  created_at: string;
  className?: string | null;
  teacherName?: string | null;
}

// ── Color constants ────────────────────────────────────────────

export const CLASS_TYPE_COLORS: Record<string, string> = {
  regular: "bg-[#9C8BBF]/15 text-[#6B5A99] border-[#9C8BBF]/30",
  rehearsal: "bg-[#D4A843]/15 text-[#9B7A2E] border-[#D4A843]/30",
  performance: "bg-[#5B2D8E]/15 text-[#5B2D8E] border-[#5B2D8E]/30",
  competition: "bg-[#E8735A]/15 text-[#C4503A] border-[#E8735A]/30",
  private: "bg-[#2D9B8E]/15 text-[#1A7568] border-[#2D9B8E]/30",
  workshop: "bg-[#6B7FA3]/15 text-[#4A5B7A] border-[#6B7FA3]/30",
  intensive: "bg-[#6B7FA3]/15 text-[#4A5B7A] border-[#6B7FA3]/30",
  cancelled: "bg-cloud text-mist",
};

export const CLASS_TYPE_BG: Record<string, string> = {
  regular: "#9C8BBF",
  rehearsal: "#D4A843",
  performance: "#5B2D8E",
  competition: "#E8735A",
  private: "#2D9B8E",
  workshop: "#6B7FA3",
  intensive: "#6B7FA3",
};

export const PRIORITY_BADGES: Record<string, string> = {
  urgent: "bg-error/10 text-error",
  normal: "bg-info/10 text-info",
  low: "bg-cloud text-slate",
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  makeup_needed: "Makeup Needed",
  class_at_risk: "Class At Risk",
  coverage_needed: "Coverage Needed",
  cancellation_pay_decision: "Pay Decision",
  timesheet_review: "Timesheet Review",
  other: "Other",
};
