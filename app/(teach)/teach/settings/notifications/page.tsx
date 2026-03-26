"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const TYPES = [
  { key: "private_scheduled", label: "Private lesson booked" },
  { key: "private_confirmed", label: "Private lesson confirmed" },
  { key: "class_reminder", label: "Class reminder" },
  { key: "sub_coverage", label: "Substitute coverage request" },
  { key: "announcement", label: "Studio announcements" },
  { key: "channel_message", label: "New channel message" },
  { key: "direct_message", label: "New direct message" },
  { key: "payroll_approved", label: "Payroll approved" },
  { key: "payroll_flagged", label: "Timesheet flagged" },
  { key: "evaluation_published", label: "Evaluation published" },
];

const CHANNELS = ["in_app", "email", "sms", "push"] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_LABELS: Record<Channel, string> = {
  in_app: "In-App",
  email: "Email",
  sms: "SMS",
  push: "Push",
};

const DEFAULT_ON: Record<string, Channel[]> = {
  private_scheduled: ["in_app", "push"],
  private_confirmed: ["in_app", "email", "push"],
  class_reminder: ["in_app", "push"],
  sub_coverage: ["in_app", "email", "push"],
  announcement: ["in_app", "email", "push"],
  channel_message: ["in_app", "push"],
  direct_message: ["in_app", "push"],
  payroll_approved: ["in_app", "email", "push"],
  payroll_flagged: ["in_app", "email", "push"],
  evaluation_published: ["in_app", "email", "push"],
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-lavender/40 focus:ring-offset-2 ${
        disabled
          ? "cursor-not-allowed opacity-40 bg-silver/50"
          : checked
            ? "bg-lavender"
            : "bg-silver/60"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function TeacherNotificationPreferencesPage() {
  const supabase = createClient();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [pushPermission, setPushPermission] = useState<string>("default");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
    }
    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPreferences() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("notification_preferences")
      .select("notification_type, channel, enabled")
      .eq("user_id", user.id);

    const map: Record<string, boolean> = {};

    // Set defaults first
    for (const t of TYPES) {
      for (const ch of CHANNELS) {
        const key = `${t.key}_${ch}`;
        if (ch === "sms") {
          map[key] = false;
        } else {
          map[key] = (DEFAULT_ON[t.key] ?? []).includes(ch);
        }
      }
    }

    // Override with saved preferences
    if (data) {
      for (const row of data) {
        map[`${row.notification_type}_${row.channel}`] = row.enabled;
      }
    }

    setPrefs(map);
    setLoading(false);
  }

  async function togglePref(type: string, channel: Channel, value: boolean) {
    const key = `${type}_${channel}`;
    setPrefs((prev) => ({ ...prev, [key]: value }));
    setSaving(key);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("notification_preferences").upsert(
      {
        user_id: user.id,
        notification_type: type,
        channel,
        enabled: value,
      },
      { onConflict: "user_id,notification_type,channel" }
    );

    setSaving(null);
  }

  async function requestPushPermission() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPushPermission(result);

    if (result === "granted" && "serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        });
      } catch {
        // Push subscription failed silently
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="font-heading text-2xl font-semibold text-charcoal">
        Notification Preferences
      </h1>
      <p className="mt-1 text-sm text-slate">
        Choose how you want to be notified
      </p>

      {/* Push permission banner */}
      {pushPermission !== "granted" && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-lavender/30 bg-lavender/5 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-charcoal">
              Enable push notifications
            </p>
            <p className="text-xs text-slate">
              Get instant alerts on your device
            </p>
          </div>
          <button
            onClick={requestPushPermission}
            className="rounded-md bg-lavender px-4 py-2 text-sm font-medium text-white hover:bg-dark-lavender transition-colors"
          >
            Enable
          </button>
        </div>
      )}

      {/* Preferences matrix */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-silver/30">
              <th className="pb-3 pr-4 text-left text-xs font-medium uppercase tracking-wider text-slate">
                Notification
              </th>
              {CHANNELS.map((ch) => (
                <th
                  key={ch}
                  className="pb-3 px-3 text-center text-xs font-medium uppercase tracking-wider text-slate"
                >
                  {CHANNEL_LABELS[ch]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-silver/20">
            {TYPES.map((t) => (
              <tr key={t.key} className="group">
                <td className="py-4 pr-4 text-sm text-charcoal">{t.label}</td>
                {CHANNELS.map((ch) => {
                  const key = `${t.key}_${ch}`;
                  const isSms = ch === "sms";
                  const isPushDisabled =
                    ch === "push" && pushPermission !== "granted";

                  return (
                    <td key={ch} className="py-4 px-3 text-center">
                      {isSms ? (
                        <span className="text-[10px] text-mist">
                          Coming soon
                        </span>
                      ) : (
                        <div className="flex justify-center">
                          <Toggle
                            checked={prefs[key] ?? false}
                            onChange={(v) => togglePref(t.key, ch, v)}
                            disabled={isPushDisabled}
                          />
                          {saving === key && (
                            <span className="ml-1 text-xs text-slate animate-pulse">
                              ...
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
