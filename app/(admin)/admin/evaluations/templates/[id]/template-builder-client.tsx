"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import Link from "next/link";
import { SimpleSelect } from "@/components/ui/select";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  updateTemplateSettings, addSection, updateSection, deleteSection, reorderSections,
  addQuestionToSection, removeQuestion, updateQuestion, reorderQuestions, createCustomQuestion,
} from "../actions";

// --- Types ---

interface Template { id: string; name: string; slug: string; level_tag: string | null; program_tag: string | null; is_active: boolean; tenant_id: string; }
interface Section { id: string; title: string; slug: string; display_mode: string; sort_order: number; }
interface Question { id: string; section_id: string; label: string; slug: string; hint_text: string | null; question_type: string; is_required: boolean; sort_order: number; }
interface BankQuestion { id: string; label: string; slug: string; question_type: string; default_section: string | null; hint_text: string | null; }
interface Props { template: Template; sections: Section[]; questions: Question[]; questionBank: BankQuestion[]; tenantId: string; }

// --- Constants ---

const TYPE_BADGES: Record<string, string> = {
  nse_rating: "bg-lavender/10 text-lavender-dark", free_text: "bg-info/10 text-info",
  level_placement: "bg-gold/10 text-gold-dark", text_input: "bg-cloud text-slate",
  numeric: "bg-cloud text-slate", boolean: "bg-cloud text-slate",
};
const DISPLAY_MODES = [
  { value: "always", label: "Always" }, { value: "if_applicable", label: "If Applicable" }, { value: "optional", label: "Optional" },
];
const Q_TYPES = [
  { value: "nse_rating", label: "NSE Rating" }, { value: "free_text", label: "Free Text" },
  { value: "level_placement", label: "Level Placement" }, { value: "text_input", label: "Text Input" },
  { value: "numeric", label: "Numeric" }, { value: "boolean", label: "Boolean" },
];
const INPUT_CLS = "w-full border border-silver rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20";

