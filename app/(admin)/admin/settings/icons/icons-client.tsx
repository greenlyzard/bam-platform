"use client";

import { useState, useTransition } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { createIcon, updateIcon, toggleIconActive } from "./actions";

interface Icon {
  id: string; name: string; slug: string; category: string;
  icon_url: string | null; website_url: string | null;
  is_global: boolean; is_active: boolean; sort_order: number;
}

const CATEGORIES = [
  { value: "company", label: "Company" }, { value: "school", label: "School" },
  { value: "discipline", label: "Discipline" }, { value: "certification", label: "Certification" },
  { value: "intensive", label: "Intensive" }, { value: "award", label: "Award" },
] as const;

const CAT_COLORS: Record<string, string> = {
  company: "bg-lavender/10 text-lavender-dark", school: "bg-info/10 text-info",
  discipline: "bg-gold/10 text-gold", certification: "bg-success/10 text-success",
  intensive: "bg-cloud text-charcoal", award: "bg-error/10 text-error",
};

const catOpts = CATEGORIES.map((c) => ({ value: c.value, label: c.label }));
const inputCls = "border border-silver rounded-md px-3 py-1.5 text-sm text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20";
const inputSmCls = "border border-silver rounded-md px-2 py-1 text-sm focus:outline-none focus:border-lavender";

export function IconsClient({ icons: initialIcons, tenantId }: { icons: Icon[]; tenantId: string }) {
  const [icons, setIcons] = useState(initialIcons);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("discipline");
  const [newIconUrl, setNewIconUrl] = useState("");
  const [newWebsiteUrl, setNewWebsiteUrl] = useState("");

  const grouped = CATEGORIES.map((cat) => ({
    ...cat, items: icons.filter((i) => i.category === cat.value),
  })).filter((g) => g.items.length > 0);

  function handleToggle(icon: Icon) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", icon.id);
      fd.set("is_active", String(!icon.is_active));
      const res = await toggleIconActive(fd);
      if (!res.error) setIcons((p) => p.map((i) => (i.id === icon.id ? { ...i, is_active: !i.is_active } : i)));
    });
  }

  function handleAdd() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", newName); fd.set("category", newCategory);
      fd.set("icon_url", newIconUrl); fd.set("website_url", newWebsiteUrl); fd.set("tenantId", tenantId);
      const res = await createIcon(fd);
      if (!res.error) { setNewName(""); setNewIconUrl(""); setNewWebsiteUrl(""); }
    });
  }

  function handleSaveEdit(icon: Icon, fd: FormData) {
    startTransition(async () => {
      const res = await updateIcon(fd);
      if (!res.error) {
        setEditingId(null);
        setIcons((p) => p.map((i) => i.id === icon.id ? {
          ...i, name: fd.get("name") as string, category: fd.get("category") as string,
          icon_url: (fd.get("icon_url") as string) || null, website_url: (fd.get("website_url") as string) || null,
        } : i));
      }
    });
  }

  return (
    <div className="space-y-6">
      {grouped.map((group) => (
        <div key={group.value} className="bg-white rounded-xl border border-silver p-4">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-charcoal capitalize">{group.label}</h2>
            <span className="text-xs text-mist">({group.items.length})</span>
          </div>
          <div className="divide-y divide-silver/50">
            {group.items.map((icon) => (
              <div key={icon.id} className="flex items-center gap-3 py-2">
                <div className="w-8 h-8 rounded-full bg-lavender-light flex items-center justify-center overflow-hidden flex-shrink-0">
                  {icon.icon_url
                    ? <img src={icon.icon_url} alt={icon.name} className="w-8 h-8 rounded-full object-cover" />
                    : <span className="text-xs font-medium text-lavender">{icon.name.charAt(0).toUpperCase()}</span>}
                </div>
                {editingId === icon.id ? (
                  <EditRow icon={icon} onSave={handleSaveEdit} onCancel={() => setEditingId(null)} />
                ) : (
                  <>
                    <button onClick={() => setEditingId(icon.id)} className="text-sm text-charcoal hover:text-lavender transition-colors text-left flex-1 min-w-0 truncate">{icon.name}</button>
                    <span className="text-xs text-mist hidden sm:inline">{icon.slug}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[icon.category] ?? "bg-silver/20 text-mist"}`}>{icon.category}</span>
                    {icon.website_url && <a href={icon.website_url} target="_blank" rel="noopener noreferrer" className="text-xs text-lavender hover:underline hidden sm:inline">Link</a>}
                    <button onClick={() => handleToggle(icon)} disabled={isPending} className={`w-9 h-5 rounded-full relative transition-colors flex-shrink-0 ${icon.is_active ? "bg-success" : "bg-silver"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${icon.is_active ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Add form */}
      <div className="bg-white rounded-xl border border-silver p-4">
        <h2 className="text-sm font-semibold text-charcoal mb-3">+ Add Icon</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input type="text" placeholder="Icon name" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
          <SimpleSelect value={newCategory} onValueChange={setNewCategory} options={catOpts} placeholder="Category" />
          <input type="url" placeholder="Icon URL" value={newIconUrl} onChange={(e) => setNewIconUrl(e.target.value)} className={inputCls} />
          <input type="url" placeholder="Website URL" value={newWebsiteUrl} onChange={(e) => setNewWebsiteUrl(e.target.value)} className={inputCls} />
        </div>
        <button onClick={handleAdd} disabled={isPending || !newName.trim()} className="mt-3 px-4 py-2 bg-lavender text-white text-sm rounded-md hover:bg-lavender-dark transition-colors disabled:opacity-50">Save Icon</button>
      </div>
    </div>
  );
}

function EditRow({ icon, onSave, onCancel }: { icon: Icon; onSave: (icon: Icon, fd: FormData) => void; onCancel: () => void }) {
  const [name, setName] = useState(icon.name);
  const [category, setCategory] = useState(icon.category);
  const [iconUrl, setIconUrl] = useState(icon.icon_url ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(icon.website_url ?? "");

  function handleSubmit() {
    const fd = new FormData();
    fd.set("id", icon.id); fd.set("name", name); fd.set("category", category);
    fd.set("icon_url", iconUrl); fd.set("website_url", websiteUrl);
    onSave(icon, fd);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 flex-1">
      <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputSmCls} w-36`} />
      <SimpleSelect value={category} onValueChange={setCategory} options={catOpts} placeholder="Category" className="w-32" />
      <input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="Icon URL" className={`${inputSmCls} w-40`} />
      <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="Website URL" className={`${inputSmCls} w-40`} />
      <button onClick={handleSubmit} className="text-xs px-2 py-1 bg-lavender text-white rounded hover:bg-lavender-dark">Save</button>
      <button onClick={onCancel} className="text-xs px-2 py-1 text-mist hover:text-charcoal">Cancel</button>
    </div>
  );
}
