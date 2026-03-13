"use client";

import { useState, useEffect, useRef } from "react";

interface Contact {
  id: string;
  name: string;
  email: string;
  type: "family" | "lead" | "staff";
}

interface ComposeModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ComposeModal({ onClose, onSuccess }: ComposeModalProps) {
  const [toQuery, setToQuery] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Search contacts on query change
  useEffect(() => {
    if (toQuery.length < 2 || selectedContact) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/communications/contacts/search?q=${encodeURIComponent(toQuery)}`
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.contacts ?? []);
          setShowSuggestions(true);
        }
      } catch {
        // ignore search errors
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [toQuery, selectedContact]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function selectContact(contact: Contact) {
    setSelectedContact(contact);
    setToEmail(contact.email);
    setToName(contact.name);
    setToQuery(contact.name);
    setShowSuggestions(false);
  }

  function clearContact() {
    setSelectedContact(null);
    setToEmail("");
    setToName("");
    setToQuery("");
    inputRef.current?.focus();
  }

  async function handleSend() {
    const email = toEmail || toQuery;
    if (!email || !subject.trim() || !bodyHtml.trim()) {
      setError("To, Subject, and Message are required.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const payload: Record<string, string | null> = {
        to_email: email,
        to_name: toName || email,
        subject: subject.trim(),
        body_html: `<p>${bodyHtml.replace(/\n/g, "<br/>")}</p>`,
      };

      if (selectedContact?.type === "family") {
        payload.family_id = selectedContact.id;
      } else if (selectedContact?.type === "lead") {
        payload.lead_id = selectedContact.id;
      } else if (selectedContact?.type === "staff") {
        payload.staff_user_id = selectedContact.id;
      }

      const res = await fetch("/api/communications/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-gray-900">New Message</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3 p-4">
          {/* To field */}
          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
            {selectedContact ? (
              <div className="flex items-center gap-2 rounded border border-gray-300 px-3 py-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#9C8BBF]/10 px-2.5 py-0.5 text-sm text-[#6B5A99]">
                  {selectedContact.name}
                  <button
                    onClick={clearContact}
                    className="ml-1 text-[#6B5A99]/60 hover:text-[#6B5A99]"
                  >
                    ×
                  </button>
                </span>
                <span className="text-sm text-gray-500">{selectedContact.email}</span>
              </div>
            ) : (
              <input
                ref={inputRef}
                type="text"
                value={toQuery}
                onChange={(e) => setToQuery(e.target.value)}
                placeholder="Search contacts or enter email..."
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#9C8BBF] focus:outline-none focus:ring-1 focus:ring-[#9C8BBF]"
              />
            )}

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg"
              >
                {suggestions.map((c) => (
                  <button
                    key={`${c.type}-${c.id}`}
                    onClick={() => selectContact(c)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9C8BBF]/10 text-xs font-medium text-[#6B5A99]">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{c.name}</div>
                      <div className="truncate text-xs text-gray-500">{c.email}</div>
                    </div>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                      {c.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line..."
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#9C8BBF] focus:outline-none focus:ring-1 focus:ring-[#9C8BBF]"
            />
          </div>

          {/* Message body */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Message</label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={6}
              placeholder="Write your message..."
              className="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#9C8BBF] focus:outline-none focus:ring-1 focus:ring-[#9C8BBF]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button
            onClick={onClose}
            className="rounded px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="rounded bg-[#9C8BBF] px-4 py-2 text-sm font-medium text-white hover:bg-[#6B5A99] disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
