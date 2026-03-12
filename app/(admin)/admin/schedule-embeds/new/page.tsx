import { requireAdmin } from "@/lib/auth/guards";
import { EmbedForm } from "../embed-form";

export default async function NewEmbedPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold text-charcoal">
          Create Schedule Embed
        </h1>
        <p className="mt-1 text-sm text-slate">
          Configure a new embeddable schedule widget
        </p>
      </div>
      <EmbedForm />
    </div>
  );
}
