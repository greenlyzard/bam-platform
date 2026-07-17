import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClassCatalog } from "@/lib/queries/enroll";
import { getMyStudents } from "@/lib/queries/portal";
import { getAssistantConfig } from "@/lib/assistant/config";
import { EnrollPageClient } from "./enroll-page-client";
import type { StudentOption } from "@/components/assistant/enrollment-cards/student-selection-card";

export const metadata = {
  title: "Enroll — Ballet Academy and Movement",
  description:
    "Find the right class and enroll in under 5 minutes — for yourself or your children.",
};

export default async function EnrollPage() {
  const tenantId = "84d98f72-c82f-414f-8b17-172b802f6993";
  const [classes, config, myStudents] = await Promise.all([
    getClassCatalog(),
    getAssistantConfig(tenantId),
    getMyStudents(), // [] for guests; drives the returning-family fork
  ]);

  const initialStudents: StudentOption[] = myStudents.map((s) => ({
    id: s.id,
    firstName: s.first_name,
    lastName: s.last_name,
    avatarUrl: s.avatar_url ?? null,
    currentLevel: s.current_level ?? null,
    enrolledClasses: [],
  }));

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();
  const studioName = tenant?.name ?? "Ballet Academy and Movement";

  // Footer contact + address. studio_settings is authenticated-only under RLS, so read
  // this public-display data server-side with the service role (never sent to the client).
  const admin = createAdminClient();
  const { data: settingsRow } = await admin
    .from("studio_settings")
    .select("*")
    .maybeSingle();
  // phone/email are added by 20260710120000_studio_settings_contact.sql; until the
  // generated types are regenerated they aren't on the Row, so read via an explicit shape.
  const contact = settingsRow as unknown as
    | { phone: string | null; email: string | null }
    | null;
  const phone = contact?.phone?.trim() || null;
  const email = contact?.email?.trim() || null;

  const { data: primaryLocation } = await admin
    .from("studio_locations")
    .select("address, city, state, zip")
    .eq("tenant_id", tenantId)
    .eq("is_primary", true)
    .maybeSingle();

  const cityStateZip = [
    [primaryLocation?.city, primaryLocation?.state].filter(Boolean).join(", "),
    primaryLocation?.zip,
  ]
    .filter(Boolean)
    .join(" ");
  const addressLine = [primaryLocation?.address, cityStateZip]
    .filter(Boolean)
    .join(" / ");

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
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <EnrollPageClient
          classes={classes}
          config={config}
          studioName={studioName}
          tenantId={tenantId}
          initialStudents={initialStudents}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-silver px-4 py-6 text-center">
        {(phone || email) && (
          <p className="text-xs text-mist flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            {phone && (
              <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="hover:text-charcoal transition-colors">
                {phone}
              </a>
            )}
            {phone && email && <span aria-hidden="true">·</span>}
            {email && (
              <a href={`mailto:${email}`} className="hover:text-charcoal transition-colors">
                {email}
              </a>
            )}
          </p>
        )}
        {addressLine && (
          <p className="mt-1 text-xs text-mist">{addressLine}</p>
        )}
      </footer>
    </div>
  );
}