function slugify(t: string) { return t.toLowerCase().replace(/[^\w\s]/g, "").replace(/[\s]+/g, "_").trim(); }
function TypeBadge({ type }: { type: string }) {
  return <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${TYPE_BADGES[type] ?? "bg-cloud text-slate"}`}>{type.replace("_", " ")}</span>;
}

// --- Main Component ---

export function TemplateBuilderClient({ template: init, sections: initSec, questions: initQ, questionBank: initBank, tenantId }: Props) {
  const [template, setTemplate] = useState(init);
  const [sections, setSections] = useState(initSec);
  const [questions, setQuestions] = useState(initQ);
  const [bank, setBank] = useState(initBank);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedSectionId, setFocusedSectionId] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customType, setCustomType] = useState("free_text");
  const [customHint, setCustomHint] = useState("");
  const [mobileTab, setMobileTab] = useState<"settings" | "builder" | "bank">("builder");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Auto-save settings
  const saveSettings = useCallback((u: Template) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("idle");
    saveTimer.current = setTimeout(() => {
      setSaveStatus("saving");
      const fd = new FormData();
      fd.set("id", u.id); fd.set("name", u.name); fd.set("slug", u.slug);
      fd.set("level_tag", u.level_tag ?? ""); fd.set("program_tag", u.program_tag ?? "");
      fd.set("is_active", String(u.is_active));
      startTransition(async () => { await updateTemplateSettings(fd); setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 2000); });
    }, 800);
  }, [startTransition]);

  const updateField = (field: keyof Template, value: string | boolean) => {
    const updated = { ...template, [field]: value }; setTemplate(updated); saveSettings(updated);
  };

  // Section actions
  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return;
    const fd = new FormData();
    fd.set("template_id", template.id); fd.set("tenant_id", tenantId);
    fd.set("title", newSectionTitle); fd.set("slug", slugify(newSectionTitle)); fd.set("display_mode", "always");
    const r = await addSection(fd);
    if (r.id) {
      setSections(p => [...p, { id: r.id!, title: newSectionTitle, slug: slugify(newSectionTitle), display_mode: "always", sort_order: p.length + 1 }]);
      setNewSectionTitle(""); setAddingSection(false);
    }
  };

  const handleUpdateSection = async (id: string, field: string, value: string) => {
    setSections(p => p.map(s => s.id === id ? { ...s, [field]: value } : s));
    const sec = sections.find(s => s.id === id); if (!sec) return;
    const fd = new FormData();
    fd.set("id", id); fd.set("title", field === "title" ? value : sec.title);
    fd.set("slug", sec.slug); fd.set("display_mode", field === "display_mode" ? value : sec.display_mode);
    await updateSection(fd);
  };

  const handleDeleteSection = async (id: string) => {
    if (!confirm("Delete this section and all its questions?")) return;
    const fd = new FormData(); fd.set("id", id); await deleteSection(fd);
    setSections(p => p.filter(s => s.id !== id)); setQuestions(p => p.filter(q => q.section_id !== id));
  };

  const handleSectionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event; if (!over || active.id === over.id) return;
    const reordered = arrayMove(sections, sections.findIndex(s => s.id === active.id), sections.findIndex(s => s.id === over.id));
    setSections(reordered);
    const fd = new FormData(); fd.set("templateId", template.id); fd.set("orderedIds", JSON.stringify(reordered.map(s => s.id)));
    await reorderSections(fd);
  };

  // Question actions
  const handleAddFromBank = async (bq: BankQuestion) => {
    if (!focusedSectionId) return;
    const fd = new FormData();
    fd.set("section_id", focusedSectionId); fd.set("template_id", template.id);
    fd.set("tenant_id", tenantId); fd.set("question_bank_id", bq.id);
    const r = await addQuestionToSection(fd);
    if (r.id) {
      const n = questions.filter(q => q.section_id === focusedSectionId).length;
      setQuestions(p => [...p, { id: r.id!, section_id: focusedSectionId, label: bq.label, slug: bq.slug, hint_text: bq.hint_text, question_type: bq.question_type, is_required: false, sort_order: n + 1 }]);
    }
  };

  const handleRemoveQuestion = async (id: string) => {
    const fd = new FormData(); fd.set("id", id); await removeQuestion(fd);
    setQuestions(p => p.filter(q => q.id !== id));
  };

  const handleUpdateQuestion = async (id: string, field: string, value: string | boolean) => {
    setQuestions(p => p.map(q => q.id === id ? { ...q, [field]: value } : q));
    const q = questions.find(q => q.id === id); if (!q) return;
    const fd = new FormData(); fd.set("id", id);
    fd.set("label", field === "label" ? (value as string) : q.label);
    fd.set("is_required", String(field === "is_required" ? value : q.is_required));
    fd.set("hint_text", q.hint_text ?? ""); await updateQuestion(fd);
  };

  const handleQuestionDragEnd = async (sectionId: string, event: DragEndEvent) => {
    const { active, over } = event; if (!over || active.id === over.id) return;
    const sQs = questions.filter(q => q.section_id === sectionId);
    const reordered = arrayMove(sQs, sQs.findIndex(q => q.id === active.id), sQs.findIndex(q => q.id === over.id));
    setQuestions(p => [...p.filter(q => q.section_id !== sectionId), ...reordered]);
    const fd = new FormData(); fd.set("sectionId", sectionId); fd.set("orderedIds", JSON.stringify(reordered.map(q => q.id)));
    await reorderQuestions(fd);
  };

  // Custom question
  const handleCreateCustom = async () => {
    if (!customLabel.trim()) return;
    const fd = new FormData();
    fd.set("tenant_id", tenantId); fd.set("label", customLabel);
    fd.set("question_type", customType); fd.set("hint_text", customHint);
    const r = await createCustomQuestion(fd);
    if (r.id) {
      setBank(p => [...p, { id: r.id!, label: customLabel, slug: slugify(customLabel), question_type: customType, default_section: null, hint_text: customHint || null }]);
      setCustomLabel(""); setCustomHint(""); setShowCustomForm(false);
    }
  };

  // Filtered bank grouped by default_section
  const filtered = bank.filter(bq => bq.label.toLowerCase().includes(searchQuery.toLowerCase()) || bq.question_type.toLowerCase().includes(searchQuery.toLowerCase()));
  const bankGroups = filtered.reduce<Record<string, BankQuestion[]>>((acc, bq) => { const k = bq.default_section || "Uncategorized"; (acc[k] ??= []).push(bq); return acc; }, {});

  return (
    <div className="h-full flex flex-col">
      {/* Mobile tabs */}
      <div className="flex lg:hidden border-b border-silver">
        {(["settings", "builder", "bank"] as const).map(tab => (
          <button key={tab} onClick={() => setMobileTab(tab)} className={`flex-1 py-2 text-sm font-medium capitalize ${mobileTab === tab ? "text-lavender-dark border-b-2 border-lavender" : "text-slate"}`}>{tab}</button>
        ))}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT — Settings */}
        <aside className={`w-full lg:w-64 shrink-0 border-r border-silver bg-cream/50 p-4 overflow-y-auto ${mobileTab !== "settings" ? "hidden lg:block" : ""}`}>
          <h2 className="font-heading text-lg font-semibold text-charcoal mb-4">Template</h2>
          <label className="block text-xs font-medium text-slate mb-1">Name</label>
          <input type="text" value={template.name} onChange={e => updateField("name", e.target.value)} className={`${INPUT_CLS} mb-3`} />
          <label className="block text-xs font-medium text-slate mb-1">Level Tag</label>
          <input type="text" value={template.level_tag ?? ""} onChange={e => updateField("level_tag", e.target.value)} className={`${INPUT_CLS} mb-3`} />
          <label className="block text-xs font-medium text-slate mb-1">Program Tag</label>
          <input type="text" value={template.program_tag ?? ""} onChange={e => updateField("program_tag", e.target.value)} className={`${INPUT_CLS} mb-3`} />
          <label className="flex items-center gap-2 text-sm text-charcoal mb-4">
            <input type="checkbox" checked={template.is_active} onChange={e => updateField("is_active", e.target.checked)} className="rounded border-silver text-lavender focus:ring-lavender/20" />
            Active
          </label>
          {saveStatus === "saving" && <p className="text-xs text-slate animate-pulse">Saving...</p>}
          {saveStatus === "saved" && <p className="text-xs text-green-600">Saved &#10003;</p>}
          <Link href="/admin/evaluations/templates" className="inline-block mt-4 text-sm text-lavender-dark hover:underline">&larr; Back to Templates</Link>
        </aside>

        {/* CENTER — Sections & Questions */}
        <main className={`flex-1 overflow-y-auto p-4 ${mobileTab !== "builder" ? "hidden lg:block" : ""}`}>
          <h2 className="font-heading text-lg font-semibold text-charcoal mb-4">Sections &amp; Questions</h2>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {sections.map(section => (
                  <SortableSectionCard key={section.id} section={section}
                    questions={questions.filter(q => q.section_id === section.id)} sensors={sensors}
                    onUpdate={handleUpdateSection} onDelete={handleDeleteSection}
                    onRemoveQuestion={handleRemoveQuestion} onUpdateQuestion={handleUpdateQuestion}
                    onReorderQuestions={handleQuestionDragEnd} focusedSectionId={focusedSectionId}
                    onFocus={setFocusedSectionId} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {addingSection ? (
            <div className="mt-4 flex items-center gap-2">
              <input autoFocus type="text" placeholder="Section title" value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddSection()}
                className={`${INPUT_CLS} flex-1`} />
              <button onClick={handleAddSection} className="px-3 py-1.5 text-sm bg-lavender text-white rounded-md hover:bg-lavender-dark">Add</button>
              <button onClick={() => { setAddingSection(false); setNewSectionTitle(""); }} className="px-3 py-1.5 text-sm text-slate hover:text-charcoal">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingSection(true)} className="mt-4 px-3 py-1.5 text-sm border border-dashed border-silver rounded-md text-slate hover:border-lavender hover:text-lavender-dark">+ Add Section</button>
          )}
        </main>

        {/* RIGHT — Question Bank */}
        <aside className={`w-full lg:w-72 shrink-0 border-l border-silver bg-white p-4 overflow-y-auto ${mobileTab !== "bank" ? "hidden lg:block" : ""}`}>
          <h2 className="font-heading text-lg font-semibold text-charcoal mb-2">Question Bank</h2>
          <input type="text" placeholder="Search questions..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className={`${INPUT_CLS} mb-3`} />
          {!focusedSectionId && <p className="text-xs text-slate mb-3">Select a section in the builder to add questions.</p>}
          <div className="space-y-4">
            {Object.keys(bankGroups).sort().map(group => (
              <div key={group}>
                <h3 className="text-xs font-semibold text-slate uppercase tracking-wide mb-1">{group}</h3>
                <div className="space-y-1">
                  {bankGroups[group].map(bq => (
                    <div key={bq.id} className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-cream/60 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-charcoal">{bq.label}</span>
                        <TypeBadge type={bq.question_type} />
                      </div>
                      <button disabled={!focusedSectionId} onClick={() => handleAddFromBank(bq)} className="shrink-0 text-xs text-lavender-dark hover:text-lavender disabled:opacity-30 disabled:cursor-not-allowed">+ Add</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {showCustomForm ? (
            <div className="mt-4 border border-silver rounded-md p-3 space-y-2">
              <label className="block text-xs font-medium text-slate">Label</label>
              <input type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)} className={INPUT_CLS} />
              <label className="block text-xs font-medium text-slate">Type</label>
              <SimpleSelect value={customType} onValueChange={setCustomType} options={Q_TYPES} placeholder="Type" />
              <label className="block text-xs font-medium text-slate">Hint Text</label>
              <input type="text" value={customHint} onChange={e => setCustomHint(e.target.value)} className={INPUT_CLS} />
              <p className="text-[10px] text-slate">Slug: {slugify(customLabel) || "..."}</p>
              <div className="flex gap-2 pt-1">
                <button onClick={handleCreateCustom} className="px-3 py-1 text-sm bg-lavender text-white rounded-md hover:bg-lavender-dark">Save</button>
                <button onClick={() => { setShowCustomForm(false); setCustomLabel(""); setCustomHint(""); }} className="px-3 py-1 text-sm text-slate hover:text-charcoal">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCustomForm(true)} className="mt-4 w-full px-3 py-1.5 text-sm border border-dashed border-silver rounded-md text-slate hover:border-lavender hover:text-lavender-dark">+ Create Custom</button>
          )}
        </aside>
      </div>
    </div>
  );
}

// --- SortableSectionCard ---

function SortableSectionCard({ section, questions, sensors, onUpdate, onDelete, onRemoveQuestion, onUpdateQuestion, onReorderQuestions, focusedSectionId, onFocus }: {
  section: Section; questions: Question[]; sensors: ReturnType<typeof useSensors>;
  onUpdate: (id: string, f: string, v: string) => void; onDelete: (id: string) => void;
  onRemoveQuestion: (id: string) => void; onUpdateQuestion: (id: string, f: string, v: string | boolean) => void;
  onReorderQuestions: (sid: string, e: DragEndEvent) => void; focusedSectionId: string | null; onFocus: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.title);
  const isFocused = focusedSectionId === section.id;
  const style = { transform: CSS.Transform.toString(transform), transition };

  const commitTitle = () => {
    setEditing(false);
    if (draft.trim() && draft !== section.title) onUpdate(section.id, "title", draft);
    else setDraft(section.title);
  };

  return (
    <div ref={setNodeRef} style={style} onClick={() => onFocus(section.id)}
      className={`border rounded-lg bg-white ${isFocused ? "border-lavender ring-2 ring-lavender/20" : "border-silver"}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-silver/50">
        <span {...attributes} {...listeners} className="cursor-grab text-slate hover:text-charcoal select-none">&#10303;</span>
        {editing ? (
          <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commitTitle}
            onKeyDown={e => e.key === "Enter" && commitTitle()} className="flex-1 border border-silver rounded px-2 py-0.5 text-sm focus:outline-none focus:border-lavender" />
        ) : (
          <span className="flex-1 text-sm font-medium text-charcoal cursor-text" onClick={e => { e.stopPropagation(); setEditing(true); }}>{section.title}</span>
        )}
        <div className="w-32">
          <SimpleSelect value={section.display_mode || "always"} onValueChange={v => onUpdate(section.id, "display_mode", v)} options={DISPLAY_MODES} placeholder="Mode" />
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(section.id); }} className="text-slate hover:text-red-500 text-lg leading-none px-1" title="Delete section">&times;</button>
      </div>
      <div className="p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => onReorderQuestions(section.id, e)}>
          <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
            {questions.length === 0 ? (
              <p className="text-xs text-slate py-2 px-2">No questions yet.</p>
            ) : (
              <div className="space-y-1">
                {questions.map(q => <SortableQuestionRow key={q.id} question={q} onRemove={onRemoveQuestion} onUpdate={onUpdateQuestion} />)}
              </div>
            )}
          </SortableContext>
        </DndContext>
        <button onClick={e => { e.stopPropagation(); onFocus(section.id); }} className="mt-2 text-xs text-lavender-dark hover:underline">+ Add from Bank</button>
      </div>
    </div>
  );
}

// --- SortableQuestionRow ---

function SortableQuestionRow({ question, onRemove, onUpdate }: {
  question: Question; onRemove: (id: string) => void; onUpdate: (id: string, f: string, v: string | boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: question.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-cream/40 group">
      <span {...attributes} {...listeners} className="cursor-grab text-silver group-hover:text-slate select-none text-sm">&#10303;</span>
      <span className="flex-1 text-sm text-charcoal truncate">{question.label}</span>
      <TypeBadge type={question.question_type} />
      <label className="flex items-center gap-1 text-[10px] text-slate" title="Required">
        <input type="checkbox" checked={question.is_required} onChange={e => onUpdate(question.id, "is_required", e.target.checked)}
          className="rounded border-silver text-lavender focus:ring-lavender/20 h-3 w-3" />
        Req
      </label>
      <button onClick={() => onRemove(question.id)} className="text-silver hover:text-red-500 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity" title="Remove">&times;</button>
    </div>
  );
}
