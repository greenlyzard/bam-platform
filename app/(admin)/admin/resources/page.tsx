import { requireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  getWeeklyUtilization,
  getTeacherLoadSummary,
} from "@/lib/resources/utilization";
import { getActiveRecommendations } from "@/lib/resources/recommendations";
import { ResourceGrid } from "./resource-grid";
import { RecommendationsFeed } from "./recommendations-feed";
import { TeacherLoadPanel } from "./teacher-load-panel";

export default async function ResourcesPage() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", "bam")
    .single();

  if (!tenant) {
    return (
      <div className="p-8 text-center text-slate">
        Tenant not configured.
      </div>
    );
  }

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());

  const [grid, recommendations, teacherLoads] = await Promise.all([
    getWeeklyUtilization(tenant.id, weekStart),
    getActiveRecommendations(tenant.id),
    getTeacherLoadSummary(tenant.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Resource Intelligence
        </h1>
        <p className="mt-1 text-sm text-slate">
          Room utilization, AI recommendations, and teacher workload analysis.
        </p>
        <Link
          href="/admin/resources/manage"
          className="inline-flex items-center mt-2 text-xs text-lavender hover:text-lavender-dark font-medium transition-colors"
        >
          Manage Resources →
        </Link>
      </div>

      {/* Weekly Room Grid */}
      <section>
        <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
          Weekly Room Utilization
        </h2>
        <ResourceGrid grid={grid} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* AI Recommendations */}
        <section>
          <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
            AI Recommendations ({recommendations.length})
          </h2>
          <RecommendationsFeed recommendations={recommendations} />
        </section>

        {/* Teacher Load */}
        <section>
          <h2 className="text-lg font-heading font-semibold text-charcoal mb-3">
            Teacher Workload
          </h2>
          <TeacherLoadPanel loads={teacherLoads} />
        </section>
      </div>
    </div>
  );
}
