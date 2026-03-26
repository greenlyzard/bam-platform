import { requireParent } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { getAssistantConfig } from "@/lib/assistant/config";
import { getMyStudents } from "@/lib/queries/portal";
import { ReEnrollmentChat } from "./re-enrollment-chat";

export default async function ReEnrollPage() {
  const user = await requireParent();
  const supabase = await createClient();

  const [students, profile, settings] = await Promise.all([
    getMyStudents(),
    supabase
      .from("profiles")
      .select("first_name, tenant_id")
      .eq("user_id", user.id)
      .single()
      .then((r) => r.data),
    supabase
      .from("tenant_settings")
      .select("studio_name")
      .single()
      .then((r) => r.data),
  ]);

  const tenantId = profile?.tenant_id ?? "";
  const config = await getAssistantConfig(tenantId);
  const studioName = settings?.studio_name ?? "Ballet Academy & Movement";
  const parentFirstName = profile?.first_name ?? "there";

  // Enrich students with their current enrollments
  const enrichedStudents = await Promise.all(
    students.map(async (s: Record<string, unknown>) => {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id, classes(name, level)")
        .eq("student_id", s.id as string)
        .eq("status", "active");

      const enrolledClasses = (enrollments ?? []).map(
        (e: Record<string, unknown>) => {
          const cls = e.classes as Record<string, unknown> | null;
          return (cls?.name as string) ?? "Unknown";
        }
      );

      const levels = (enrollments ?? [])
        .map((e: Record<string, unknown>) => {
          const cls = e.classes as Record<string, unknown> | null;
          return cls?.level as string | null;
        })
        .filter(Boolean);

      return {
        id: s.id as string,
        firstName: s.first_name as string,
        lastName: s.last_name as string,
        avatarUrl: (s.avatar_url as string) ?? null,
        currentLevel: levels[0] ?? null,
        enrolledClasses,
      };
    })
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <ReEnrollmentChat
        config={config}
        studioName={studioName}
        tenantId={tenantId}
        parentFirstName={parentFirstName}
        students={enrichedStudents}
        userId={user.id}
      />
    </div>
  );
}
