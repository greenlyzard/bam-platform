import { ProductionForm } from "../production-form";

export const metadata = {
  title: "New Production — Studio Admin",
};

export default function NewProductionPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <a
          href="/admin/productions"
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          ← Back to Productions
        </a>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-charcoal">
          New Production
        </h1>
        <p className="mt-1 text-sm text-slate">
          Create a new recital, competition, showcase, or workshop.
        </p>
      </div>

      <ProductionForm />
    </div>
  );
}
