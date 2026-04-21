import { requireAuth } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

const SUPER_EMAIL = "derek@greenlyzard.com";

interface SettingsItem {
  label: string;
  description: string;
  href: string;
  icon: string;
}

const mySettings: SettingsItem[] = [
  {
    label: "My Profile",
    description: "Name, preferred name, email, photo",
    href: "/admin/settings/profile",
    icon: "◎",
  },
  {
    label: "Notifications",
    description: "Email, SMS, and push preferences",
    href: "/admin/settings/notifications",
    icon: "◇",
  },
  {
    label: "Password & Security",
    description: "Change password and security settings",
    href: "/admin/settings/security",
    icon: "◆",
  },
  {
    label: "Appearance",
    description: "Light/dark mode and display preferences",
    href: "/admin/settings/appearance",
    icon: "◑",
  },
];

const studioSettings: SettingsItem[] = [
  {
    label: "Studio Profile",
    description: "Name, address, phone, logo, brand color",
    href: "/admin/settings/studio",
    icon: "◈",
  },
  {
    label: "Business Hours",
    description: "Operating hours and schedule",
    href: "/admin/settings/hours",
    icon: "▥",
  },
  {
    label: "Billing & Payments",
    description: "Stripe, payment methods, tuition settings",
    href: "/admin/settings/billing",
    icon: "✦",
  },
  {
    label: "Integrations",
    description: "Stripe, Klaviyo, Twilio, and other services",
    href: "/admin/settings/integrations",
    icon: "↻",
  },
  {
    label: "Email & Communications",
    description: "Sender settings, templates, defaults",
    href: "/admin/settings/email",
    icon: "✉",
  },
  {
    label: "Disciplines",
    description: "Dance disciplines offered at the studio",
    href: "/admin/settings/disciplines",
    icon: "▸",
  },
  {
    label: "Curriculum",
    description: "Teaching methodologies and curriculum styles",
    href: "/admin/settings/curriculum",
    icon: "▹",
  },
  {
    label: "Studio Calendar",
    description: "Closure dates and schedule exceptions",
    href: "/admin/settings/studio-calendar",
    icon: "▦",
  },
  {
    label: "Compliance Settings",
    description: "Required documents, expiration rules",
    href: "/admin/settings/compliance",
    icon: "◆",
  },
  {
    label: "Pay Rates",
    description: "Default teacher pay rates by category",
    href: "/admin/settings/pay-rates",
    icon: "★",
  },
  {
    label: "Team Members",
    description: "Invite and manage admin team access",
    href: "/admin/settings/team",
    icon: "◉",
  },
  {
    label: "Icons Library",
    description: "Manage discipline and affiliation icons",
    href: "/admin/settings/icons",
    icon: "◎",
  },
  {
    label: "Class Fields",
    description: "Configure visible fields on the class list",
    href: "/admin/settings/class-fields",
    icon: "▦",
  },
  {
    label: "Theme & Branding",
    description: "Colors, fonts, and visual style",
    href: "/admin/settings/theme",
    icon: "◈",
  },
  {
    label: "Levels & Programs",
    description: "Manage class levels, programs, and sub-brands",
    href: "/admin/settings/levels",
    icon: "≡",
  },
  {
    label: "Seasons",
    description: "Manage studio seasons and registration windows",
    href: "/admin/settings/seasons",
    icon: "◷",
  },
];

const platformSettings: SettingsItem[] = [
  {
    label: "Roles & Permissions",
    description: "Manage user roles and view permission matrix",
    href: "/admin/settings/roles",
    icon: "◆",
  },
  {
    label: "Angelina AI Assistant",
    description: "Enable or disable the AI chat assistant",
    href: "/admin/settings/angelina",
    icon: "◈",
  },
  {
    label: "Module Control",
    description: "Enable/disable platform modules",
    href: "/admin/settings/platform/modules",
    icon: "◉",
  },
  {
    label: "Feature Flags",
    description: "Legacy feature flag management",
    href: "/admin/super",
    icon: "◇",
  },
  {
    label: "Tenant Management",
    description: "Multi-tenant configuration",
    href: "/admin/settings/platform/tenants",
    icon: "◈",
  },
];

export default async function SettingsPage() {
  const user = await requireAuth();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  const isDerek = profile?.email === SUPER_EMAIL;
  const isSuperAdmin = profile?.role === "super_admin";
  const isManager = isSuperAdmin || profile?.role === "admin";

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-charcoal">
          Settings
        </h1>
        <p className="mt-1 text-sm text-mist">
          Manage your account and studio configuration.
        </p>
      </div>

      <SettingsSection title="My Settings" items={mySettings} />
      {isManager && (
        <SettingsSection title="Studio Settings" items={studioSettings} />
      )}
      {(isDerek || isSuperAdmin) && (
        <SettingsSection title="Platform" items={platformSettings} />
      )}
    </div>
  );
}

function SettingsSection({
  title,
  items,
}: {
  title: string;
  items: SettingsItem[];
}) {
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-mist mb-3">
        {title}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-start gap-3 rounded-xl border border-silver bg-white p-4 hover:border-lavender hover:shadow-sm transition-all"
          >
            <span className="text-xl leading-none text-lavender mt-0.5">
              {item.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-charcoal">
                {item.label}
              </p>
              <p className="text-xs text-mist mt-0.5">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
