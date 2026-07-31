"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LocationType } from "@/lib/locations/validate";
import {
  describeRoomReferences,
  type RoomReferenceCounts,
} from "@/lib/rooms/references";

const TENANT_ID = "84d98f72-c82f-414f-8b17-172b802f6993";
const STUDIO_SETTINGS_ID = "807cadc5-405f-4d24-9225-ae8458a31577";

export async function updateStudioIdentity(payload: {
  studio_name: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  student_term_singular?: string;
  student_term_plural?: string;
  phone?: string | null;
  email?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  // Built as a variable (not an inline literal) so the new phone/email columns —
  // present at runtime after 20260710120000_studio_settings_contact.sql, but not yet in
  // the generated types — don't trip excess-property checks before types are regenerated.
  const updates = {
    studio_name: payload.studio_name,
    logo_light_url: payload.logo_light_url || null,
    logo_dark_url: payload.logo_dark_url || null,
    favicon_url: payload.favicon_url || null,
    student_term_singular: payload.student_term_singular || "Student",
    student_term_plural: payload.student_term_plural || "Students",
    phone: payload.phone?.trim() || null,
    email: payload.email?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("studio_settings")
    .update(updates)
    .eq("id", STUDIO_SETTINGS_ID);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function upsertLocation(payload: {
  id?: string;
  name: string;
  /**
   * Optional short label. Null means "no short form — fall back to name", and is
   * a legitimate stored value; an empty or whitespace-only input must land as
   * NULL, never as "", or the fallback stops firing and callers render a blank.
   */
  abbreviation?: string | null;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  is_primary?: boolean;
  location_type?: LocationType;
}): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  // If setting as primary, clear existing primary
  if (payload.is_primary) {
    await supabase
      .from("studio_locations")
      .update({ is_primary: false })
      .eq("tenant_id", TENANT_ID)
      .eq("is_primary", true);
  }

  // A variable, not an inline literal, for the same reason as updateStudioIdentity
  // above: `abbreviation` exists at runtime after
  // 20260731000001_location_abbreviation.sql but is absent from the generated
  // types until they are regenerated.
  const row = {
    tenant_id: TENANT_ID,
    name: payload.name,
    // Trim first: " " is 1 char and would otherwise pass the length check while
    // being blank. The DB constraint rejects it; this makes it a null instead.
    abbreviation: payload.abbreviation?.trim() || null,
    address: payload.address || null,
    city: payload.city || null,
    state: payload.state || null,
    zip: payload.zip || null,
    is_primary: payload.is_primary ?? false,
    is_active: true,
    location_type: payload.location_type ?? "studio",
  };

  if (payload.id) {
    const { error } = await supabase
      .from("studio_locations")
      .update(row)
      .eq("id", payload.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase.from("studio_locations").insert(row);
    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

export async function upsertRoom(payload: {
  id?: string;
  name: string;
  capacity?: number;
  color_hex?: string;
  /** Null is legitimate — a room can sit unassigned until an admin gives it a location. */
  location_id: string | null;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  // Only the admin-editable fields. `updated_at` is maintained by the
  // set_rooms_updated_at trigger, so it is deliberately not written here.
  const row = {
    tenant_id: TENANT_ID,
    name: payload.name,
    capacity: payload.capacity ?? null,
    color_hex: payload.color_hex || null,
    location_id: payload.location_id,
    notes: payload.notes || null,
  };

  if (payload.id) {
    // `is_active` / `is_bookable` are deliberately omitted from the update: editing a
    // deactivated room's name or location must not silently resurrect it. Activation
    // state is owned solely by toggleRoomActive.
    const { error } = await supabase.from("rooms").update(row).eq("id", payload.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("rooms")
      .insert({ ...row, is_active: true, is_bookable: true });
    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Count every row that points at a room, across all three referencing tables.
 *
 * Fails closed: an unreadable count is not a zero count. Callers must treat an
 * error as "unknown, therefore not deletable" — because the FKs are
 * ON DELETE SET NULL, guessing zero here would destroy history silently.
 */
async function countRoomReferences(
  supabase: ReturnType<typeof createAdminClient>,
  roomId: string
): Promise<{ counts: RoomReferenceCounts } | { error: string }> {
  const [classes, instances, templates] = await Promise.all([
    supabase
      .from("classes")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId),
    supabase
      .from("schedule_instances")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId),
    supabase
      .from("schedule_templates")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId),
  ]);

  for (const result of [classes, instances, templates]) {
    if (result.error) return { error: result.error.message };
    if (result.count === null) {
      return { error: "Could not read what references this room." };
    }
  }

  const counts: RoomReferenceCounts = {
    classes: classes.count ?? 0,
    schedule_instances: instances.count ?? 0,
    schedule_templates: templates.count ?? 0,
    total: 0,
  };
  counts.total =
    counts.classes + counts.schedule_instances + counts.schedule_templates;

  return { counts };
}

/**
 * Reference counts for one room, for the admin UI's delete affordance.
 *
 * Deletability is decided here, on the server, and never inferred client-side.
 */
export async function getRoomReferenceCounts(
  roomId: string
): Promise<
  | { success: true; counts: RoomReferenceCounts }
  | { success: false; error: string }
> {
  await requireAdmin();
  const supabase = createAdminClient();

  const result = await countRoomReferences(supabase, roomId);
  if ("error" in result) return { success: false, error: result.error };
  return { success: true, counts: result.counts };
}

/**
 * Permanently delete a room. Archived rooms only, and only at zero references.
 *
 * Two guards, both mandatory:
 *  1. The room must already be archived (`is_active = false`). Deleting
 *     straight out of the active list is never offered.
 *  2. Nothing may reference it. This count is re-read here, immediately before
 *     the delete, because the client's copy can be minutes stale — a class
 *     scheduled into this room since the page loaded would otherwise be
 *     silently unlinked by the ON DELETE SET NULL cascade.
 *
 * The re-read narrows the window to the gap between the count and the delete;
 * it cannot close it entirely without a DB-level constraint (which would need
 * a migration, and none is added here).
 */
export async function deleteRoom(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, is_active")
    .eq("id", id)
    .maybeSingle();

  if (roomError) return { success: false, error: roomError.message };
  if (!room) return { success: false, error: "Room not found." };
  if (room.is_active) {
    return { success: false, error: "Archive this room before deleting it." };
  }

  const result = await countRoomReferences(supabase, id);
  if ("error" in result) return { success: false, error: result.error };
  if (result.counts.total > 0) {
    return {
      success: false,
      error: `${describeRoomReferences(result.counts)} Cannot be deleted.`,
    };
  }

  const { error } = await supabase.from("rooms").delete().eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function toggleLocationActive(
  id: string,
  is_active: boolean
): Promise<{ success: boolean }> {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("studio_locations").update({ is_active }).eq("id", id);
  return { success: true };
}

export async function toggleRoomActive(
  id: string,
  is_active: boolean
): Promise<{ success: boolean }> {
  await requireAdmin();
  const supabase = createAdminClient();
  await supabase.from("rooms").update({ is_active }).eq("id", id);
  return { success: true };
}
