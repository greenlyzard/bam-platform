"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface TimelineItem {
  id: string;
  type: "thread" | "message";
  date: string;
  subject?: string;
  thread_type?: string;
  state?: string;
  channel?: string;
  contact_name?: string;
  message_count?: number;
  content?: string;
  channel_id?: string;
}

export default function CommunicationsTab({ teacherId }: { teacherId: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchData() {
      setLoading(true);

      const [threads, messages] = await Promise.all([
        supabase
          .from("communication_threads")
          .select("id, subject, thread_type, state, channel, contact_name, message_count, last_message_at")
          .or(`staff_user_id.eq.${teacherId},assigned_to.eq.${teacherId}`)
          .order("last_message_at", { ascending: false })
          .limit(20),
        supabase
          .from("channel_messages")
          .select("id, channel_id, content, message_type, created_at")
          .eq("sender_id", teacherId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const timeline: TimelineItem[] = [
        ...(threads.data || []).map((t: any) => ({
          id: t.id,
          type: "thread" as const,
          date: t.last_message_at,
          subject: t.subject,
          thread_type: t.thread_type,
          state: t.state,
          channel: t.channel,
          contact_name: t.contact_name,
          message_count: t.message_count,
        })),
        ...(messages.data || []).map((m: any) => ({
          id: m.id,
          type: "message" as const,
          date: m.created_at,
          content: m.content?.slice(0, 80),
          channel_id: m.channel_id,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setItems(timeline);
      setLoading(false);
    }

    fetchData();
  }, [teacherId]);

  if (loading) {
    return <div className="animate-pulse space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-cloud rounded-lg" />)}</div>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No communications history found for this staff member.</p>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={`${item.type}-${item.id}`} className="p-3 bg-white rounded-lg border border-cloud">
          {item.type === "thread" ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{item.subject || "No subject"}</p>
                <p className="text-xs text-slate-500">
                  {item.contact_name && <>{item.contact_name} &middot; </>}
                  {item.channel && <>{item.channel} &middot; </>}
                  {item.message_count} messages
                </p>
              </div>
              <div className="flex items-center gap-2">
                {item.thread_type && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-lavender/10 text-lavender">{item.thread_type}</span>
                )}
                {item.state && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    item.state === "open" ? "bg-success/10 text-success" :
                    item.state === "closed" ? "bg-cloud text-slate-400" :
                    "bg-gold/10 text-gold-dark"
                  }`}>
                    {item.state}
                  </span>
                )}
                <span className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString()}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">{item.content}{item.content && item.content.length >= 80 ? "..." : ""}</p>
                <p className="text-xs text-slate-400">Channel: {item.channel_id}</p>
              </div>
              <span className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
