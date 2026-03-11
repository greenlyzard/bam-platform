"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const revalidate = (id?: string) => {
  revalidatePath("/admin/productions");
  if (id) revalidatePath(`/admin/productions/${id}`);
};

// ── Production CRUD ──────────────────────────────────────

const productionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  production_type: z.enum(["recital", "showcase", "competition", "mixed"]),
  season: z.string().optional(),
  performance_date: z.string().optional(),
  venue_name: z.string().optional(),
  venue_address: z.string().optional(),
  venue_directions: z.string().optional(),
  call_time: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  competition_org: z.string().optional(),
  competition_division: z.string().optional(),
  notes: z.string().optional(),
});

export async function createProduction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = productionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const d = parsed.data;
  const { data, error } = await supabase
    .from("productions")
    .insert({
      name: d.name,
      production_type: d.production_type,
      season: d.season || null,
      performance_date: d.performance_date || null,
      venue_name: d.venue_name || null,
      venue_address: d.venue_address || null,
      venue_directions: d.venue_directions || null,
      call_time: d.call_time || null,
      start_time: d.start_time || null,
      end_time: d.end_time || null,
      competition_org: d.competition_org || null,
      competition_division: d.competition_division || null,
      notes: d.notes || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[productions:create]", error);
    return { error: "Failed to create production" };
  }

  revalidate();
  return { success: true, id: data.id };
}

export async function updateProduction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = productionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const d = parsed.data;
  const { error } = await supabase
    .from("productions")
    .update({
      name: d.name,
      production_type: d.production_type,
      season: d.season || null,
      performance_date: d.performance_date || null,
      venue_name: d.venue_name || null,
      venue_address: d.venue_address || null,
      venue_directions: d.venue_directions || null,
      call_time: d.call_time || null,
      start_time: d.start_time || null,
      end_time: d.end_time || null,
      competition_org: d.competition_org || null,
      competition_division: d.competition_division || null,
      notes: d.notes || null,
    })
    .eq("id", id);

  if (error) {
    console.error("[productions:update]", error);
    return { error: "Failed to update production" };
  }

  revalidate(id);
  return { success: true };
}

export async function updateApprovalStatus(
  id: string,
  status: "draft" | "pending_review" | "approved" | "published"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const update: Record<string, unknown> = { approval_status: status };

  if (status === "approved" || status === "published") {
    update.approved_by = user.id;
    update.approved_at = new Date().toISOString();
    if (status === "published") update.is_published = true;
  }

  if (status === "draft" || status === "pending_review") {
    update.is_published = false;
  }

  const { error } = await supabase.from("productions").update(update).eq("id", id);

  if (error) {
    console.error("[productions:updateApproval]", error);
    return { error: "Failed to update status" };
  }

  revalidate(id);
  return { success: true };
}

export async function deleteProduction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("productions").delete().eq("id", id);

  if (error) {
    console.error("[productions:delete]", error);
    return { error: "Failed to delete production" };
  }

  revalidate();
  return { success: true };
}

// ── Dance CRUD ───────────────────────────────────────────

const danceSchema = z.object({
  title: z.string().min(1, "Title is required"),
  discipline: z.enum(["ballet", "jazz", "contemporary", "hip_hop", "lyrical", "tap", "musical_theatre", "pointe"]),
  level: z.string().optional(),
  duration_seconds: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
  choreographer_id: z.string().optional(),
});

