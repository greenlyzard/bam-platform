"use client";

import { useState, useEffect } from "react";

interface ClassOption {
  id: string;
  name: string;
  level: string;
}

interface StaffSender {
  id: string;
  name: string;
}

export function AnnouncementForm() {
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [audience, setAudience] = useState("all_parents");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [channel, setChannel] = useState("email");
  const [senderAlias, setSenderAlias] = useState("studio");
  const [staffSenders, setStaffSenders] = useState<StaffSender[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Load staff senders on mount
  useEffect(() => {
    fetch("/api/admin/staff-senders")
      .then((r) => r.json())
      .then((data) => {
        if (data.senders) setStaffSenders(data.senders);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (audience === "class") {
      fetch("/api/admin/classes")
        .then((r) => r.json())
        .then((data) => {
          if (data.classes) setClasses(data.classes);
        })
        .catch(() => {});
    }
  }, [audience]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !bodyHtml.trim()) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/communications/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body_html: bodyHtml.trim(),
          audience,
          audience_filter:
            audience === "class" && selectedClassIds.length > 0
              ? { class_ids: selectedClassIds }
              : undefined,
          channel,
          sender_name:
            senderAlias !== "studio"
              ? staffSenders.find((s) => s.id === senderAlias)?.name
              : undefined,
          send: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({ type: "error", message: data.error ?? "Failed to send" });
      } else {
        setResult({
          type: "success",
          message: `Announcement sent to ${data.recipient_count ?? 0} recipients.`,
        });
        setTitle("");
        setBodyHtml("");
      }
    } catch {
      setResult({ type: "error", message: "Network error" });
    } finally {
      setSending(false);
    }
  }

  function toggleClass(classId: string) {
    setSelectedClassIds((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId]
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Spring Recital Details"
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
          required
        />
      </div>

      {/* Send As */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">
          Send As
        </label>
        <select
          value={senderAlias}
          onChange={(e) => setSenderAlias(e.target.value)}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
        >
          {staffSenders.map((sender) => (
            <option key={sender.id} value={sender.id}>
              {sender.name}
            </option>
          ))}
        </select>
        {senderAlias !== "studio" && (
          <p className="mt-1 text-xs text-mist">
            Will appear as &ldquo;
            {staffSenders.find((s) => s.id === senderAlias)?.name} via Ballet
            Academy and Movement&rdquo;
          </p>
        )}
      </div>

      {/* Body */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">
          Message
        </label>
        <textarea
          value={bodyHtml}
          onChange={(e) => setBodyHtml(e.target.value)}
          placeholder="Write your announcement here... HTML is supported for formatting."
          rows={8}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender resize-y"
          required
        />
        <p className="mt-1 text-xs text-mist">
          You can use basic HTML tags for formatting: &lt;p&gt;, &lt;strong&gt;,
          &lt;em&gt;, &lt;br&gt;
        </p>
      </div>

      {/* Audience */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-1">
          Audience
        </label>
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
        >
          <option value="all_parents">All Parents</option>
          <option value="class">Specific Classes</option>
          <option value="teachers">Teachers Only</option>
          <option value="all">Everyone (Parents + Teachers)</option>
        </select>
      </div>

      {/* Class selector */}
      {audience === "class" && (
        <div>
          <label className="block text-sm font-medium text-charcoal mb-2">
            Select Classes
          </label>
          {classes.length === 0 ? (
            <p className="text-sm text-mist">Loading classes...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-silver p-3">
              {classes.map((cls) => (
                <label
                  key={cls.id}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedClassIds.includes(cls.id)}
                    onChange={() => toggleClass(cls.id)}
                    className="rounded border-silver text-lavender focus:ring-lavender"
                  />
                  <span className="text-charcoal">
                    {cls.name}{" "}
                    <span className="text-mist">({cls.level})</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Channel */}
      <div>
        <label className="block text-sm font-medium text-charcoal mb-2">
          Delivery Channel
        </label>
        <div className="flex gap-4">
          {[
            { value: "email", label: "Email" },
            { value: "in_app", label: "In-App Only" },
            { value: "both", label: "Email + In-App" },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="radio"
                name="channel"
                value={opt.value}
                checked={channel === opt.value}
                onChange={(e) => setChannel(e.target.value)}
                className="text-lavender focus:ring-lavender"
              />
              <span className="text-charcoal">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Preview */}
      {bodyHtml.trim() && (
        <div>
          <p className="text-sm font-medium text-charcoal mb-2">Preview</p>
          <div className="rounded-lg border border-silver bg-white p-4">
            <h3 className="font-heading text-lg font-semibold text-charcoal mb-2">
              {title || "Untitled"}
            </h3>
            <div
              className="text-sm text-charcoal leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            result.type === "success"
              ? "bg-success/10 text-success"
              : "bg-error/10 text-error"
          }`}
        >
          {result.message}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={sending || !title.trim() || !bodyHtml.trim()}
        className="inline-flex h-10 items-center rounded-lg bg-lavender px-6 text-sm font-semibold text-white hover:bg-lavender-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {sending ? "Sending..." : "Send Announcement"}
      </button>
    </form>
  );
}
