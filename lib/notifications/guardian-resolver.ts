import { createClient } from "@/lib/supabase/server";

export interface NotificationRecipient {
  profileId: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  relationship: string;
  isPrimary: boolean;
  isBilling: boolean;
  isEmergency: boolean;
}

/**
 * Resolve notification recipients for a student via student_guardians.
 * Falls back to students.parent_id if no guardians are found.
 *
 * @param studentId - The student to resolve recipients for
 * @param channel - 'email' or 'sms' — filters by opt-in preference
 */
export async function getNotificationRecipients(
  studentId: string,
  channel: "email" | "sms"
): Promise<NotificationRecipient[]> {
  const supabase = await createClient();

  // Query student_guardians with profile info
  const { data: guardians } = await supabase
    .from("student_guardians")
    .select("id, profile_id, relationship, is_primary, is_billing, is_emergency, portal_access")
    .eq("student_id", studentId);

  if (guardians && guardians.length > 0) {
    const profileIds = guardians.map((g) => g.profile_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, phone, email_opt_in, sms_opt_in")
      .in("id", profileIds);

    const profileMap: Record<string, {
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      phone: string | null;
      email_opt_in: boolean;
      sms_opt_in: boolean;
    }> = {};
    for (const p of profiles ?? []) {
      profileMap[p.id] = p;
    }

    return guardians
      .filter((g) => {
        if (!g.portal_access) return false;
        const profile = profileMap[g.profile_id];
        if (!profile) return false;

        if (channel === "email") {
          return profile.email_opt_in && !!profile.email;
        }
        return profile.sms_opt_in && !!profile.phone;
      })
      .map((g) => {
        const profile = profileMap[g.profile_id];
        return {
          profileId: g.profile_id,
          email: profile?.email ?? null,
          phone: profile?.phone ?? null,
          firstName: profile?.first_name ?? null,
          lastName: profile?.last_name ?? null,
          relationship: g.relationship,
          isPrimary: g.is_primary,
          isBilling: g.is_billing,
          isEmergency: g.is_emergency,
        };
      });
  }

  // Fallback: use students.parent_id
  const { data: student } = await supabase
    .from("students")
    .select("parent_id")
    .eq("id", studentId)
    .single();

  if (!student?.parent_id) return [];

  const { data: parent } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone, email_opt_in, sms_opt_in")
    .eq("id", student.parent_id)
    .single();

  if (!parent) return [];

  if (channel === "email" && (!parent.email_opt_in || !parent.email)) return [];
  if (channel === "sms" && (!parent.sms_opt_in || !parent.phone)) return [];

  return [
    {
      profileId: parent.id,
      email: parent.email,
      phone: parent.phone,
      firstName: parent.first_name,
      lastName: parent.last_name,
      relationship: "parent",
      isPrimary: true,
      isBilling: true,
      isEmergency: true,
    },
  ];
}

/**
 * Get billing notification recipients for a student.
 * Only returns guardians where is_billing=true.
 * Falls back to primary guardian if no billing guardian is set.
 */
export async function getBillingRecipients(
  studentId: string,
  channel: "email" | "sms"
): Promise<NotificationRecipient[]> {
  const all = await getNotificationRecipients(studentId, channel);
  const billing = all.filter((r) => r.isBilling);
  if (billing.length > 0) return billing;

  // Fallback to primary
  const primary = all.filter((r) => r.isPrimary);
  if (primary.length > 0) return primary;

  // Last resort: first guardian
  return all.length > 0 ? [all[0]] : [];
}

/**
 * Get emergency contacts for a student.
 */
export async function getEmergencyContacts(
  studentId: string
): Promise<NotificationRecipient[]> {
  const supabase = await createClient();

  const { data: guardians } = await supabase
    .from("student_guardians")
    .select("id, profile_id, relationship, is_primary, is_billing, is_emergency")
    .eq("student_id", studentId)
    .eq("is_emergency", true);

  if (!guardians || guardians.length === 0) {
    // Fallback: return all guardians
    return getNotificationRecipients(studentId, "email");
  }

  const profileIds = guardians.map((g) => g.profile_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone")
    .in("id", profileIds);

  const profileMap: Record<string, { first_name: string | null; last_name: string | null; email: string | null; phone: string | null }> = {};
  for (const p of profiles ?? []) {
    profileMap[p.id] = p;
  }

  return guardians.map((g) => {
    const profile = profileMap[g.profile_id];
    return {
      profileId: g.profile_id,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      firstName: profile?.first_name ?? null,
      lastName: profile?.last_name ?? null,
      relationship: g.relationship,
      isPrimary: g.is_primary,
      isBilling: g.is_billing,
      isEmergency: g.is_emergency,
    };
  });
}
