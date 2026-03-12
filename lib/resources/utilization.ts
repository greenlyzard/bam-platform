import { createClient } from "@/lib/supabase/server";
import type {
  UtilizationGrid,
  DeadTimeBlock,
  RentalEligibleBlock,
  TeacherLoad,
  TeacherLoadStatus,
  EnrollmentGap,
  StudioHoursRow,
  UtilizationSlot,
  SlotStatus,
} from "./types";
import type { Room } from "@/lib/calendar/types";

// ── Helpers ──────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getWeekDates(weekStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ── Studio Hours ─────────────────────────────────────────

export async function getStudioHours(
  tenantId: string
): Promise<StudioHoursRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("studio_hours")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("day_of_week");

  if (error) {
    console.error("[resources:getStudioHours]", error);
    return [];
  }
  return data ?? [];
}

// ── Weekly Utilization Grid ──────────────────────────────

export async function getWeeklyUtilization(
  tenantId: string,
  weekStart: Date
): Promise<UtilizationGrid> {
  const supabase = await createClient();
  const dates = getWeekDates(weekStart);
  const startDate = formatDate(dates[0]);
  const endDate = formatDate(dates[6]);

  // Fetch rooms, studio hours, schedule instances, and rentals in parallel
  const [roomsResult, hoursResult, instancesResult, rentalsResult] =
    await Promise.all([
      supabase
        .from("rooms")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_bookable", true)
        .order("name"),
      supabase
        .from("studio_hours")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("day_of_week"),
      supabase
        .from("schedule_instances")
        .select("id, room_id, event_date, start_time, end_time, class_id, teacher_id, status")
        .eq("tenant_id", tenantId)
        .gte("event_date", startDate)
        .lte("event_date", endDate)
        .neq("status", "cancelled"),
      supabase
        .from("room_rentals")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("start_time", new Date(startDate).toISOString())
        .lte("end_time", new Date(endDate + "T23:59:59").toISOString())
        .in("status", ["inquiry", "confirmed"]),
    ]);

  const rooms: Room[] = roomsResult.data ?? [];
  const hours: StudioHoursRow[] = hoursResult.data ?? [];
  const instances = instancesResult.data ?? [];
  const rentals = rentalsResult.data ?? [];

  // Build hours map by day_of_week
  const hoursMap = new Map<number, StudioHoursRow>();
  for (const h of hours) {
    hoursMap.set(h.day_of_week, h);
  }

  // Fetch class names for instances
  const classIds = [
    ...new Set(instances.map((i) => i.class_id).filter(Boolean) as string[]),
  ];
  const classNames: Record<string, string> = {};
  if (classIds.length > 0) {
    const { data: classes } = await supabase
      .from("classes")
      .select("id, name, level, max_students")
      .in("id", classIds);
    for (const c of classes ?? []) {
      classNames[c.id] = c.name;
    }
  }

  // Build grid for each room
  const roomUtilizations = rooms.map((room) => {
    const slots: UtilizationSlot[] = [];
    let occupiedHours = 0;
    let totalOpenHours = 0;

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayOfWeek = dayIdx; // 0=Sun matches our getWeekDates starting from weekStart
      const actualDate = dates[dayIdx];
      const actualDayOfWeek = actualDate.getDay();
      const dayHours = hoursMap.get(actualDayOfWeek);

      if (!dayHours || dayHours.is_closed) {
        // Generate closed slots for typical display hours
        for (let hour = 9; hour < 21; hour++) {
          slots.push({ dayOfWeek: dayIdx, hour, status: "closed" });
        }
        continue;
      }

      const openHour = timeToMinutes(dayHours.open_time) / 60;
      const closeHour = timeToMinutes(dayHours.close_time) / 60;
      totalOpenHours += closeHour - openHour;

      // Get instances for this room on this date
      const dateStr = formatDate(actualDate);
      const dayInstances = instances.filter(
        (i) => i.room_id === room.id && i.event_date === dateStr
      );

      // Get rentals for this room on this date
      const dayRentals = rentals.filter((r) => {
        if (r.room_id !== room.id) return false;
        const rStart = new Date(r.start_time);
        return formatDate(rStart) === dateStr;
      });

      for (let hour = Math.floor(openHour); hour < Math.ceil(closeHour); hour++) {
        const hourStr = `${String(hour).padStart(2, "0")}:00`;
        const hourEndStr = `${String(hour + 1).padStart(2, "0")}:00`;

        // Check if any instance overlaps this hour
        const overlapping = dayInstances.find((inst) => {
          const iStart = timeToMinutes(inst.start_time);
          const iEnd = timeToMinutes(inst.end_time);
          return iStart < (hour + 1) * 60 && iEnd > hour * 60;
        });

        // Check if any rental overlaps this hour
        const overlappingRental = dayRentals.find((r) => {
          const rStart = new Date(r.start_time);
          const rEnd = new Date(r.end_time);
          const rStartHour = rStart.getHours();
          const rEndHour = rEnd.getHours() + (rEnd.getMinutes() > 0 ? 1 : 0);
          return rStartHour < hour + 1 && rEndHour > hour;
        });

        let status: SlotStatus = "dead_time";
        if (overlapping) {
          status = "occupied";
          occupiedHours++;
        } else if (overlappingRental) {
          status = "occupied";
          occupiedHours++;
        }

        const slot: UtilizationSlot = { dayOfWeek: dayIdx, hour, status };

        if (overlapping && overlapping.class_id) {
          slot.classInstance = {
            id: overlapping.id,
            className: classNames[overlapping.class_id] ?? null,
            teacherName: null,
            level: null,
            enrolled: 0,
            capacity: 0,
          };
        }

        if (overlappingRental) {
          slot.rental = overlappingRental;
        }

        slots.push(slot);
      }
    }

    const utilizationPercent =
      totalOpenHours > 0 ? Math.round((occupiedHours / totalOpenHours) * 100) : 0;

    return { room, slots, utilizationPercent };
  });

  return { weekStart, rooms: roomUtilizations };
}

