"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Location actions ─────────────────────────────────────

const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  is_primary: z.coerce.boolean().default(false),
  is_active: z.coerce.boolean().default(true),
});

export async function createLocation(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  if (!tenantId) return { error: "Missing tenant" };

  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    zip: formData.get("zip") || undefined,
    is_primary: formData.get("is_primary") === "true",
    is_active: formData.get("is_active") === "true",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" };

  const d = parsed.data;

  // If marking as primary, unset other primaries for this tenant
  if (d.is_primary) {
    await supabase
      .from("studio_locations")
      .update({ is_primary: false })
      .eq("tenant_id", tenantId);
  }

  const { data, error } = await supabase
    .from("studio_locations")
    .insert({
      tenant_id: tenantId,
      name: d.name,
      address: d.address || null,
      city: d.city || null,
      state: d.state || null,
      zip: d.zip || null,
      is_primary: d.is_primary,
      is_active: d.is_active,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[locations:create]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/resources/manage");
  return { id: data.id };
}

export async function updateLocation(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const locationId = formData.get("locationId") as string;
  const tenantId = formData.get("tenant_id") as string;
  if (!locationId) return { error: "Missing location ID" };

  const parsed = locationSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    zip: formData.get("zip") || undefined,
    is_primary: formData.get("is_primary") === "true",
    is_active: formData.get("is_active") === "true",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" };

  const d = parsed.data;

  if (d.is_primary && tenantId) {
    await supabase
      .from("studio_locations")
      .update({ is_primary: false })
      .eq("tenant_id", tenantId)
      .neq("id", locationId);
  }

  const { error } = await supabase
    .from("studio_locations")
    .update({
      name: d.name,
      address: d.address || null,
      city: d.city || null,
      state: d.state || null,
      zip: d.zip || null,
      is_primary: d.is_primary,
      is_active: d.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", locationId);

  if (error) {
    console.error("[locations:update]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/resources/manage");
  return {};
}

export async function toggleLocationActive(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const locationId = formData.get("locationId") as string;
  const isActive = formData.get("isActive") === "true";

  const { error } = await supabase
    .from("studio_locations")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", locationId);

  if (error) return { error: error.message };

  revalidatePath("/admin/resources/manage");
  return {};
}

// ── Resource actions ─────────────────────────────────────

const resourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(["room", "equipment", "other"]),
  location_id: z.string().uuid().optional().nullable(),
  is_portable: z.coerce.boolean().default(false),
  color: z.string().default("lavender"),
  capacity: z.coerce.number().int().min(0).optional().nullable(),
  description: z.string().optional().nullable(),
  is_active: z.coerce.boolean().default(true),
});

export async function createResource(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const tenantId = formData.get("tenant_id") as string;
  if (!tenantId) return { error: "Missing tenant" };

  const parsed = resourceSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    location_id: formData.get("location_id") || null,
    is_portable: formData.get("is_portable") === "true",
    color: formData.get("color") || "lavender",
    capacity: formData.get("capacity") ? parseInt(formData.get("capacity") as string) : null,
    description: formData.get("description") || null,
    is_active: formData.get("is_active") === "true",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" };

  const d = parsed.data;

  // Get max sort_order
  const { data: maxRow } = await supabase
    .from("studio_resources")
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from("studio_resources")
    .insert({
      tenant_id: tenantId,
      name: d.name,
      type: d.type,
      location_id: d.is_portable ? null : (d.location_id || null),
      is_portable: d.is_portable,
      color: d.color,
      capacity: d.type === "room" ? (d.capacity ?? null) : null,
      description: d.description || null,
      is_active: d.is_active,
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[resources:create]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/resources/manage");
  return { id: data.id };
}

export async function updateResource(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const resourceId = formData.get("resourceId") as string;
  if (!resourceId) return { error: "Missing resource ID" };

  const parsed = resourceSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    location_id: formData.get("location_id") || null,
    is_portable: formData.get("is_portable") === "true",
    color: formData.get("color") || "lavender",
    capacity: formData.get("capacity") ? parseInt(formData.get("capacity") as string) : null,
    description: formData.get("description") || null,
    is_active: formData.get("is_active") === "true",
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" };

  const d = parsed.data;

  const { error } = await supabase
    .from("studio_resources")
    .update({
      name: d.name,
      type: d.type,
      location_id: d.is_portable ? null : (d.location_id || null),
      is_portable: d.is_portable,
      color: d.color,
      capacity: d.type === "room" ? (d.capacity ?? null) : null,
      description: d.description || null,
      is_active: d.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", resourceId);

  if (error) {
    console.error("[resources:update]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/resources/manage");
  return {};
}

export async function deleteResource(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const resourceId = formData.get("resourceId") as string;
  if (!resourceId) return { error: "Missing resource ID" };

  // Check for assignments
  const { count } = await supabase
    .from("studio_resource_assignments")
    .select("id", { count: "exact", head: true })
    .eq("resource_id", resourceId);

  if (count && count > 0) {
    return { error: `Cannot delete: ${count} class assignment${count === 1 ? "" : "s"} use this resource. Remove assignments first.` };
  }

  const { error } = await supabase
    .from("studio_resources")
    .delete()
    .eq("id", resourceId);

  if (error) {
    console.error("[resources:delete]", error);
    return { error: error.message };
  }

  revalidatePath("/admin/resources/manage");
  return {};
}

export async function toggleResourceActive(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const resourceId = formData.get("resourceId") as string;
  const isActive = formData.get("isActive") === "true";

  const { error } = await supabase
    .from("studio_resources")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", resourceId);

  if (error) return { error: error.message };

  revalidatePath("/admin/resources/manage");
  return {};
}

export async function updateResourceOrder(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const resourceId = formData.get("resourceId") as string;
  const sortOrder = parseInt(formData.get("sortOrder") as string, 10);

  if (!resourceId || isNaN(sortOrder)) return { error: "Invalid parameters" };

  const { error } = await supabase
    .from("studio_resources")
    .update({ sort_order: sortOrder, updated_at: new Date().toISOString() })
    .eq("id", resourceId);

  if (error) return { error: error.message };

  revalidatePath("/admin/resources/manage");
  return {};
}
