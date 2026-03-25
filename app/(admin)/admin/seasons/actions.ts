"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const seasonSchema = z.object({
  name: z.string().min(1, "Name is required"),
  program_type_id: z.string().uuid("Program type is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().optional(),
  is_ongoing: z.coerce.boolean().default(false),
  is_active: z.coerce.boolean().default(false),
  registration_open: z.coerce.boolean().default(false),
});

export async function createSeason(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  if (!tenantId) return { error: "Missing tenant" };

  const raw = {
    name: formData.get("name") as string,
    program_type_id: formData.get("program_type_id") as string,
    start_date: formData.get("start_date") as string,
    end_date: formData.get("end_date") as string || undefined,
    is_ongoing: formData.get("is_ongoing") === "true",
    is_active: formData.get("is_active") === "true",
    registration_open: formData.get("registration_open") === "true",
  };

  const parsed = seasonSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const d = parsed.data;

  // If ongoing, clear end_date
  const insertData: Record<string, unknown> = {
    tenant_id: tenantId,
    name: d.name,
    program_type_id: d.program_type_id,
    start_date: d.start_date,
    end_date: d.is_ongoing ? null : (d.end_date || null),
    is_ongoing: d.is_ongoing,
    is_active: d.is_active,
    registration_open: d.registration_open,
    display_priority: 999,
  };

  const { data, error } = await supabase
    .from("seasons")
    .insert(insertData)
    .select("id")
    .single();

  if (error) {
    console.error("[seasons:create]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/seasons");
  return { id: data.id };
}

export async function updateSeason(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const seasonId = formData.get("seasonId") as string;
  if (!seasonId) return { error: "Missing season ID" };

  const raw = {
    name: formData.get("name") as string,
    program_type_id: formData.get("program_type_id") as string,
    start_date: formData.get("start_date") as string,
    end_date: formData.get("end_date") as string || undefined,
    is_ongoing: formData.get("is_ongoing") === "true",
    is_active: formData.get("is_active") === "true",
    registration_open: formData.get("registration_open") === "true",
  };

  const parsed = seasonSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  const d = parsed.data;

  const { error } = await supabase
    .from("seasons")
    .update({
      name: d.name,
      program_type_id: d.program_type_id,
      start_date: d.start_date,
      end_date: d.is_ongoing ? null : (d.end_date || null),
      is_ongoing: d.is_ongoing,
      is_active: d.is_active,
      registration_open: d.registration_open,
      updated_at: new Date().toISOString(),
    })
    .eq("id", seasonId);

  if (error) {
    console.error("[seasons:update]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/seasons");
  return {};
}

export async function deleteSeason(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const seasonId = formData.get("seasonId") as string;
  if (!seasonId) return { error: "Missing season ID" };

  // Check for linked classes
  const { count } = await supabase
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("season_id", seasonId);

  if (count && count > 0) {
    return { error: `Cannot delete: ${count} class${count === 1 ? "" : "es"} assigned to this season. Reassign or remove them first.` };
  }

  const { error } = await supabase
    .from("seasons")
    .delete()
    .eq("id", seasonId);

  if (error) {
    console.error("[seasons:delete]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/seasons");
  return {};
}

export async function toggleSeasonActive(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const seasonId = formData.get("seasonId") as string;
  const isActive = formData.get("isActive") === "true";

  const { error } = await supabase
    .from("seasons")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", seasonId);

  if (error) {
    console.error("[seasons:toggleActive]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/seasons");
  return {};
}

export async function toggleRegistrationOpen(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const seasonId = formData.get("seasonId") as string;
  const registrationOpen = formData.get("registrationOpen") === "true";

  const { error } = await supabase
    .from("seasons")
    .update({ registration_open: registrationOpen, updated_at: new Date().toISOString() })
    .eq("id", seasonId);

  if (error) {
    console.error("[seasons:toggleRegistration]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/seasons");
  return {};
}

export async function updateSeasonPriority(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const seasonId = formData.get("seasonId") as string;
  const priority = parseInt(formData.get("priority") as string, 10);

  if (!seasonId || isNaN(priority)) return { error: "Invalid parameters" };

  const { error } = await supabase
    .from("seasons")
    .update({ display_priority: priority, updated_at: new Date().toISOString() })
    .eq("id", seasonId);

  if (error) {
    console.error("[seasons:updatePriority]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/seasons");
  return {};
}

export async function duplicateSeasonClasses(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sourceSeasonId = formData.get("sourceSeasonId") as string;
  const targetSeasonId = formData.get("targetSeasonId") as string;

  if (!sourceSeasonId || !targetSeasonId) return { error: "Missing season IDs" };

  // Fetch source classes
  const { data: sourceClasses, error: fetchErr } = await supabase
    .from("classes")
    .select("*")
    .eq("season_id", sourceSeasonId);

  if (fetchErr) {
    console.error("[seasons:duplicateClasses:fetch]", fetchErr);
    return { error: fetchErr.message };
  }

  if (!sourceClasses || sourceClasses.length === 0) {
    return { count: 0 };
  }

  let copiedCount = 0;

  for (const cls of sourceClasses) {
    // Build new class record — copy all fields except system ones
    const { id: _id, created_at: _ca, updated_at: _ua, season_id: _sid, ...rest } = cls;
    const newClass = {
      ...rest,
      season_id: targetSeasonId,
      is_active: true,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("classes")
      .insert(newClass)
      .select("id")
      .single();

    if (insertErr) {
      console.error("[seasons:duplicateClasses:insert]", insertErr);
      continue;
    }

    // Copy class_teachers
    const { data: teachers } = await supabase
      .from("class_teachers")
      .select("*")
      .eq("class_id", cls.id);

    if (teachers && teachers.length > 0) {
      const newTeachers = teachers.map((t) => {
        const { id: _tid, created_at: _tca, class_id: _cid, ...tRest } = t;
        return { ...tRest, class_id: inserted.id };
      });
      await supabase.from("class_teachers").insert(newTeachers);
    }

    copiedCount++;
  }

  revalidatePath("/admin/seasons");
  revalidatePath("/admin/classes");
  return { count: copiedCount };
}
