import { createClient } from "@/lib/supabase/server";

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+1") && digits.length === 11) return `+${digits}`;
  return null;
}

export async function getPrimaryChannel(
  profileId: string,
  channelType: "email" | "sms" | "phone"
) {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("contact_channels")
      .select("*")
      .eq("profile_id", profileId)
      .eq("channel_type", channelType)
      .eq("is_primary", true)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

export async function getAllChannels(profileId: string) {
  const grouped: { email: any[]; sms: any[]; phone: any[] } = {
    email: [],
    sms: [],
    phone: [],
  };
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("contact_channels")
      .select("*")
      .eq("profile_id", profileId);
    for (const row of data ?? []) {
      const key = row.channel_type as keyof typeof grouped;
      if (key in grouped) grouped[key].push(row);
    }
    return grouped;
  } catch {
    return grouped;
  }
}

export async function setPrimaryChannel(channelId: string) {
  const supabase = await createClient();
  const { data: channel, error } = await supabase
    .from("contact_channels")
    .select("*")
    .eq("id", channelId)
    .single();
  if (error || !channel) return { error: "Channel not found" };

  await supabase
    .from("contact_channels")
    .update({ is_primary: false })
    .eq("profile_id", channel.profile_id)
    .eq("channel_type", channel.channel_type)
    .neq("id", channelId);

  await supabase
    .from("contact_channels")
    .update({ is_primary: true })
    .eq("id", channelId);

  return { success: true };
}

export async function addChannel(
  profileId: string,
  channelType: string,
  value: string,
  tenantId: string,
  source?: string
) {
  try {
    const supabase = await createClient();
    let normalizedValue = value;

    if (channelType === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return { error: "Invalid email format" };
    } else if (channelType === "sms" || channelType === "phone") {
      const phone = normalizePhone(value);
      if (!phone) return { error: "Invalid phone number" };
      normalizedValue = phone;
    }

    const { count } = await supabase
      .from("contact_channels")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .eq("channel_type", channelType);

    const isPrimary = (count ?? 0) === 0;

    const { data, error } = await supabase
      .from("contact_channels")
      .insert({
        profile_id: profileId,
        channel_type: channelType,
        value: normalizedValue,
        tenant_id: tenantId,
        is_primary: isPrimary,
        ...(source ? { source } : {}),
      })
      .select()
      .single();

    if (error) return { error: error.message };
    return { data };
  } catch {
    return { error: "Failed to add channel" };
  }
}

export async function removeChannel(channelId: string) {
  try {
    const supabase = await createClient();
    const { data: channel, error } = await supabase
      .from("contact_channels")
      .select("*")
      .eq("id", channelId)
      .single();
    if (error || !channel) return { error: "Channel not found" };

    const { count } = await supabase
      .from("contact_channels")
      .select("*", { count: "exact", head: true })
      .eq("profile_id", channel.profile_id)
      .eq("channel_type", channel.channel_type);

    if ((count ?? 0) <= 1) {
      return { error: `Cannot remove the only ${channel.channel_type} channel` };
    }

    await supabase.from("contact_channels").delete().eq("id", channelId);
    return { success: true };
  } catch {
    return { error: "Failed to remove channel" };
  }
}

export async function checkOptIn(
  profileId: string,
  channelType: "email" | "sms"
) {
  try {
    const channel = await getPrimaryChannel(profileId, channelType);
    if (!channel) return false;
    if (channelType === "email") return channel.email_opt_in !== false;
    return channel.sms_opt_in === true;
  } catch {
    return false;
  }
}

export async function handleStop(phoneE164: string, tenantId: string) {
  try {
    const supabase = await createClient();
    await supabase
      .from("contact_channels")
      .update({
        sms_opt_in: false,
        sms_opted_out_at: new Date().toISOString(),
        sms_opt_source: "quo_stop",
      })
      .eq("value", phoneE164)
      .eq("channel_type", "sms")
      .eq("tenant_id", tenantId);
    return { success: true };
  } catch {
    return { error: "Failed to process stop" };
  }
}

export async function handleStart(phoneE164: string, tenantId: string) {
  try {
    const supabase = await createClient();
    await supabase
      .from("contact_channels")
      .update({
        sms_opt_in: true,
        sms_opted_in_at: new Date().toISOString(),
        sms_opt_source: "quo_start",
      })
      .eq("value", phoneE164)
      .eq("channel_type", "sms")
      .eq("tenant_id", tenantId);
    return { success: true };
  } catch {
    return { error: "Failed to process start" };
  }
}

export async function matchPhoneToProfile(
  phoneE164: string,
  tenantId: string
): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("contact_channels")
      .select("profile_id")
      .eq("value", phoneE164)
      .eq("tenant_id", tenantId)
      .in("channel_type", ["sms", "phone"])
      .limit(1)
      .maybeSingle();
    return data?.profile_id ?? null;
  } catch {
    return null;
  }
}