// ── Dead Time Blocks ─────────────────────────────────────

export async function getDeadTimeBlocks(
  tenantId: string,
  weekStart: Date
): Promise<DeadTimeBlock[]> {
  const supabase = await createClient();
  const dates = getWeekDates(weekStart);
  const startDate = formatDate(dates[0]);
  const endDate = formatDate(dates[6]);

  const [roomsResult, hoursResult, instancesResult] = await Promise.all([
    supabase
      .from("rooms")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_bookable", true)
      .order("name"),
    supabase
      .from("studio_hours")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("day_of_week"),
    supabase
      .from("schedule_instances")
      .select("room_id, event_date, start_time, end_time")
      .eq("tenant_id", tenantId)
      .gte("event_date", startDate)
      .lte("event_date", endDate)
      .neq("status", "cancelled"),
  ]);

  const rooms: Room[] = roomsResult.data ?? [];
  const hours: StudioHoursRow[] = hoursResult.data ?? [];
  const instances = instancesResult.data ?? [];

  const hoursMap = new Map<number, StudioHoursRow>();
  for (const h of hours) hoursMap.set(h.day_of_week, h);

  const blocks: DeadTimeBlock[] = [];

  for (const room of rooms) {
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const actualDate = dates[dayIdx];
      const actualDow = actualDate.getDay();
      const dayHours = hoursMap.get(actualDow);

      if (!dayHours || dayHours.is_closed) continue;

      const dateStr = formatDate(actualDate);
      const dayInstances = instances
        .filter((i) => i.room_id === room.id && i.event_date === dateStr)
        .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

      const openMin = timeToMinutes(dayHours.open_time);
      const closeMin = timeToMinutes(dayHours.close_time);

      // Find gaps between classes
      let cursor = openMin;
      for (const inst of dayInstances) {
        const instStart = timeToMinutes(inst.start_time);
        const instEnd = timeToMinutes(inst.end_time);
        if (instStart > cursor) {
          const duration = instStart - cursor;
          blocks.push({
            room,
            dayOfWeek: actualDow,
            start: minutesToTime(cursor),
            end: minutesToTime(instStart),
            durationMinutes: duration,
            isRentalEligible: duration >= 60,
          });
        }
        cursor = Math.max(cursor, instEnd);
      }

      // Gap after last class until close
      if (cursor < closeMin) {
        const duration = closeMin - cursor;
        blocks.push({
          room,
          dayOfWeek: actualDow,
          start: minutesToTime(cursor),
          end: minutesToTime(closeMin),
          durationMinutes: duration,
          isRentalEligible: duration >= 60,
        });
      }
    }
  }

  return blocks;
}

// ── Rental Eligible Blocks ───────────────────────────────

export async function getRentalEligibleBlocks(
  tenantId: string,
  weekStart: Date,
  minDurationMinutes: number = 60
): Promise<RentalEligibleBlock[]> {
  const deadBlocks = await getDeadTimeBlocks(tenantId, weekStart);

  // Get room rental rates
  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, hourly_rate_private")
    .eq("tenant_id", tenantId);

  const rateMap: Record<string, number> = {};
  for (const r of rooms ?? []) {
    rateMap[r.id] = Number(r.hourly_rate_private) || 30; // default $30/hr
  }

  return deadBlocks
    .filter((b) => b.durationMinutes >= minDurationMinutes)
    .map((b) => {
      const rate = rateMap[b.room.id] ?? 30;
      const hours = b.durationMinutes / 60;
      return {
        ...b,
        isRentalEligible: true,
        suggestedRate: rate,
        estimatedMonthlyRevenue: Math.round(rate * hours * 4 * 100) / 100,
      };
    });
}

