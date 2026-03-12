import type { Room } from "@/lib/calendar/types";

// ── Utilization Types ─────────────────────────────────────

export type SlotStatus = "occupied" | "dead_time" | "closed" | "rental_eligible";

export type TeacherLoadStatus =
  | "underloaded"
  | "balanced"
  | "approaching_max"
  | "over_max";

export type RecommendationType =
  | "fill_class"
  | "add_class"
  | "move_class"
  | "rental_opportunity"
  | "teacher_load"
  | "room_conflict";

export type RecommendationPriority = "high" | "medium" | "low";

export type RecommendationStatus = "active" | "dismissed" | "acted_on";

export type RentalStatus = "inquiry" | "confirmed" | "cancelled" | "completed";

export type RenterType =
  | "yoga"
  | "pilates"
  | "fitness"
  | "dance"
  | "therapy"
  | "other";

// ── Utilization Grid ──────────────────────────────────────

export interface ClassInstanceSummary {
  id: string;
  className: string | null;
  teacherName: string | null;
  level: string | null;
  enrolled: number;
  capacity: number;
}

export interface UtilizationSlot {
  dayOfWeek: number;
  hour: number;
  status: SlotStatus;
  classInstance?: ClassInstanceSummary;
  rental?: RoomRentalRow;
}

export interface RoomUtilization {
  room: Room;
  slots: UtilizationSlot[];
  utilizationPercent: number;
}

export interface UtilizationGrid {
  weekStart: Date;
  rooms: RoomUtilization[];
}

// ── Dead Time & Rental ────────────────────────────────────

export interface DeadTimeBlock {
  room: Room;
  dayOfWeek: number;
  start: string; // HH:MM
  end: string;   // HH:MM
  durationMinutes: number;
  isRentalEligible: boolean;
}

export interface RentalEligibleBlock extends DeadTimeBlock {
  suggestedRate: number;
  estimatedMonthlyRevenue: number;
}

// ── Teacher Load ──────────────────────────────────────────

export interface ClassSummary {
  id: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
}

export interface TeacherProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  maxHoursPerWeek: number;
}

export interface TeacherLoad {
  teacher: TeacherProfile;
  scheduledHours: number;
  maxHours: number;
  utilizationPercent: number;
  status: TeacherLoadStatus;
  classes: ClassSummary[];
}

// ── Enrollment Gaps ───────────────────────────────────────

export interface EnrollmentGap {
  classId: string;
  className: string;
  enrolled: number;
  capacity: number;
  fillPercent: number;
  waitlistCount: number;
  room: string | null;
  teacherName: string | null;
  dayOfWeek: number;
  startTime: string;
}

// ── Recommendation ────────────────────────────────────────

export interface ResourceRecommendation {
  id: string;
  tenant_id: string;
  recommendation_type: RecommendationType;
  title: string;
  description: string;
  priority: RecommendationPriority;
  status: RecommendationStatus;
  metadata: Record<string, unknown>;
  generated_at: string;
  expires_at: string | null;
  acted_on_at: string | null;
  dismissed_at: string | null;
  created_at: string;
}

// ── Room Rental ───────────────────────────────────────────

export interface RoomRentalRow {
  id: string;
  tenant_id: string;
  room_id: string;
  renter_name: string;
  renter_email: string;
  renter_phone: string | null;
  renter_type: RenterType | null;
  start_time: string;
  end_time: string;
  rate_per_hour: number | null;
  total_amount: number | null;
  status: RentalStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Studio Hours ──────────────────────────────────────────

export interface StudioHoursRow {
  id: string;
  tenant_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  created_at: string;
}
