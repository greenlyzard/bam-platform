import { requireAdmin } from "@/lib/auth/guards";
import { RehearsalAdmin } from "./RehearsalAdmin";

export default async function AdminRehearsalsPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-charcoal">
          Rehearsal Schedule
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage rehearsal blocks. Changes save instantly.
        </p>
      </div>
      <RehearsalAdmin />
    </div>
  );
}
