"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GROUP_TYPES = [
  { value: "class", label: "Class" },
  { value: "production", label: "Production" },
  { value: "privates", label: "Privates" },
  { value: "studio_wide", label: "Studio-wide" },
  { value: "custom", label: "Custom" },
];

const CHAT_MODES = [
  { value: "broadcast", label: "Broadcast only" },
  { value: "two_way", label: "Two-way chat" },
  { value: "disabled", label: "Disabled" },
];

export function CreateGroupButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [groupType, setGroupType] = useState("custom");
  const [chatMode, setChatMode] = useState("broadcast");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setGroupType("custom");
    setChatMode("broadcast");
    setDescription("");
    setError(null);
  }

  async function submit() {
    if (!name.trim()) {
      setError("Group name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/communications/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          group_type: groupType,
          chat_mode: chatMode,
          description: description.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      reset();
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-lavender px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-lavender-dark"
      >
        + Create Group
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-xl text-charcoal">Create Group</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-2xl leading-none text-slate hover:text-charcoal"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-charcoal">
                  Group Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Nutcracker 2026"
                  className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-charcoal">
                  Group Type
                </label>
                <Select value={groupType} onValueChange={setGroupType}>
                  <SelectTrigger className="h-12 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-charcoal">
                  Chat Mode
                </label>
                <Select value={chatMode} onValueChange={setChatMode}>
                  <SelectTrigger className="h-12 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAT_MODES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-charcoal">
                  Description (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-silver px-3 py-2 text-base text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
                />
              </div>

              {error && <p className="text-sm text-error">{error}</p>}

              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="h-12 w-full rounded-xl bg-lavender text-base font-semibold text-white shadow-lg transition-colors hover:bg-lavender-dark disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
