"use client";

import { useState, useEffect, useCallback } from "react";

interface Conversation {
  id: string;
  session_id: string;
  role: string;
  lead_name: string | null;
  lead_email: string | null;
  lead_child_age: number | null;
  lead_child_name: string | null;
  lead_converted: boolean;
  messageCount: number;
  created_at: string;
  updated_at: string;
}

interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  limit: number;
}

type Tab = "leads" | "all" | "feedback";

export default function AngelinaDashboard() {
  const [tab, setTab] = useState<Tab>("leads");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [transcriptMessages, setTranscriptMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");
    if (tab === "leads") params.set("leads", "true");
    if (roleFilter) params.set("role", roleFilter);

    try {
      const res = await fetch(`/api/angelina/conversations?${params}`);
      const data: ConversationsResponse = await res.json();
      setConversations(data.conversations ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [tab, page, roleFilter]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  async function viewTranscript(conv: Conversation) {
    setSelectedConversation(conv);
    setTranscriptLoading(true);
    try {
      const res = await fetch(
        `/api/angelina/conversations?page=1&limit=1&role=${conv.role}`
      );
      const data = await res.json();
      // We need to fetch the full conversation with messages
      // For now, use a direct query
      const fullRes = await fetch(
        `/api/angelina/conversations?page=1&limit=50`
      );
      const fullData = await fullRes.json();
      const match = (fullData.conversations ?? []).find(
        (c: Conversation) => c.id === conv.id
      );
      // The list endpoint strips messages, so we'd need to add a detail endpoint
      // For now, show what we have
      setTranscriptMessages([]);
    } catch {
      setTranscriptMessages([]);
    } finally {
      setTranscriptLoading(false);
    }
  }

  // Stats
  const leadCount = conversations.filter((c) => c.lead_email).length;
  const convertedCount = conversations.filter((c) => c.lead_converted).length;
  const avgMessages =
    conversations.length > 0
      ? Math.round(
          conversations.reduce((s, c) => s + c.messageCount, 0) /
            conversations.length
        )
      : 0;

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-charcoal mb-6">
        Angelina — Conversations
      </h1>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Conversations" value={total} />
        <StatCard label="Leads Captured" value={leadCount} />
        <StatCard
          label="Conversion Rate"
          value={
            leadCount > 0
              ? `${Math.round((convertedCount / leadCount) * 100)}%`
              : "—"
          }
        />
        <StatCard label="Avg Messages" value={avgMessages} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-silver">
        {(["leads", "all", "feedback"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-lavender text-lavender-dark"
                : "border-transparent text-slate hover:text-charcoal"
            }`}
          >
            {t === "leads" ? "Leads" : t === "all" ? "All Conversations" : "Feedback"}
          </button>
        ))}
      </div>

      {/* Filter for "all" tab */}
      {tab === "all" && (
        <div className="flex gap-2 mb-4">
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="text-sm border border-silver rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="">All roles</option>
            <option value="public">Public</option>
            <option value="parent">Parent</option>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      )}

      {/* Feedback tab placeholder */}
      {tab === "feedback" && (
        <div className="text-center py-12 text-slate text-sm">
          Feedback analytics coming soon. Feedback is being collected on every
          Angelina response.
        </div>
      )}

      {/* Conversation list */}
      {tab !== "feedback" && (
        <>
          {loading ? (
            <div className="text-center py-8 text-slate text-sm">
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 text-slate text-sm">
              No conversations found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-silver text-left">
                    <th className="py-2 px-3 font-medium text-slate">Date</th>
                    <th className="py-2 px-3 font-medium text-slate">Role</th>
                    {tab === "leads" && (
                      <>
                        <th className="py-2 px-3 font-medium text-slate">
                          Name
                        </th>
                        <th className="py-2 px-3 font-medium text-slate">
                          Email
                        </th>
                        <th className="py-2 px-3 font-medium text-slate">
                          Child Age
                        </th>
                      </>
                    )}
                    <th className="py-2 px-3 font-medium text-slate">
                      Messages
                    </th>
                    <th className="py-2 px-3 font-medium text-slate">
                      Converted
                    </th>
                    <th className="py-2 px-3 font-medium text-slate" />
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-silver/50 hover:bg-cloud/50"
                    >
                      <td className="py-2 px-3 text-charcoal">
                        {new Date(c.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.role === "public"
                              ? "bg-teal-50 text-teal-700"
                              : c.role === "parent"
                                ? "bg-lavender/10 text-lavender-dark"
                                : c.role === "teacher"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-blue-50 text-blue-700"
                          }`}
                        >
                          {c.role}
                        </span>
                      </td>
                      {tab === "leads" && (
                        <>
                          <td className="py-2 px-3 text-charcoal">
                            {c.lead_name ?? "—"}
                          </td>
                          <td className="py-2 px-3 text-charcoal">
                            {c.lead_email ?? "—"}
                          </td>
                          <td className="py-2 px-3 text-charcoal">
                            {c.lead_child_age ?? "—"}
                          </td>
                        </>
                      )}
                      <td className="py-2 px-3 text-charcoal">
                        {c.messageCount}
                      </td>
                      <td className="py-2 px-3">
                        {c.lead_converted ? (
                          <span className="text-green-600 font-medium">
                            Yes
                          </span>
                        ) : (
                          <span className="text-mist">No</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => viewTranscript(c)}
                          className="text-xs text-lavender hover:text-lavender-dark"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-sm px-3 py-1 rounded border border-silver disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate py-1">
                Page {page} of {Math.ceil(total / 20)}
              </span>
              <button
                onClick={() =>
                  setPage((p) => Math.min(Math.ceil(total / 20), p + 1))
                }
                disabled={page >= Math.ceil(total / 20)}
                className="text-sm px-3 py-1 rounded border border-silver disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Transcript modal */}
      {selectedConversation && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-silver">
              <div>
                <p className="font-medium text-charcoal text-sm">
                  Conversation Transcript
                </p>
                <p className="text-xs text-slate">
                  {selectedConversation.role} &middot;{" "}
                  {new Date(selectedConversation.created_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedConversation(null)}
                className="text-slate hover:text-charcoal"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {transcriptLoading ? (
                <p className="text-sm text-slate text-center py-4">
                  Loading transcript...
                </p>
              ) : transcriptMessages.length === 0 ? (
                <p className="text-sm text-slate text-center py-4">
                  Transcript view requires a detail API endpoint. This will be
                  available in the next iteration. Messages:{" "}
                  {selectedConversation.messageCount}
                </p>
              ) : (
                transcriptMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-lavender text-white rounded-br-md"
                          : "bg-cloud text-charcoal rounded-bl-md"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-silver bg-white p-4">
      <p className="text-xs font-medium text-slate uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-heading font-semibold text-charcoal mt-1">
        {value}
      </p>
    </div>
  );
}
