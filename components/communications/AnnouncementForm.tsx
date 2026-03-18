"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

// ── Types ───────────────────────────────────────────────────────

interface ClassOption {
  id: string;
  name: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
}

interface StaffSender {
  id: string;
  name: string;
}

interface PersonResult {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AnnouncementFormProps {
  userRole: string;
  userId: string;
}

// ── Helpers ─────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTime12h(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${ampm}` : `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatClassLabel(cls: ClassOption): string {
  if (cls.day_of_week != null && cls.start_time && cls.end_time) {
    const day = DAY_NAMES[cls.day_of_week];
    return `${day} ${formatTime12h(cls.start_time)}\u2013${formatTime12h(cls.end_time)} \u00b7 ${cls.name}`;
  }
  return cls.name;
}

// ── Component ───────────────────────────────────────────────────

export function AnnouncementForm({ userRole, userId }: AnnouncementFormProps) {
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [audience, setAudience] = useState("all_parents");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [channel, setChannel] = useState("email");
  const [senderAlias, setSenderAlias] = useState("studio");
  const [staffSenders, setStaffSenders] = useState<StaffSender[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classPopoverOpen, setClassPopoverOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Specific People state
  const [selectedPeople, setSelectedPeople] = useState<PersonResult[]>([]);
  const [personSearch, setPersonSearch] = useState("");
  const [personResults, setPersonResults] = useState<PersonResult[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin = userRole === "admin" || userRole === "super_admin";

  // Filter senders based on role
  const filteredSenders = useMemo(() => {
    if (isAdmin) return staffSenders;
    return staffSenders.filter((s) => s.id === "studio" || s.id === userId);
  }, [staffSenders, isAdmin, userId]);

  // Load staff senders on mount
  useEffect(() => {
    fetch("/api/admin/staff-senders")
      .then((r) => r.json())
      .then((data) => {
        if (data.senders) setStaffSenders(data.senders);
      })
      .catch(() => {});
  }, []);

  // Load classes when audience is "class"
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

  // Debounced person search
  const searchPeople = useCallback((query: string) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (query.length < 2) {
      setPersonResults([]);
      setSearchingPeople(false);
      return;
    }
    setSearchingPeople(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/profiles/search?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        if (data.profiles) setPersonResults(data.profiles);
      } catch {
        /* ignore */
      } finally {
        setSearchingPeople(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    searchPeople(personSearch);
  }, [personSearch, searchPeople]);

  // Build audience_filter for payload
  function buildAudienceFilter() {
    if (audience === "class" && selectedClassIds.length > 0) {
      return { class_ids: selectedClassIds };
    }
    if (audience === "specific_people" && selectedPeople.length > 0) {
      return { profile_ids: selectedPeople.map((p) => p.id) };
    }
    return undefined;
  }

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
          audience_filter: buildAudienceFilter(),
          channel,
          sender_name:
            senderAlias !== "studio"
              ? filteredSenders.find((s) => s.id === senderAlias)?.name
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
        setSelectedClassIds([]);
        setSelectedPeople([]);
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

  function addPerson(person: PersonResult) {
    if (!selectedPeople.some((p) => p.id === person.id)) {
      setSelectedPeople((prev) => [...prev, person]);
    }
    setPersonSearch("");
    setPersonResults([]);
  }

  function removePerson(personId: string) {
    setSelectedPeople((prev) => prev.filter((p) => p.id !== personId));
  }

  // Filter out already-selected people from search results
  const filteredPersonResults = personResults.filter(
    (r) => !selectedPeople.some((p) => p.id === r.id)
  );

  // Summary of selected classes for the trigger button
  const classSelectionLabel =
    selectedClassIds.length === 0
      ? "Select classes..."
      : selectedClassIds.length === 1
        ? formatClassLabel(classes.find((c) => c.id === selectedClassIds[0])!)
        : `${selectedClassIds.length} classes selected`;

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
        <Select value={senderAlias} onValueChange={setSenderAlias}>
          <SelectTrigger>
            <SelectValue placeholder="Select sender" />
          </SelectTrigger>
          <SelectContent>
            {filteredSenders.map((sender) => (
              <SelectItem key={sender.id} value={sender.id}>
                {sender.name}
              </SelectItem>
            ))}
            {filteredSenders.length === 0 && (
              <SelectItem value="studio" disabled>
                Loading...
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        {senderAlias !== "studio" && (
          <p className="mt-1 text-xs text-mist">
            Will appear as &ldquo;
            {filteredSenders.find((s) => s.id === senderAlias)?.name} via Ballet
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
        <Select value={audience} onValueChange={setAudience}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_parents">All Parents</SelectItem>
            <SelectItem value="class">Specific Classes</SelectItem>
            <SelectItem value="specific_people">Specific People</SelectItem>
            <SelectItem value="teachers">Teachers Only</SelectItem>
            <SelectItem value="all">Everyone (Parents + Teachers)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Class multi-select (Popover + Command with checkboxes) */}
      {audience === "class" && (
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Select Classes
          </label>
          {classes.length === 0 ? (
            <p className="text-sm text-mist py-2">Loading classes...</p>
          ) : (
            <>
              <Popover open={classPopoverOpen} onOpenChange={setClassPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 w-full items-center justify-between rounded-lg border border-silver bg-white px-3 py-2 text-sm text-charcoal focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender"
                  >
                    <span className={selectedClassIds.length === 0 ? "text-mist" : ""}>
                      {classSelectionLabel}
                    </span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      className="ml-2 shrink-0 text-mist"
                    >
                      <path
                        d="M3 4.5L6 7.5L9 4.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0">
                  <Command>
                    <CommandInput placeholder="Search classes..." />
                    <CommandList>
                      <CommandEmpty>No classes found.</CommandEmpty>
                      <CommandGroup>
                        {classes.map((cls) => {
                          const isSelected = selectedClassIds.includes(cls.id);
                          const label = formatClassLabel(cls);
                          return (
                            <CommandItem
                              key={cls.id}
                              value={label}
                              onSelect={() => toggleClass(cls.id)}
                            >
                              <div
                                className={`mr-2 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                  isSelected
                                    ? "border-lavender bg-lavender text-white"
                                    : "border-silver"
                                }`}
                              >
                                {isSelected && (
                                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                    <path
                                      d="M2 6L5 9L10 3"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                              </div>
                              <span className="truncate">{label}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedClassIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedClassIds.map((id) => {
                    const cls = classes.find((c) => c.id === id);
                    if (!cls) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-lavender/10 px-2.5 py-1 text-xs text-lavender-dark"
                      >
                        {cls.name}
                        <button
                          type="button"
                          onClick={() => toggleClass(id)}
                          className="ml-0.5 rounded-full p-0.5 hover:bg-lavender/20 transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Specific People selector */}
      {audience === "specific_people" && (
        <div>
          <label className="block text-sm font-medium text-charcoal mb-1">
            Add Recipients
          </label>
          <div className="relative">
            <div className="flex items-center rounded-lg border border-silver bg-white focus-within:border-lavender focus-within:ring-1 focus-within:ring-lavender">
              <svg
                className="ml-3 h-4 w-4 shrink-0 text-mist"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full bg-transparent px-3 py-2 text-sm text-charcoal placeholder:text-mist outline-none"
              />
              {searchingPeople && (
                <span className="mr-3 text-xs text-mist">...</span>
              )}
            </div>

            {/* Search results dropdown */}
            {personSearch.length >= 2 && (filteredPersonResults.length > 0 || searchingPeople) && (
              <div className="absolute z-50 mt-1 w-full rounded-xl border border-silver bg-white shadow-lg max-h-56 overflow-y-auto">
                {filteredPersonResults.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => addPerson(person)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-lavender/10 transition-colors"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lavender/15 text-xs font-medium text-lavender-dark">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-charcoal">
                        {person.name}
                      </span>
                      <span className="block truncate text-xs text-mist">
                        {person.email}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-cloud px-2 py-0.5 text-[10px] font-medium text-slate">
                      {person.role}
                    </span>
                  </button>
                ))}
                {searchingPeople && filteredPersonResults.length === 0 && (
                  <p className="px-3 py-3 text-center text-xs text-mist">
                    Searching...
                  </p>
                )}
              </div>
            )}

            {personSearch.length >= 2 &&
              !searchingPeople &&
              filteredPersonResults.length === 0 &&
              personResults.length === 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-silver bg-white shadow-lg">
                  <p className="px-3 py-3 text-center text-xs text-mist">
                    No results found.
                  </p>
                </div>
              )}
          </div>

          {/* Selected people pills */}
          {selectedPeople.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedPeople.map((person) => (
                <span
                  key={person.id}
                  className="inline-flex items-center gap-1 rounded-full bg-lavender/10 px-2.5 py-1 text-xs text-lavender-dark"
                >
                  {person.name}
                  <button
                    type="button"
                    onClick={() => removePerson(person.id)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-lavender/20 transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {selectedPeople.length > 0 && (
            <p className="mt-1 text-xs text-mist">
              {selectedPeople.length} recipient{selectedPeople.length !== 1 ? "s" : ""} selected
            </p>
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
