import { createAdminClient } from "@/lib/supabase/admin";

interface AutoPostParams {
  tenantId: string;
  authorId: string;
  sessionId: string;
  studentNames: string[];
  teacherName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  studio: string | null;
}

/**
 * Auto-post a private session as an event card to the BAM PRIVATES group feed.
 * Idempotent-ish: looks up the privates group by tenant; safe to call multiple
 * times for the same session (will create duplicate posts — caller controls).
 */
export async function autoPostPrivateSession(params: AutoPostParams): Promise<void> {
  const supabase = createAdminClient();

  const { data: group } = await supabase
    .from("communication_groups")
    .select("id")
    .eq("tenant_id", params.tenantId)
    .eq("group_type", "privates")
    .limit(1)
    .maybeSingle();

  if (!group) {
    console.warn("[autoPostPrivateSession] no privates group for tenant", params.tenantId);
    return;
  }

  const studentLabel =
    params.studentNames.length > 0 ? params.studentNames.join(", ") : "Private Reservation";
  const location = params.studio ? `Studio ${params.studio}` : "BAM";
  const content = `${studentLabel} private session — ${location}`;

  const { error } = await supabase.from("group_posts").insert({
    tenant_id: params.tenantId,
    group_id: group.id,
    author_id: params.authorId,
    post_type: "event",
    content,
    is_auto_generated: true,
    related_session_id: params.sessionId,
    metadata: {
      event_date: params.sessionDate,
      start_time: params.startTime,
      end_time: params.endTime,
      location,
      session_id: params.sessionId,
      teacher_name: params.teacherName,
    },
  });

  if (error) {
    console.error("[autoPostPrivateSession] insert failed:", error);
  }
}
