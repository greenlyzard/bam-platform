import { requireAdmin } from "@/lib/auth/guards";
import { FamilyForm } from "../[id]/family-form";
import Link from "next/link";

export const metadata = { title: "New Family — Families" };

export default async function NewFamilyPage() {
  await requireAdmin();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/families"
          className="text-xs text-lavender hover:text-lavender-dark transition-colors"
        >
          &larr; Back to Families
        </Link>
        <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
          Add New Family
        </h1>
        <p className="mt-1 text-sm text-slate">
          Create a family record to associate students, contacts, and billing.
        </p>
      </div>

      <FamilyForm isNew />
    </div>
  );
}
