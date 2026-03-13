import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

const SUPER_EMAIL = "derek@greenlyzard.com";

export default async function PlatformSettingsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (profile?.email !== SUPER_EMAIL && profile?.role !== "super_admin") {
    redirect("/admin/dashboard");
  }

  const items = [
    {
      label: "Module Control",
      description: "Enable/disable platform modules for all tenants or specific studios",
      href: "/admin/settings/platform/modules",
      icon: "◉",
    },
    {
      label: "Feature Flags",
      description: "Legacy feature flag toggles",
      href: "/admin/super",
      icon: "◇",
    },
    {
      label: "Tenant Management",
      description: "Multi-tenant configuration and studio setup",
      href: "/admin/settings/platform/tenants",
      icon: "◈",
    },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-charcoal">
          Platform
        </h1>
        <p className="mt-1 text-sm text-mist">
          System-level configuration. Only visible to platform administrators.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-start gap-3 rounded-xl border border-silver bg-white p-5 hover:border-lavender hover:shadow-sm transition-all"
          >
            <span className="text-2xl leading-none text-lavender mt-0.5">
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-charcoal">
                {item.label}
              </p>
              <p className="text-xs text-mist mt-1">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
