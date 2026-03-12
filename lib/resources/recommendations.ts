import { createClient } from "@/lib/supabase/server";
import {
  getDeadTimeBlocks,
  getEnrollmentGaps,
  getTeacherLoadSummary,
  getRentalEligibleBlocks,
} from "./utilization";
import type { ResourceRecommendation, RecommendationType } from "./types";

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "pm" : "am";
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, "0")}${period}`;
}

// ── Generate All Recommendations ─────────────────────────

export async function generateRecommendations(
  tenantId: string
): Promise<ResourceRecommendation[]> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)

  const recommendations: Omit<ResourceRecommendation, "id" | "created_at">[] = [];

  // Run all analyses in parallel
  const [enrollmentGaps, teacherLoads, rentalBlocks] = await Promise.all([
    getEnrollmentGaps(tenantId, 0.5),
    getTeacherLoadSummary(tenantId),
    getRentalEligibleBlocks(tenantId, weekStart, 60),
  ]);

  // ── fill_class recommendations ────────────────────────
  for (const gap of enrollmentGaps) {
    if (gap.enrolled === 0) continue; // Skip empty classes

    const dayName = DAY_NAMES[gap.dayOfWeek] ?? "";
    const timeStr = formatTime(gap.startTime);

    recommendations.push({
      tenant_id: tenantId,
      recommendation_type: "fill_class",
      title: `Low enrollment: ${gap.className}`,
      description: `${dayName} ${timeStr} ${gap.className} is ${gap.enrolled}/${gap.capacity} full (${gap.fillPercent}%). Consider promoting this class to parents of students in the right age group.`,
      priority: gap.fillPercent < 25 ? "high" : "medium",
      status: "active",
      metadata: {
        classId: gap.classId,
        enrolled: gap.enrolled,
        capacity: gap.capacity,
        fillPercent: gap.fillPercent,
        dayOfWeek: gap.dayOfWeek,
        suggestedAction: "email_parents",
      },
      generated_at: now.toISOString(),
      expires_at: new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      acted_on_at: null,
      dismissed_at: null,
    });
  }

  // ── rental_opportunity recommendations ────────────────
  // Group rental blocks by room + day + time to find recurring availability
  const blockKey = (b: { room: { id: string }; dayOfWeek: number; start: string; end: string }) =>
    `${b.room.id}:${b.dayOfWeek}:${b.start}-${b.end}`;

  const blockGroups = new Map<string, typeof rentalBlocks>();
  for (const block of rentalBlocks) {
    const key = blockKey(block);
    if (!blockGroups.has(key)) blockGroups.set(key, []);
    blockGroups.get(key)!.push(block);
  }

  for (const [, blocks] of blockGroups) {
    if (blocks.length === 0) continue;
    const block = blocks[0];
    const dayName = DAY_NAMES[block.dayOfWeek] ?? "";
    const startStr = formatTime(block.start);
    const endStr = formatTime(block.end);
    const hours = block.durationMinutes / 60;

    recommendations.push({
      tenant_id: tenantId,
      recommendation_type: "rental_opportunity",
      title: `Rental opportunity: ${block.room.name}`,
      description: `${block.room.name} is available ${dayName} ${startStr}–${endStr} (${hours}hr). At $${block.suggestedRate}/hr, this could generate ~$${block.estimatedMonthlyRevenue}/month.`,
      priority: block.durationMinutes >= 120 ? "high" : "medium",
      status: "active",
      metadata: {
        roomId: block.room.id,
        roomName: block.room.name,
        dayOfWeek: block.dayOfWeek,
        startTime: block.start,
        endTime: block.end,
        durationMinutes: block.durationMinutes,
        suggestedRate: block.suggestedRate,
        estimatedMonthlyRevenue: block.estimatedMonthlyRevenue,
      },
      generated_at: now.toISOString(),
      expires_at: new Date(
        now.getTime() + 14 * 24 * 60 * 60 * 1000
      ).toISOString(),
      acted_on_at: null,
      dismissed_at: null,
    });
  }

  // ── teacher_load recommendations ──────────────────────
  for (const load of teacherLoads) {
    const name = [load.teacher.firstName, load.teacher.lastName]
      .filter(Boolean)
      .join(" ");

    if (load.status === "over_max" || load.status === "approaching_max") {
      recommendations.push({
        tenant_id: tenantId,
        recommendation_type: "teacher_load",
        title: `High workload: ${name}`,
        description: `${name} is scheduled for ${load.scheduledHours} of ${load.maxHours} max hours this week (${load.utilizationPercent}%). ${load.status === "over_max" ? "They are over their maximum — consider reassigning a class." : "Adding more classes risks burnout."}`,
        priority: load.status === "over_max" ? "high" : "medium",
        status: "active",
        metadata: {
          teacherId: load.teacher.id,
          scheduledHours: load.scheduledHours,
          maxHours: load.maxHours,
          utilizationPercent: load.utilizationPercent,
          status: load.status,
        },
        generated_at: now.toISOString(),
        expires_at: new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        acted_on_at: null,
        dismissed_at: null,
      });
    } else if (load.status === "underloaded" && load.scheduledHours > 0) {
      recommendations.push({
        tenant_id: tenantId,
        recommendation_type: "teacher_load",
        title: `Low hours: ${name}`,
        description: `${name} is only scheduled for ${load.scheduledHours} hours this week (max ${load.maxHours}). They have capacity for additional classes.`,
        priority: "low",
        status: "active",
        metadata: {
          teacherId: load.teacher.id,
          scheduledHours: load.scheduledHours,
          maxHours: load.maxHours,
          utilizationPercent: load.utilizationPercent,
          status: load.status,
        },
        generated_at: now.toISOString(),
        expires_at: new Date(
          now.getTime() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
        acted_on_at: null,
        dismissed_at: null,
      });
    }
  }

  // ── Save to database ──────────────────────────────────
  const supabase = await createClient();

  // Mark old active recommendations as expired
  await supabase
    .from("resource_recommendations")
    .update({ status: "dismissed", dismissed_at: now.toISOString() })
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .lt("expires_at", now.toISOString());

  // Insert new recommendations (skip if similar active one exists)
  const inserted: ResourceRecommendation[] = [];
  for (const rec of recommendations) {
    // Check for existing active recommendation of the same type with the same key metadata
    const metaCheck = rec.metadata as Record<string, unknown>;
    const { data: existing } = await supabase
      .from("resource_recommendations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("recommendation_type", rec.recommendation_type)
      .eq("status", "active")
      .limit(1);

    // Simple dedup: if same type already has active recs, check title match
    const isDuplicate = (existing ?? []).length > 0 &&
      (await supabase
        .from("resource_recommendations")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("recommendation_type", rec.recommendation_type)
        .eq("title", rec.title)
        .eq("status", "active")
        .limit(1)
      ).data?.length;

    if (isDuplicate) continue;

    const { data, error } = await supabase
      .from("resource_recommendations")
      .insert(rec)
      .select()
      .single();

    if (!error && data) {
      inserted.push(data as ResourceRecommendation);
    }
  }

  return inserted;
}

// ── Get Active Recommendations ───────────────────────────

export async function getActiveRecommendations(
  tenantId: string,
  status?: string
): Promise<ResourceRecommendation[]> {
  const supabase = await createClient();

  let query = supabase
    .from("resource_recommendations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("priority")
    .order("generated_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  } else {
    query = query.eq("status", "active");
  }

  const { data, error } = await query;

  if (error) {
    console.error("[resources:getActiveRecommendations]", error);
    return [];
  }

  return (data ?? []) as ResourceRecommendation[];
}

// ── Dismiss / Act On Recommendation ──────────────────────

export async function dismissRecommendation(
  id: string
): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("resource_recommendations")
    .update({
      status: "dismissed",
      dismissed_at: new Date().toISOString(),
    })
    .eq("id", id);

  return { success: !error };
}

export async function actOnRecommendation(
  id: string
): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("resource_recommendations")
    .update({
      status: "acted_on",
      acted_on_at: new Date().toISOString(),
    })
    .eq("id", id);

  return { success: !error };
}
