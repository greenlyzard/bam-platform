import { requireAdmin } from "@/lib/auth/guards";
import Link from "next/link";
import { NewPrivateClient } from "./new-private-client";

export default async function NewPrivatePage() {
  const user = await requireAdmin();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link
          href="/admin/privates"
          className="text-sm text-lavender hover:text-lavender-dark"
        >
          &larr; Back to Privates
        </Link>
        <h1 className="mt-2 text-2xl font-heading font-semibold text-charcoal">
          Book Private Session
        </h1>
        <p className="mt-1 text-sm text-slate">
          Schedule a new private lesson for a student.
        </p>
      </div>
      <NewPrivateClient tenantId={user.tenantId!} />
    </div>
  );
}
