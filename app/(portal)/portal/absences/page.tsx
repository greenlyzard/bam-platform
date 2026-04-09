import { requireParent } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { AbsenceForm } from "./absence-form";

export default async function ReportAbsencePage() {
  const user = await requireParent();
  const supabase = createAdminClient();

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name")
    .eq("parent_id", user.id)
    .eq("active", true)
    .order("first_name");

  const list = (students ?? []).map((s) => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
  }));

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="font-heading text-3xl text-charcoal">Report Absence</h1>
      <p className="mt-1 text-sm text-slate">
        Let your teacher know your dancer will miss class.
      </p>
      <div className="mt-6">
        <AbsenceForm students={list} />
      </div>
    </div>
  );
}
