"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Member {
  id: string;
  user_id: string;
  role: string;
  name: string;
  avatar: string | null;
}

interface SearchResult {
  id: string;
  name: string;
  email: string | null;
  role: string;
  avatar_url: string | null;
}

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MemberSidebar({ groupId, members }: { groupId: string; members: Member[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const memberIdSet = new Set(members.map((m) => m.user_id));

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/profiles/search?q=${encodeURIComponent(query.trim())}`
        );
        const json = await res.json();
        setResults(json.profiles ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function addMember(profileId: string) {
    setPendingId(profileId);
    try {
      await fetch(`/api/admin/communications/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId }),
      });
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function removeMember(profileId: string) {
    setPendingId(profileId);
    try {
      await fetch(
        `/api/admin/communications/groups/${groupId}/members/${profileId}`,
        { method: "DELETE" }
      );
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="rounded-xl border border-silver bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-charcoal">
          Members ({members.length})
        </h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-xs font-semibold text-lavender hover:text-lavender-dark"
        >
          {adding ? "Done" : "+ Add"}
        </button>
      </div>

      {adding && (
        <div className="mb-3 space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="h-12 w-full rounded-md border border-silver bg-white px-3 text-base text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-2 focus:ring-lavender/20"
          />
          {searching && <p className="text-xs text-mist">Searching…</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-mist">No matches.</p>
          )}
          {results.length > 0 && (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {results.map((r) => {
                const already = memberIdSet.has(r.id);
                const initials = initialsFor(r.name);
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-cloud"
                  >
                    {r.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender/10 text-xs font-semibold text-lavender-dark">
                        {initials || "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-charcoal">{r.name}</p>
                      <p className="text-[11px] text-mist">{r.role}</p>
                    </div>
                    {already ? (
                      <span className="text-[11px] text-mist">Member</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addMember(r.id)}
                        disabled={pendingId === r.id}
                        className="rounded-md bg-lavender px-2 py-1 text-[11px] font-semibold text-white hover:bg-lavender-dark disabled:opacity-50"
                      >
                        {pendingId === r.id ? "…" : "Add"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-xs text-mist">No members yet.</p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const initials = initialsFor(m.name);
            return (
              <li key={m.id} className="flex items-center gap-2">
                {m.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lavender/10 text-xs font-semibold text-lavender-dark">
                    {initials || "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-charcoal">{m.name}</p>
                  <p className="text-[11px] text-mist">{m.role}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeMember(m.user_id)}
                  disabled={pendingId === m.user_id}
                  className="text-[11px] text-slate hover:text-error disabled:opacity-50"
                  title="Remove"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
