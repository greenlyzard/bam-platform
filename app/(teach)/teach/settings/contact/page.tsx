"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Channel {
  id: string;
  channel_type: string;
  value: string;
  is_primary: boolean;
  email_opt_in: boolean | null;
  sms_opt_in: boolean | null;
}

export default function TeacherContactSettingsPage() {
  const supabase = createClient();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchChannels() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("contact_channels")
      .select("*")
      .eq("profile_id", user.id)
      .order("is_primary", { ascending: false });
    setChannels(data ?? []);
    setLoading(false);
  }

  const emails = channels.filter((c) => c.channel_type === "email");
  const phones = channels.filter((c) => c.channel_type === "sms" || c.channel_type === "phone");

  async function makePrimary(channelId: string, channelType: string) {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("contact_channels")
      .update({ is_primary: false })
      .eq("profile_id", user.id)
      .eq("channel_type", channelType);
    await supabase
      .from("contact_channels")
      .update({ is_primary: true })
      .eq("id", channelId);
    await fetchChannels();
    setSaving(false);
  }

  async function removeChannel(channelId: string) {
    if (!confirm("Remove this contact method?")) return;
    setSaving(true);
    await supabase.from("contact_channels").delete().eq("id", channelId);
    await fetchChannels();
    setSaving(false);
  }

  async function toggleEmailOptIn(channelId: string, current: boolean | null) {
    setSaving(true);
    await supabase
      .from("contact_channels")
      .update({ email_opt_in: !(current ?? true) })
      .eq("id", channelId);
    await fetchChannels();
    setSaving(false);
  }

  async function addEmail() {
    if (!newEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      alert("Please enter a valid email address.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const isPrimary = emails.length === 0;
    await supabase.from("contact_channels").insert({
      profile_id: user.id,
      channel_type: "email",
      value: newEmail.trim().toLowerCase(),
      is_primary: isPrimary,
      tenant_id: "84d98f72-c82f-414f-8b17-172b802f6993",
    });
    setNewEmail("");
    await fetchChannels();
    setSaving(false);
  }

  function normalizePhoneLocal(raw: string): string | null {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    if (raw.startsWith("+1") && digits.length === 11) return `+${digits}`;
    return null;
  }

  async function addPhone() {
    if (!newPhone.trim()) return;
    const normalized = normalizePhoneLocal(newPhone);
    if (!normalized) {
      alert("Please enter a valid US phone number.");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const isPrimary = phones.length === 0;
    await supabase.from("contact_channels").insert({
      profile_id: user.id,
      channel_type: "sms",
      value: normalized,
      is_primary: isPrimary,
      tenant_id: "84d98f72-c82f-414f-8b17-172b802f6993",
    });
    setNewPhone("");
    await fetchChannels();
    setSaving(false);
  }

  function smsOptBadge(ch: Channel) {
    if (ch.sms_opt_in === true) return <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Opted In</span>;
    if (ch.sms_opt_in === false) return <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Opted Out</span>;
    return <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">Unknown</span>;
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-heading text-charcoal mb-6">Contact Information</h1>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-10">
      <h1 className="text-2xl font-heading text-charcoal">Contact Information</h1>

      {/* Email Addresses */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-charcoal">Email Addresses</h2>
        {emails.length === 0 && (
          <p className="text-sm text-gray-500">No email addresses on file.</p>
        )}
        <ul className="space-y-3">
          {emails.map((ch) => (
            <li key={ch.id} className="flex items-center justify-between bg-white rounded-lg border border-silver px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-charcoal">{ch.value}</span>
                {ch.is_primary && (
                  <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-lavender/20 text-dark-lavender">Primary</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ch.email_opt_in !== false}
                    onChange={() => toggleEmailOptIn(ch.id, ch.email_opt_in)}
                    className="rounded border-gray-300"
                    disabled={saving}
                  />
                  Marketing
                </label>
                {!ch.is_primary && (
                  <button onClick={() => makePrimary(ch.id, "email")} disabled={saving} className="text-xs text-lavender hover:underline">
                    Make Primary
                  </button>
                )}
                {!ch.is_primary && (
                  <button onClick={() => removeChannel(ch.id)} disabled={saving} className="text-xs text-red-500 hover:underline">
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Add email address"
            className="flex-1 border border-silver rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20"
          />
          <button
            onClick={addEmail}
            disabled={saving || !newEmail.trim()}
            className="px-4 py-1.5 text-sm bg-lavender text-white rounded-md hover:bg-dark-lavender disabled:opacity-50"
          >
            + Add
          </button>
        </div>
      </section>

      {/* Phone Numbers */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-charcoal">Phone Numbers</h2>
        {phones.length === 0 && (
          <p className="text-sm text-gray-500">No phone numbers on file.</p>
        )}
        <ul className="space-y-3">
          {phones.map((ch) => (
            <li key={ch.id} className="flex items-center justify-between bg-white rounded-lg border border-silver px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-charcoal">{ch.value}</span>
                {ch.is_primary && (
                  <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-lavender/20 text-dark-lavender">Primary</span>
                )}
                {smsOptBadge(ch)}
              </div>
              <div className="flex items-center gap-2">
                {!ch.is_primary && (
                  <button onClick={() => makePrimary(ch.id, ch.channel_type)} disabled={saving} className="text-xs text-lavender hover:underline">
                    Make Primary
                  </button>
                )}
                {!ch.is_primary && (
                  <button onClick={() => removeChannel(ch.id)} disabled={saving} className="text-xs text-red-500 hover:underline">
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Add phone number"
            className="flex-1 border border-silver rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20"
          />
          <button
            onClick={addPhone}
            disabled={saving || !newPhone.trim()}
            className="px-4 py-1.5 text-sm bg-lavender text-white rounded-md hover:bg-dark-lavender disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        <p className="text-xs text-gray-500">
          To stop receiving SMS messages, reply STOP to any message. Reply START to resubscribe.
        </p>
      </section>
    </div>
  );
}
