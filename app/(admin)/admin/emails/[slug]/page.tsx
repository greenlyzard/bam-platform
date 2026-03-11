import { requireAdmin } from "@/lib/auth/guards";
import { getEmailTemplateBySlug } from "@/lib/queries/email-templates";
import { notFound } from "next/navigation";
import { EmailEditor } from "./email-editor";

export default async function EditEmailTemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAdmin();
  const { slug } = await params;
  const template = await getEmailTemplateBySlug(slug);

  if (!template) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a
          href="/admin/emails"
          className="text-sm text-lavender hover:text-lavender-dark font-medium"
        >
          &larr; All Templates
        </a>
      </div>

      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          {template.name}
        </h1>
        {template.description && (
          <p className="mt-1 text-sm text-slate">{template.description}</p>
        )}
        <p className="mt-0.5 text-xs text-mist font-mono">{template.slug}</p>
      </div>

      <EmailEditor template={template} />
    </div>
  );
}
