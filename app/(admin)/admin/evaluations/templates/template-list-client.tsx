"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTemplate, toggleTemplateActive, duplicateTemplate } from "./actions";

interface Template {
  id: string;
  name: string;
  slug: string;
  level_tag: string | null;
  program_tag: string | null;
  is_active: boolean;
  sectionCount: number;
  questionCount: number;
  created_at: string;
}

interface Props {
  templates: Template[];
  tenantId: string;
}

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";

export function TemplateListClient({ templates, tenantId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);

  async function handleNewTemplate() {
    const fd = new FormData();
    fd.set("tenant_id", tenantId);
    fd.set("name", "Untitled Template");
    const result = await createTemplate(fd);
    if (result?.id) {
      router.push(`/admin/evaluations/templates/${result.id}`);
    }
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    setTogglingId(id);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("is_active", String(!currentActive));
    await toggleTemplateActive(fd);
    setTogglingId(null);
    startTransition(() => router.refresh());
  }

  async function handleDuplicate(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    const result = await duplicateTemplate(fd);
    if (result?.id) {
      router.push(`/admin/evaluations/templates/${result.id}`);
    }
  }

  async function handleArchive(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("is_active", "false");
    await toggleTemplateActive(fd);
    setConfirmArchiveId(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/admin/evaluations"
        className="mb-4 inline-block text-sm text-lavender hover:underline"
      >
        &larr; Back to Evaluations
      </Link>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-charcoal">
            Evaluation Templates
          </h1>
          <p className="mt-1 text-sm text-grey">
            Create and manage evaluation forms for student assessments
          </p>
        </div>
        <button
          onClick={handleNewTemplate}
          disabled={isPending}
          className="rounded-lg bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-dark-lavender disabled:opacity-50"
        >
          + New Template
        </button>
      </div>

      {/* Empty state */}
      {templates.length === 0 ? (
        <div className="rounded-xl border border-silver bg-white p-12 text-center">
          <p className="text-grey">No templates. Create your first evaluation template.</p>
        </div>
      ) : (
        /* Table */
        <div className="overflow-x-auto rounded-xl border border-silver bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-silver bg-cream/40">
                <th className="px-4 py-3 font-medium text-charcoal">Template Name</th>
                <th className="px-4 py-3 font-medium text-charcoal">Level</th>
                <th className="px-4 py-3 font-medium text-charcoal">Program</th>
                <th className="px-4 py-3 font-medium text-charcoal text-center">Sections</th>
                <th className="px-4 py-3 font-medium text-charcoal text-center">Questions</th>
                <th className="px-4 py-3 font-medium text-charcoal text-center">Active</th>
                <th className="px-4 py-3 font-medium text-charcoal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-silver/50 last:border-0 hover:bg-cream/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/evaluations/templates/${t.id}`}
                      className="font-medium text-lavender hover:underline"
                    >
                      {t.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-grey">{fmtDate(t.created_at)}</p>
                  </td>
                  <td className="px-4 py-3">
                    {t.level_tag ? (
                      <span className="inline-block rounded-full bg-lavender/10 px-2 py-0.5 text-xs font-medium text-lavender">
                        {t.level_tag}
                      </span>
                    ) : (
                      <span className="text-xs text-grey">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.program_tag ? (
                      <span className="inline-block rounded-full bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">
                        {t.program_tag}
                      </span>
                    ) : (
                      <span className="text-xs text-grey">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-charcoal">{t.sectionCount}</td>
                  <td className="px-4 py-3 text-center text-charcoal">{t.questionCount}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleActive(t.id, t.is_active)}
                      disabled={togglingId === t.id}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        t.is_active ? "bg-lavender" : "bg-silver"
                      } ${togglingId === t.id ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                          t.is_active ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/evaluations/templates/${t.id}`}
                        className="rounded-md border border-silver px-2.5 py-1 text-xs font-medium text-charcoal hover:bg-cream"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDuplicate(t.id)}
                        disabled={isPending}
                        className="rounded-md border border-silver px-2.5 py-1 text-xs font-medium text-charcoal hover:bg-cream disabled:opacity-50"
                      >
                        Duplicate
                      </button>
                      {confirmArchiveId === t.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => handleArchive(t.id)}
                            className="rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmArchiveId(null)}
                            className="rounded-md px-2.5 py-1 text-xs text-grey hover:text-charcoal"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmArchiveId(t.id)}
                          className="rounded-md border border-silver px-2.5 py-1 text-xs font-medium text-grey hover:bg-cream hover:text-charcoal"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
