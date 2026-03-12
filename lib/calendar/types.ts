// ── Event Types ──────────────────────────────────────────

export type ScheduleEventType =
  | "class"
  | "trial_class"
  | "rehearsal"
  | "private_lesson"
  | "performance"
  | "room_block"
  | "teacher_absence"
  | "studio_closure";

export type ScheduleInstanceStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "published"
  | "cancelled"
  | "notified";

export type ChangeRequestType =
  | "cancellation"
  | "teacher_change"
  | "room_change"
  | "time_change"
  | "add_instance"
  | "note_update";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalTaskStatus = "pending" | "completed" | "dismissed";

export type CalendarProvider = "google" | "apple" | "outlook" | "ics";

export type EmbedDisplayMode = "week" | "list" | "day";

export type SeasonPeriod = "fall" | "winter" | "spring" | "summer";

export type SeasonProgram =
  | "regular"
  | "performance"
  | "competition"
  | "summer_intensive"
  | "camp"
  | "workshop";

// ── Row Types ────────────────────────────────────────────

export interface Season {
  id: string;
  tenant_id: string;
  name: string;
  period: SeasonPeriod;
  program: SeasonProgram;
  year: number;
  is_public: boolean;
  start_date: string;
  end_date: string;
  is_active: boolean;
  registration_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  tenant_id: string;
  name: string;
  capacity: number | null;
  is_bookable: boolean;
  hourly_rate_private: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleTemplate {
  id: string;
  tenant_id: string;
  season_id: string;
  class_id: string;
  teacher_id: string | null;
  room_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_trial_eligible: boolean;
  max_capacity: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduleInstance {
  id: string;
  tenant_id: string;
  template_id: string | null;
  class_id: string | null;
  teacher_id: string | null;
  room_id: string | null;
  event_type: ScheduleEventType;
  event_date: string;
  start_time: string;
  end_time: string;
  status: ScheduleInstanceStatus;
  cancellation_reason: string | null;
  substitute_teacher_id: string | null;
  notes: string | null;
  approval_status: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notification_sent_at: string | null;
  ical_uid: string | null;
  is_trial_eligible: boolean;
  production_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarSubscription {
  id: string;
  user_id: string;
  tenant_id: string;
  subscription_token: string;
  scope: Record<string, unknown>;
  provider: CalendarProvider | null;
  last_synced_at: string | null;
  created_at: string;
}

export interface ScheduleChangeRequest {
  id: string;
  tenant_id: string;
  instance_id: string;
  change_type: ChangeRequestType;
  requested_by: string;
  requested_at: string;
  previous_state: Record<string, unknown>;
  proposed_state: Record<string, unknown>;
  approval_status: ApprovalStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  notifications_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovalTask {
  id: string;
  tenant_id: string;
  change_request_id: string;
  assigned_to: string;
  status: ApprovalTaskStatus;
  prompted_at: string;
  completed_at: string | null;
  prompt_channel: string[] | null;
  reminder_count: number;
  created_at: string;
  updated_at: string;
}

export interface ScheduleEmbed {
  id: string;
  tenant_id: string;
  name: string;
  embed_token: string;
  default_season_id: string | null;
  default_days: number[] | null;
  default_levels: string[] | null;
  default_class_types: string[] | null;
  default_age_min: number | null;
  default_age_max: number | null;
  default_teacher_id: string | null;
  show_trials_only: boolean;
  show_rehearsals: boolean;
  allow_filter_season: boolean;
  allow_filter_day: boolean;
  allow_filter_level: boolean;
  allow_filter_age: boolean;
  allow_filter_class_type: boolean;
  allow_filter_teacher: boolean;
  allow_filter_trial: boolean;
  allow_filter_rehearsal: boolean;
  display_mode: EmbedDisplayMode;
  show_teacher: boolean;
  show_room: boolean;
  show_capacity: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Enriched Types ───────────────────────────────────────

export interface ScheduleInstanceWithDetails extends ScheduleInstance {
  className: string | null;
  teacherName: string | null;
  substituteTeacherName: string | null;
  roomName: string | null;
  level: string | null;
  style: string | null;
  ageMin: number | null;
  ageMax: number | null;
  discipline: string | null;
}

// ── Filter Type ──────────────────────────────────────────

export interface ScheduleInstanceFilters {
  startDate: string;
  endDate: string;
  eventTypes?: ScheduleEventType[];
  teacherId?: string;
  roomId?: string;
  statuses?: ScheduleInstanceStatus[];
}

// ── Substitute System Types ─────────────────────────────

export type SubstituteRequestStatus = "open" | "filled" | "cancelled" | "unfilled";

export type SubstituteAlertResponse = "accepted" | "declined" | "no_response";

export interface SubstituteAuthorization {
  id: string;
  tenant_id: string;
  teacher_id: string;
  authorized_for_levels: string[] | null;
  authorized_for_types: string[] | null;
  priority_order: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SubstituteRequest {
  id: string;
  tenant_id: string;
  instance_id: string;
  requesting_teacher_id: string;
  reason: string | null;
  status: SubstituteRequestStatus;
  filled_by: string | null;
  filled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubstituteAlert {
  id: string;
  tenant_id: string;
  request_id: string;
  teacher_id: string;
  alert_sent_at: string;
  response: SubstituteAlertResponse | null;
  responded_at: string | null;
  alert_channel: string[] | null;
  created_at: string;
}

// ── Widget Data Types ───────────────────────────────────

export interface WidgetScheduleData {
  instances: ScheduleInstanceWithDetails[];
  seasons: Season[];
  embedConfig: ScheduleEmbed;
}

// ── Color Constants ──────────────────────────────────────

export const EVENT_TYPE_COLORS: Record<string, string> = {
  // Level-based colors
  petite: "bg-[#F4C6D4]/20 text-[#C4506A]",
  pre_ballet: "bg-[#D4C6F4]/20 text-[#6B5B9E]",
  beginner: "bg-[#B8A9E0]/20 text-[#6B5B9E]",
  intermediate: "bg-lavender/10 text-lavender-dark",
  advanced: "bg-[#6B5B9E]/10 text-[#6B5B9E]",
  open: "bg-[#A8C5A0]/20 text-[#5A7A52]",
  // Event-type-based colors
  rehearsal: "bg-gold/10 text-gold-dark",
  performance: "bg-[#F0E0C0]/30 text-[#9B7A2E]",
  trial_class: "bg-[#7EC8C8]/20 text-[#3A8A8A]",
  private_lesson: "bg-[#E8A896]/20 text-[#A05A42]",
  room_block: "bg-cloud text-slate",
  teacher_absence: "bg-cloud text-slate",
  studio_closure: "bg-error/10 text-error",
};