export async function createDance(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = danceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const d = parsed.data;
  const { data, error } = await supabase
    .from("dances")
    .insert({
      title: d.title,
      discipline: d.discipline,
      level: d.level || null,
      duration_seconds: d.duration_seconds || null,
      notes: d.notes || null,
      choreographer_id: d.choreographer_id || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[productions:createDance]", error);
    return { error: "Failed to create dance" };
  }

  return { success: true, id: data.id };
}

// ── Production Dance (link dance to production) ──────────

const prodDanceSchema = z.object({
  dance_id: z.string().min(1, "Dance is required"),
  performance_type: z.enum(["recital", "competition", "showcase"]),
  performance_order: z.coerce.number().int().min(0).default(0),
  music_title: z.string().optional(),
  music_artist: z.string().optional(),
  music_duration_seconds: z.coerce.number().int().min(0).optional(),
  music_file_url: z.string().optional(),
  costume_description: z.string().optional(),
  costume_notes: z.string().optional(),
  costume_due_date: z.string().optional(),
  stage_notes: z.string().optional(),
  notes: z.string().optional(),
});

export async function addDanceToProduction(productionId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = prodDanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const d = parsed.data;
  const { error } = await supabase.from("production_dances").insert({
    production_id: productionId,
    dance_id: d.dance_id,
    performance_type: d.performance_type,
    performance_order: d.performance_order,
    music_title: d.music_title || null,
    music_artist: d.music_artist || null,
    music_duration_seconds: d.music_duration_seconds || null,
    music_file_url: d.music_file_url || null,
    costume_description: d.costume_description || null,
    costume_notes: d.costume_notes || null,
    costume_due_date: d.costume_due_date || null,
    stage_notes: d.stage_notes || null,
    notes: d.notes || null,
  });

  if (error) {
    if (error.code === "23505") return { error: "This dance is already in this production" };
    console.error("[productions:addDance]", error);
    return { error: "Failed to add dance" };
  }

  revalidate(productionId);
  return { success: true };
}

export async function removeDanceFromProduction(productionId: string, prodDanceId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("production_dances").delete().eq("id", prodDanceId);

  if (error) {
    console.error("[productions:removeDance]", error);
    return { error: "Failed to remove dance" };
  }

  revalidate(productionId);
  return { success: true };
}

// ── Casting ──────────────────────────────────────────────

export async function assignCasting(
  productionId: string,
  productionDanceId: string,
  studentId: string,
  role: string = "ensemble",
  isAlternate: boolean = false
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("casting").insert({
    production_dance_id: productionDanceId,
    student_id: studentId,
    role,
    is_alternate: isAlternate,
  });

  if (error) {
    if (error.code === "23505") return { error: "Student is already cast in this dance" };
    console.error("[productions:assignCasting]", error);
    return { error: "Failed to assign casting" };
  }

  revalidate(productionId);
  return { success: true };
}

export async function removeCasting(productionId: string, castingId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("casting").delete().eq("id", castingId);

  if (error) {
    console.error("[productions:removeCasting]", error);
    return { error: "Failed to remove casting" };
  }

  revalidate(productionId);
  return { success: true };
}

// ── Rehearsals ───────────────────────────────────────────

const rehearsalSchema = z.object({
  production_dance_id: z.string().min(1, "Dance is required"),
  rehearsal_date: z.string().min(1, "Date is required"),
  start_time: z.string().min(1, "Start time is required"),
  end_time: z.string().min(1, "End time is required"),
  location: z.string().optional(),
  location_address: z.string().optional(),
  location_directions: z.string().optional(),
  rehearsal_type: z.enum(["rehearsal", "dress_rehearsal", "tech_rehearsal", "spacing"]).default("rehearsal"),
  notes: z.string().optional(),
  is_mandatory: z.coerce.boolean().default(true),
});

export async function createRehearsal(productionId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const parsed = rehearsalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid data" };

  const d = parsed.data;
  const { error } = await supabase.from("rehearsals").insert({
    production_dance_id: d.production_dance_id,
    rehearsal_date: d.rehearsal_date,
    start_time: d.start_time,
    end_time: d.end_time,
    location: d.location || null,
    location_address: d.location_address || null,
    location_directions: d.location_directions || null,
    rehearsal_type: d.rehearsal_type,
    notes: d.notes || null,
    is_mandatory: d.is_mandatory,
  });

  if (error) {
    console.error("[productions:createRehearsal]", error);
    return { error: "Failed to create rehearsal" };
  }

  revalidate(productionId);
  return { success: true };
}

export async function updateRehearsalApproval(
  productionId: string,
  rehearsalId: string,
  status: "draft" | "pending_review" | "approved"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const update: Record<string, unknown> = { approval_status: status };
  if (status === "approved") {
    update.approved_by = user.id;
    update.approved_at = new Date().toISOString();
  }

  const { error } = await supabase.from("rehearsals").update(update).eq("id", rehearsalId);

  if (error) {
    console.error("[productions:updateRehearsalApproval]", error);
    return { error: "Failed to update rehearsal status" };
  }

  revalidate(productionId);
  return { success: true };
}

export async function deleteRehearsal(productionId: string, rehearsalId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("rehearsals").delete().eq("id", rehearsalId);

  if (error) {
    console.error("[productions:deleteRehearsal]", error);
    return { error: "Failed to delete rehearsal" };
  }

  revalidate(productionId);
  return { success: true };
}
