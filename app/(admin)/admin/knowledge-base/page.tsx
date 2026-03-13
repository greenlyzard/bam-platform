import { requireAdmin } from "@/lib/auth/guards";
import { KnowledgeBaseDashboard } from "./KnowledgeBaseDashboard";

export default async function KnowledgeBasePage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-charcoal">
          Knowledge Base
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage articles that Angelina uses to answer questions accurately.
        </p>
      </div>
      <KnowledgeBaseDashboard />
    </div>
  );
}
