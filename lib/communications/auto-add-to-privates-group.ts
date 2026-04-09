import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Ensure the BAM PRIVATES group exists for this tenant and add the
 * student's parent + the assigned teacher as members. Idempotent — duplicate
 * memberships are silently ignored.
 */
export async function autoAddToPrivatesGroup(
  tenantId: string,
  studentId: string,
  teacherId: string | null
): Promise<void> {
  const supabase = createAdminClient();

  // Find the BAM PRIVATES group for this tenant
  const { data: group } = await supabase
    .from("communication_groups")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("group_type", "privates")
    .limit(1)
    .maybeSingle();

  if (!group) {
    console.warn("[autoAddToPrivatesGroup] no privates group for tenant", tenantId);
    return;
  }

  // Resolve student's parent
  const { data: student } = await supabase
    .from("students")
    .select("parent_id")
    .eq("id", studentId)
    .maybeSingle();

  const userIds = new Set<string>();
  if (student?.parent_id) userIds.add(student.parent_id);
  if (teacherId) userIds.add(teacherId);

  if (userIds.size === 0) return;

  const rows = Array.from(userIds).map((uid) => ({
    tenant_id: tenantId,
    group_id: group.id,
    user_id: uid,
    role: "member",
    can_post: false,
  }));

  // Insert; ignore unique-violation duplicates
  const { error } = await supabase
    .from("communication_group_members")
    .upsert(rows, { onConflict: "group_id,user_id", ignoreDuplicates: true });

  if (error) {
    console.error("[autoAddToPrivatesGroup] upsert failed:", error);
  }
}
