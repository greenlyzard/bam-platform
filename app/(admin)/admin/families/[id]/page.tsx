import { requireAdmin } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import {
  getFamilyById,
  getFamilyStudents,
  getFamilyContacts,
  getFamilyEnrollments,
} from "@/lib/queries/families";
import { FamilyForm } from "./family-form";
import { CommunicationsTab } from "@/components/communications/CommunicationsTab";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const family = await getFamilyById(id);
  return {
    title: family ? `${family.family_name} — Families` : "Family Detail",
  };
}

export default async function FamilyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [family, students, contacts, enrollments] = await Promise.all([
    getFamilyById(id),
    getFamilyStudents(id),
    getFamilyContacts(id),
    getFamilyEnrollments(id),
  ]);

  if (!family) notFound();

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
          {family.family_name}
        </h1>
      </div>

      <FamilyForm
        family={family}
        students={students}
        contacts={contacts}
        enrollments={enrollments as never[]}
      />

      <CommunicationsTab familyId={id} />
    </div>
  );
}
