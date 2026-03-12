import { requireAdmin } from "@/lib/auth/guards";
import { getStudioSettings } from "@/lib/queries/studio-settings";
import { ThemeEditor } from "./theme-editor";

export default async function ThemeSettingsPage() {
  await requireAdmin();
  const settings = await getStudioSettings();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a
          href="/admin/dashboard"
          className="text-sm text-lavender hover:text-lavender-dark font-medium"
        >
          &larr; Dashboard
        </a>
      </div>

      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Theme Settings
        </h1>
        <p className="mt-1 text-sm text-slate">
          Customize the look and feel of your studio platform.
        </p>
      </div>

      <ThemeEditor
        initialStudioName={settings?.studio_name ?? "Ballet Academy & Movement"}
        initialPreset={settings?.theme_preset ?? "lavender-cream"}
        initialCustomColors={settings?.custom_colors ?? {}}
        initialHeadingFont={settings?.heading_font ?? "Cormorant Garamond"}
        initialBodyFont={settings?.body_font ?? "Montserrat"}
        initialLogoUrl={settings?.logo_url ?? ""}
        initialFaviconUrl={settings?.favicon_url ?? ""}
        initialAppIconUrl={settings?.app_icon_url ?? ""}
      />
    </div>
  );
}
