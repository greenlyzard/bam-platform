import { requireAdmin } from "@/lib/auth/guards";
import { getAllEmailTemplates } from "@/lib/queries/email-templates";

export default async function EmailTemplatesPage() {
  await requireAdmin();
  const templates = await getAllEmailTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Email Templates
        </h1>
        <p className="mt-1 text-sm text-slate">
          Manage transactional email templates sent to parents, teachers, and
          staff.
        </p>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white p-8 text-center text-sm text-mist">
          No email templates found. Run the migration to seed default templates.
        </div>
      ) : (
        <div className="rounded-xl border border-silver bg-white divide-y divide-silver">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-charcoal">{t.name}</h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.is_active
                        ? "bg-success/10 text-success"
                        : "bg-cloud text-mist"
                    }`}
                  >
                    {t.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                {t.description && (
                  <p className="text-sm text-slate truncate">
                    {t.description}
                  </p>
                )}
                <div className="mt-1 flex items-center gap-3 text-xs text-mist">
                  <span className="font-mono">{t.slug}</span>
                  {t.updated_at && (
                    <span>
                      Updated{" "}
                      {new Date(t.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </div>
              <a
                href={`/admin/emails/${t.slug}`}
                className="shrink-0 inline-flex h-9 items-center rounded-lg border border-silver px-4 text-sm font-medium text-slate hover:text-charcoal hover:border-lavender transition-colors"
              >
                Edit
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
