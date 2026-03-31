"use client";

import { useState } from "react";
import Link from "next/link";

interface Note {
  id: string;
  content: string;
  noteType: string;
  noteDate: string;
  isPrivate: boolean;
  createdAt: string;
  teacherName: string;
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  general: "General",
  curriculum: "Curriculum",
  student_flag: "Student Flag",
  announcement: "Announcement",
};

export function NotesClient({
  classId,
  className,
  teacherId,
  tenantId,
  initialNotes,
}: {
  classId: string;
  className: string;
  teacherId: string;
  tenantId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teach/classes/${classId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          note_type: noteType,
          teacher_id: teacherId,
          tenant_id: tenantId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes((prev) => [data.note, ...prev]);
        setContent("");
        setNoteType("general");
      }
    } catch {
      // silent fail
    }
    setSaving(false);
  }

  const todayStr = new Date().toISOString().split("T")[0];
  const angelinaPrompt = encodeURIComponent(
    `I just finished teaching ${className} on ${todayStr}. Here's what we worked on: `
  );

  return (
    <div className="space-y-4">
      {/* Add Note Form */}
      <div className="rounded-xl border border-silver bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-charcoal">Add Note</h3>
          <select
            value={noteType}
            onChange={(e) => setNoteType(e.target.value)}
            className="text-xs border border-silver rounded-lg px-2 py-1 text-charcoal"
          >
            {Object.entries(NOTE_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What did you cover today? Any student observations?"
          rows={3}
          className="w-full rounded-lg border border-silver px-3 py-2 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:outline-none focus:ring-1 focus:ring-lavender resize-none"
        />
        <div className="flex items-center justify-between">
          <Link
            href={`/teach/chat?prompt=${angelinaPrompt}`}
            className="text-xs text-lavender hover:underline"
          >
            Ask Angelina to help summarize
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving || !content.trim()}
            className="h-9 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-medium px-5 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Note"}
          </button>
        </div>
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver bg-white/50 px-4 py-12 text-center">
          <p className="text-sm text-mist">No notes yet. Add your first class note above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="rounded-xl border border-silver bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-charcoal">{note.teacherName}</span>
                  <span className="text-xs text-mist">
                    {new Date(note.noteDate + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <span className="text-[10px] rounded-full bg-cloud px-2 py-0.5 text-slate">
                  {NOTE_TYPE_LABELS[note.noteType] ?? note.noteType}
                </span>
              </div>
              <p className="text-sm text-charcoal whitespace-pre-wrap">{note.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
