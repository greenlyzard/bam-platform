"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const TENANT_ID = "84d98f72-c82f-414f-8b17-172b802f6993";
const STUDIO_SETTINGS_ID = "807cadc5-405f-4d24-9225-ae8458a31577";

export async function updateStudioIdentity(payload: {
  studio_name: string;
  logo_url: string | null;
  favicon_url: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("studio_settings")
    .update({
      studio_name: payload.studio_name,
      logo_url: payload.logo_url || null,
      favicon_url: payload.favicon_url || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", STUDIO_SETTINGS_ID);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function upsertLocation(payload: {
  id?: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  is_primary?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // If setting as primary, clear existing primary
  if (payload.is_primary) {
    await supabase
      .from("studio_locations")
      .update({ is_primary: false })
      .eq("tenant_id", TENANT_ID)
      .eq("is_primary", true);
  }

  const row = {
    tenant_id: TENANT_ID,
    name: payload.name,
    address: payload.address || null,
    city: payload.city || null,
    state: payload.state || null,
    zip: payload.zip || null,
    is_primary: payload.is_primary ?? false,
    is_active: true,
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
  location_id: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  const row = {
    tenant_id: TENANT_ID,
    name: payload.name,
    capacity: payload.capacity ?? null,
    color_hex: payload.color_hex || null,
    location_id: payload.location_id,
    notes: payload.notes || null,
    is_active: true,
    is_bookable: true,
  };

  if (payload.id) {
    const { error } = await supabase.from("rooms").update(row).eq("id", payload.id);
    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabase.from("rooms").insert(row);
    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

export async function toggleLocationActive(
  id: string,
  is_active: boolean
): Promise<{ success: boolean }> {
  const supabase = createAdminClient();
  await supabase.from("studio_locations").update({ is_active }).eq("id", id);
  return { success: true };
}

export async function toggleRoomActive(
  id: string,
  is_active: boolean
): Promise<{ success: boolean }> {
  const supabase = createAdminClient();
  await supabase.from("rooms").update({ is_active }).eq("id", id);
  return { success: true };
}
