import { createClient } from "@/lib/supabase/server";
import { getClassCatalog } from "@/lib/queries/enroll";
import { getAssistantConfig } from "@/lib/assistant/config";
import { EnrollPageClient } from "./enroll-page-client";

export const metadata = {
  title: "Enroll — Ballet Academy and Movement",
  description:
    "Find the right class and enroll in under 5 minutes — for yourself or your children.",
};

export default async function EnrollPage() {
  const tenantId = "84d98f72-c82f-414f-8b17-172b802f6993";
  const [classes, config] = await Promise.all([
    getClassCatalog(),
    getAssistantConfig(tenantId),
  ]);

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();
  const studioName = tenant?.name ?? "Ballet Academy and Movement";

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-lavender py-6">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <a href="/" className="inline-block">
            <h1 className="font-heading text-xl font-semibold text-white tracking-wide">
              {studioName}
            </h1>
          </a>
          <p className="mt-1 text-sm text-white/80">
            San Clemente, California
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <EnrollPageClient classes={classes} config={config} studioName={studioName} tenantId={tenantId} />
      </main>

      {/* Footer */}
      <footer className="border-t border-silver py-6 text-center">
        <p className="text-xs text-mist">
          {studioName} · 400-C Camino De Estrella, San Clemente,
          CA 92672 · (949) 229-0846
        </p>
      </footer>
    </div>
  );
}
