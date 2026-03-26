import { requireParent } from "@/lib/auth/guards";
import { getMyFamily } from "@/lib/queries/portal";
import { createClient } from "@/lib/supabase/server";
import { BookPrivateClient } from "./book-private-client";
import { EmptyState } from "@/components/bam/empty-state";

export default async function BookPrivatePage() {
  const user = await requireParent();
  const supabase = await createClient();

  // ── Resolve family ───────────────────────────────────────────
  const family = await getMyFamily();
  if (!family) {
    return (
      <div className="space-y-8">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Book a Private Lesson
          </h1>
        </div>
        <EmptyState
          icon="*"
          title="No family profile found"
          description="Please contact the studio to set up your family profile before booking privates."
        />
      </div>
    );
  }

  // ── Fetch active booking approvals for this family ───────────
  const { data: approvalRows } = await supabase
    .from("teacher_booking_approvals")
    .select("id, teacher_id, student_ids, notes")
    .eq("family_id", family.id)
    .eq("is_active", true);

  const approvals = approvalRows ?? [];

  if (approvals.length === 0) {
    return (
      <div className="space-y-8">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-heading font-semibold text-charcoal">
            Book a Private Lesson
          </h1>
          <p className="mt-1 text-sm text-slate">
            Self-booking is not yet enabled for your family. Please contact the studio to get started.
          </p>
        </div>
        <EmptyState
          icon="*"
          title="Self-booking not available"
          description="Your studio has not yet enabled self-booking for your family. Reach out to the front desk or your teacher to request access."
        />
      </div>
    );
  }

  // ── Resolve teacher profiles + slot counts ───────────────────
  const teacherIds = [...new Set(approvals.map((a) => a.teacher_id))];

  const { data: teacherRows } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url")
    .in("id", teacherIds);

  const teacherProfiles = teacherRows ?? [];

  // Count published unbooked slots per teacher
  const slotCountMap: Record<string, number> = {};
  for (const tid of teacherIds) {
    const { count } = await supabase
      .from("teacher_availability")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", tid)
      .eq("is_published", true)
      .eq("is_booked", false);

    slotCountMap[tid] = count ?? 0;
  }

  // ── Build approved teachers array ────────────────────────────
  const approvedTeachers = approvals.map((approval) => {
    const profile = teacherProfiles.find((p) => p.id === approval.teacher_id);
    const name = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
      : "Unknown Teacher";

    return {
      id: approval.teacher_id,
      approvalId: approval.id,
      name,
      avatarUrl: profile?.avatar_url ?? null,
      slotCount: slotCountMap[approval.teacher_id] ?? 0,
      studentIds: approval.student_ids ?? [],
    };
  });

  // ── Resolve family students ──────────────────────────────────
  const { data: studentRows } = await supabase
    .from("students")
    .select("id, first_name, last_name, level")
    .eq("family_id", family.id)
    .eq("active", true)
    .order("first_name");

  const familyStudents = (studentRows ?? []).map((s) => ({
    id: s.id,
    name: [s.first_name, s.last_name].filter(Boolean).join(" ") || "Student",
    level: s.level ?? null,
  }));

  return (
    <div className="space-y-8">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Book a Private Lesson
        </h1>
        <p className="mt-1 text-sm text-slate">
          Choose a teacher, select your dancer, and pick a time.
        </p>
      </div>

      <BookPrivateClient
        approvedTeachers={approvedTeachers}
        familyStudents={familyStudents}
        tenantId={user.tenantId!}
        familyId={family.id}
      />
    </div>
  );
}