// ── Teacher Load Summary ─────────────────────────────────

export async function getTeacherLoadSummary(
  tenantId: string
): Promise<TeacherLoad[]> {
  const supabase = await createClient();

  // Get all active teachers with max hours
  const { data: teachers } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .in("role", ["teacher"]);

  if (!teachers || teachers.length === 0) return [];

  // Get teacher details (max hours)
  const teacherIds = teachers.map((t) => t.id);
  const { data: teacherDetails } = await supabase
    .from("teachers")
    .select("id, max_hours_per_week")
    .in("id", teacherIds);

  const maxHoursMap: Record<string, number> = {};
  for (const td of teacherDetails ?? []) {
    maxHoursMap[td.id] = td.max_hours_per_week ?? 20;
  }

  // Get active classes for each teacher
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, teacher_id, day_of_week, start_time, end_time, room")
    .eq("is_active", true)
    .in("teacher_id", teacherIds);

  // Build teacher load
  return teachers.map((teacher) => {
    const teacherClasses = (classes ?? []).filter(
      (c) => c.teacher_id === teacher.id
    );

    let scheduledHours = 0;
    const classSummaries = teacherClasses.map((c) => {
      const startMin = timeToMinutes(c.start_time);
      const endMin = timeToMinutes(c.end_time);
      const hours = (endMin - startMin) / 60;
      scheduledHours += hours;
      return {
        id: c.id,
        name: c.name,
        dayOfWeek: c.day_of_week,
        startTime: c.start_time,
        endTime: c.end_time,
        room: c.room,
      };
    });

    const maxHours = maxHoursMap[teacher.id] ?? 20;
    const utilizationPercent =
      maxHours > 0 ? Math.round((scheduledHours / maxHours) * 100) : 0;

    let status: TeacherLoadStatus = "balanced";
    if (utilizationPercent > 100) status = "over_max";
    else if (utilizationPercent >= 90) status = "approaching_max";
    else if (utilizationPercent < 40) status = "underloaded";

    return {
      teacher: {
        id: teacher.id,
        firstName: teacher.first_name,
        lastName: teacher.last_name,
        maxHoursPerWeek: maxHours,
      },
      scheduledHours: Math.round(scheduledHours * 10) / 10,
      maxHours,
      utilizationPercent,
      status,
      classes: classSummaries,
    };
  });
}

// ── Enrollment Gaps ──────────────────────────────────────

export async function getEnrollmentGaps(
  tenantId: string,
  capacityThreshold: number = 0.5
): Promise<EnrollmentGap[]> {
  const supabase = await createClient();

  // Get all active classes
  const { data: classes } = await supabase
    .from("classes")
    .select("id, name, max_students, teacher_id, day_of_week, start_time, room")
    .eq("is_active", true);

  if (!classes || classes.length === 0) return [];

  // Get enrollment counts per class
  const classIds = classes.map((c) => c.id);
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("class_id, status")
    .in("class_id", classIds)
    .in("status", ["active", "waitlist"]);

  // Count enrolled and waitlisted per class
  const enrollCounts: Record<string, { enrolled: number; waitlist: number }> = {};
  for (const e of enrollments ?? []) {
    if (!enrollCounts[e.class_id]) {
      enrollCounts[e.class_id] = { enrolled: 0, waitlist: 0 };
    }
    if (e.status === "active") enrollCounts[e.class_id].enrolled++;
    else if (e.status === "waitlist") enrollCounts[e.class_id].waitlist++;
  }

  // Get teacher names
  const teacherIds = [
    ...new Set(classes.map((c) => c.teacher_id).filter(Boolean) as string[]),
  ];
  const teacherNames: Record<string, string> = {};
  if (teacherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", teacherIds);
    for (const p of profiles ?? []) {
      teacherNames[p.id] = [p.first_name, p.last_name].filter(Boolean).join(" ");
    }
  }

  const gaps: EnrollmentGap[] = [];

  for (const c of classes) {
    const capacity = c.max_students || 10;
    const counts = enrollCounts[c.id] ?? { enrolled: 0, waitlist: 0 };
    const fillPercent = counts.enrolled / capacity;

    if (fillPercent < capacityThreshold) {
      gaps.push({
        classId: c.id,
        className: c.name,
        enrolled: counts.enrolled,
        capacity,
        fillPercent: Math.round(fillPercent * 100),
        waitlistCount: counts.waitlist,
        room: c.room,
        teacherName: c.teacher_id ? (teacherNames[c.teacher_id] ?? null) : null,
        dayOfWeek: c.day_of_week,
        startTime: c.start_time,
      });
    }
  }

  return gaps.sort((a, b) => a.fillPercent - b.fillPercent);
}
