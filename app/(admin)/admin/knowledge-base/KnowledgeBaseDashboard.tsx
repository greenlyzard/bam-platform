"use client";

import { useState, useEffect, useCallback } from "react";
import { SimpleSelect } from "@/components/ui/select";

interface Article {
  id: string;
  title: string;
  content?: string;
  category: string;
  audience: string[];
  is_active: boolean;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: "faq", label: "FAQ" },
  { value: "policy", label: "Policy" },
  { value: "curriculum", label: "Curriculum" },
  { value: "studio", label: "Studio" },
  { value: "ballet_terminology", label: "Ballet Terminology" },
  { value: "staff", label: "Staff" },
  { value: "production", label: "Production" },
];

const AUDIENCES = ["parent", "student", "teacher", "all"];

export function KnowledgeBaseDashboard() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("");
  const [editing, setEditing] = useState<Article | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("faq");
  const [formAudience, setFormAudience] = useState<string[]>(["all"]);
  const [formActive, setFormActive] = useState(true);

  const fetchArticles = useCallback(async () => {
    const res = await fetch("/api/knowledge-base");
    if (res.ok) {
      const json = await res.json();
      setArticles(json.articles);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  function resetForm() {
    setFormTitle("");
    setFormContent("");
    setFormCategory("faq");
    setFormAudience(["all"]);
    setFormActive(true);
    setEditing(null);
    setCreating(false);
  }

  async function startEdit(article: Article) {
    // Fetch full article with content
    const res = await fetch(`/api/knowledge-base/${article.id}`);
    if (res.ok) {
      const json = await res.json();
      const full = json.article;
      setEditing(full);
      setFormTitle(full.title);
      setFormContent(full.content);
      setFormCategory(full.category);
      setFormAudience(full.audience);
      setFormActive(full.is_active);
      setCreating(false);
    }
  }

  function startCreate() {
    resetForm();
    setCreating(true);
  }

  async function handleSave() {
    if (!formTitle.trim() || !formContent.trim()) return;
    setSaving(true);

    if (editing) {
      await fetch(`/api/knowledge-base/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          content: formContent,
          category: formCategory,
          audience: formAudience,
          is_active: formActive,
        }),
      });
    } else {
      await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          content: formContent,
          category: formCategory,
          audience: formAudience,
          is_active: formActive,
        }),
      });
    }

    setSaving(false);
    resetForm();
    await fetchArticles();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this article? Angelina will no longer reference it."))
      return;
    await fetch(`/api/knowledge-base/${id}`, { method: "DELETE" });
    if (editing?.id === id) resetForm();
    await fetchArticles();
  }

  async function handleToggleActive(article: Article) {
    await fetch(`/api/knowledge-base/${article.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !article.is_active }),
    });
    await fetchArticles();
  }

  function toggleAudience(value: string) {
    if (value === "all") {
      setFormAudience(["all"]);
      return;
    }
    const without = formAudience.filter((a) => a !== "all" && a !== value);
    if (formAudience.includes(value)) {
      setFormAudience(without.length > 0 ? without : ["all"]);
    } else {
      setFormAudience([...without, value]);
    }
  }

  const filtered = filterCategory
    ? articles.filter((a) => a.category === filterCategory)
    : articles;

  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-mist">
        Loading knowledge base...
      </div>
    );
  }

  // Show editor
  if (creating || editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-charcoal">
            {editing ? "Edit Article" : "New Article"}
          </h2>
          <button
            onClick={resetForm}
            className="text-sm text-mist hover:text-charcoal transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-4 rounded-xl border border-silver bg-white p-6">
          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">
              Title
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
              placeholder="e.g., What to Wear to Class"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">
              Category
            </label>
            <SimpleSelect
              value={formCategory}
              onValueChange={setFormCategory}
              options={CATEGORIES}
              className="w-full"
            />
          </div>

          {/* Audience */}
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">
              Audience
            </label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAudience(a)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    formAudience.includes(a)
                      ? "bg-lavender text-white"
                      : "bg-cloud text-slate hover:bg-silver"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="mb-1 block text-sm font-medium text-charcoal">
              Content
            </label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              rows={14}
              className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal font-mono placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender resize-y"
              placeholder="Write the article content here. Angelina will use this to answer parent and visitor questions."
            />
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 text-sm text-charcoal cursor-pointer">
            <input
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="rounded border-silver text-lavender focus:ring-lavender"
            />
            Active — Angelina can reference this article
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!formTitle.trim() || !formContent.trim() || saving}
              className="inline-flex items-center rounded-lg bg-lavender px-5 py-2 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : editing ? "Update Article" : "Create Article"}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-silver px-5 py-2 text-sm font-medium text-slate hover:bg-cloud transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={startCreate}
          className="inline-flex items-center rounded-lg bg-lavender px-4 py-2 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors"
        >
          + New Article
        </button>
        <SimpleSelect
          value={filterCategory}
          onValueChange={setFilterCategory}
          options={CATEGORIES}
          placeholder="All Categories"
        />
        <span className="text-xs text-mist">
          {filtered.length} article{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Article list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-silver bg-white p-12 text-center text-sm text-mist">
          No articles yet. Create one to give Angelina more knowledge.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((article) => (
            <div
              key={article.id}
              className={`flex items-center gap-4 rounded-xl border bg-white px-5 py-4 transition-colors ${
                article.is_active
                  ? "border-silver"
                  : "border-silver/50 opacity-60"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-charcoal truncate">
                    {article.title}
                  </h3>
                  {!article.is_active && (
                    <span className="rounded-full bg-mist/20 px-2 py-0.5 text-xs text-mist">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-mist">
                  <span className="rounded bg-cloud px-1.5 py-0.5">
                    {CATEGORIES.find((c) => c.value === article.category)
                      ?.label ?? article.category}
                  </span>
                  <span>
                    {article.audience.join(", ")}
                  </span>
                  <span>
                    Updated{" "}
                    {new Date(article.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(article)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    article.is_active
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-cloud text-mist hover:bg-silver"
                  }`}
                >
                  {article.is_active ? "Active" : "Inactive"}
                </button>
                <button
                  onClick={() => startEdit(article)}
                  className="rounded-lg bg-cloud px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-silver transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(article.id)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
