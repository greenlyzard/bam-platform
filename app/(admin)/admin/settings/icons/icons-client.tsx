"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { SimpleSelect } from "@/components/ui/select";
import { createIcon, updateIcon, toggleIconActive, uploadIconToStorage, saveIconsToLibrary } from "./actions";

interface Icon {
  id: string; name: string; slug: string; category: string;
  icon_url: string | null; website_url: string | null;
  is_global: boolean; is_active: boolean; sort_order: number;
}

interface PendingUpload {
  file: File; url: string; name: string; slug: string; category: string; websiteUrl: string;
}

const CATEGORIES = [
  { value: "company", label: "Company" }, { value: "school", label: "School" },
  { value: "discipline", label: "Discipline" }, { value: "certification", label: "Certification" },
  { value: "intensive", label: "Intensive" }, { value: "award", label: "Award" },
] as const;

const CAT_COLORS: Record<string, string> = {
  company: "bg-lavender/10 text-lavender-dark",
  school: "bg-info/10 text-info",
  discipline: "bg-gold/10 text-gold-dark",
  certification: "bg-success/10 text-success",
  intensive: "bg-cloud text-slate",
  award: "bg-error/10 text-error",
};

const ALL_CATS = ["all", ...CATEGORIES.map(c => c.value)] as const;
const catOpts = CATEGORIES.map(c => ({ value: c.value, label: c.label }));
const inputCls = "border border-silver rounded-md px-3 py-1.5 text-sm text-charcoal focus:outline-none focus:border-lavender focus:ring-2 focus:ring-lavender/20";
const inputSmCls = "border border-silver rounded-md px-2 py-1 text-sm focus:outline-none focus:border-lavender";

export function IconsClient({ icons: initialIcons, tenantId }: { icons: Icon[]; tenantId: string }) {
  const [icons, setIcons] = useState(initialIcons);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // New icon form state
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("discipline");
  const [newIconUrl, setNewIconUrl] = useState("");
  const [newWebsiteUrl, setNewWebsiteUrl] = useState("");
  const [newIconFile, setNewIconFile] = useState<File | null>(null);
  const [newIconUploading, setNewIconUploading] = useState(false);

  const filtered = icons.filter(i => {
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase()) && !i.slug.includes(search.toLowerCase())) return false;
    return true;
  });

  function handleToggle(icon: Icon) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", icon.id);
      fd.set("is_active", String(!icon.is_active));
      const res = await toggleIconActive(fd);
      if (!res.error) setIcons(p => p.map(i => i.id === icon.id ? { ...i, is_active: !i.is_active } : i));
    });
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    let iconUrl = newIconUrl;

    // Upload file first if selected
    if (newIconFile) {
      setNewIconUploading(true);
      const ufd = new FormData();
      ufd.set("file", newIconFile);
      const uploadRes = await uploadIconToStorage(ufd);
      setNewIconUploading(false);
      if (uploadRes.error || !uploadRes.url) {
        alert(`Upload failed: ${uploadRes.error ?? "Unknown error"}`);
        return;
      }
      iconUrl = uploadRes.url;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("name", newName); fd.set("category", newCategory);
      fd.set("icon_url", iconUrl); fd.set("website_url", newWebsiteUrl); fd.set("tenantId", tenantId);
      const res = await createIcon(fd);
      if (!res.error) { setNewName(""); setNewIconUrl(""); setNewWebsiteUrl(""); setNewIconFile(null); }
    });
  }

  function handleSaveEdit(icon: Icon, fd: FormData) {
    startTransition(async () => {
      const res = await updateIcon(fd);
      if (!res.error) {
        setEditingId(null);
        setIcons(p => p.map(i => i.id === icon.id ? {
          ...i, name: fd.get("name") as string, category: fd.get("category") as string,
          icon_url: (fd.get("icon_url") as string) || null, website_url: (fd.get("website_url") as string) || null,
        } : i));
      }
    });
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
  }

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true);
    const arr = Array.from(files);
    for (const file of arr) {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadIconToStorage(fd);
      if (!res.error && res.url) {
        const name = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        setPendingUploads(prev => [...prev, {
          file, url: res.url!, name, slug: res.slug!, category: "discipline", websiteUrl: "",
        }]);
      }
    }
    setUploading(false);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }

  async function handleSaveAll() {
    if (pendingUploads.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    fd.set("tenantId", tenantId);
    fd.set("icons", JSON.stringify(pendingUploads.map(p => ({
      name: p.name, slug: p.slug, category: p.category, icon_url: p.url, website_url: p.websiteUrl || undefined,
    }))));
    const res = await saveIconsToLibrary(fd);
    if (!res.error) {
      setPendingUploads([]);
      setUploadMode(false);
    }
    setUploading(false);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-charcoal">Icon Library</h1>
          <span className="text-xs text-mist bg-silver/20 rounded-full px-2 py-0.5">{icons.length}</span>
        </div>
        <button
          onClick={() => { setUploadMode(!uploadMode); setPendingUploads([]); }}
          className="px-4 py-2 bg-lavender text-white text-sm rounded-md hover:bg-lavender-dark transition-colors"
        >
          {uploadMode ? "Back to Browse" : "+ Upload Icons"}
        </button>
      </div>

      {/* Filter bar */}
      {!uploadMode && (
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text" placeholder="Search icons..." value={search} onChange={e => setSearch(e.target.value)}
            className={inputCls + " flex-1"}
          />
          <div className="flex gap-1 overflow-x-auto">
            {ALL_CATS.map(c => (
              <button
                key={c} onClick={() => setCategoryFilter(c)}
                className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                  categoryFilter === c ? "bg-lavender text-white" : "bg-silver/20 text-slate hover:bg-silver/40"
                }`}
              >
                {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload mode */}
      {uploadMode ? (
        <div className="space-y-4">
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-silver rounded-xl p-8 text-center cursor-pointer hover:border-lavender transition-colors"
          >
            <p className="text-sm text-slate">Drop PNG/SVG/WebP files here</p>
            <p className="text-xs text-mist mt-1">or click to browse (max 512KB each)</p>
            <input ref={fileInputRef} type="file" multiple accept=".png,.svg,.webp" className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
          </div>

          {uploading && <p className="text-sm text-lavender">Uploading...</p>}

          {pendingUploads.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-charcoal">Preview ({pendingUploads.length} icons)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingUploads.map((p, idx) => (
                  <div key={idx} className="bg-white border border-silver rounded-lg p-3 flex gap-3">
                    <div className="w-16 h-16 rounded-full bg-cloud flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img src={p.url} alt={p.name} className="w-16 h-16 rounded-full object-cover" />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <input
                        value={p.name}
                        onChange={e => setPendingUploads(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                        className={inputSmCls + " w-full"} placeholder="Icon name"
                      />
                      <p className="text-[10px] text-mist">slug: {p.slug}</p>
                      <SimpleSelect
                        value={p.category}
                        onValueChange={v => setPendingUploads(prev => prev.map((x, i) => i === idx ? { ...x, category: v } : x))}
                        options={catOpts} placeholder="Category"
                      />
                      <input
                        value={p.websiteUrl}
                        onChange={e => setPendingUploads(prev => prev.map((x, i) => i === idx ? { ...x, websiteUrl: e.target.value } : x))}
                        className={inputSmCls + " w-full"} placeholder="Website URL (optional)"
                      />
                      <button onClick={() => setPendingUploads(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-error hover:underline">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleSaveAll} disabled={uploading} className="px-4 py-2 bg-lavender text-white text-sm rounded-md hover:bg-lavender-dark transition-colors disabled:opacity-50">
                Save All to Library
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Browse mode */
        <div className="space-y-4">
          {/* Icon grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {filtered.map(icon => (
              <div key={icon.id} className="bg-white border border-silver rounded-lg p-3 flex flex-col items-center gap-2 relative group">
                <div className="w-16 h-16 rounded-full bg-cloud flex items-center justify-center overflow-hidden relative group/icon">
                  {icon.icon_url ? (
                    <img src={icon.icon_url} alt={icon.name} className="w-16 h-16 rounded-full object-cover" />
                  ) : (
                    <span className="text-lg font-medium text-lavender">{icon.name.charAt(0).toUpperCase()}</span>
                  )}
                  {/* Upload/Replace overlay */}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/icon:opacity-100 transition-opacity cursor-pointer rounded-full">
                    {uploadingId === icon.id ? (
                      <span className="text-[10px] text-white animate-pulse">Uploading...</span>
                    ) : (
                      <span className="text-[10px] text-white font-medium">{icon.icon_url ? "Replace" : "Upload"}</span>
                    )}
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg,.webp"
                      className="hidden"
                      disabled={uploadingId === icon.id}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingId(icon.id);
                        const fd = new FormData();
                        fd.set("file", file);
                        const res = await uploadIconToStorage(fd);
                        if (res.error || !res.url) {
                          alert(`Upload failed: ${res.error ?? "Unknown error"}`);
                          setUploadingId(null);
                          return;
                        }
                        const ufd = new FormData();
                        ufd.set("id", icon.id);
                        ufd.set("name", icon.name);
                        ufd.set("category", icon.category);
                        ufd.set("icon_url", res.url);
                        ufd.set("website_url", icon.website_url ?? "");
                        await updateIcon(ufd);
                        setIcons(p => p.map(i => i.id === icon.id ? { ...i, icon_url: res.url! } : i));
                        setUploadingId(null);
                      }}
                    />
                  </label>
                </div>
                {editingId === icon.id ? (
                  <EditInline icon={icon} onSave={handleSaveEdit} onCancel={() => setEditingId(null)} />
                ) : (
                  <>
                    <button onClick={() => setEditingId(icon.id)} className="text-sm font-medium text-charcoal hover:text-lavender transition-colors truncate w-full text-center">
                      {icon.name}
                    </button>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${CAT_COLORS[icon.category] ?? "bg-silver/20 text-mist"}`}>
                      {icon.category}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      {icon.icon_url && (
                        <button onClick={() => copyUrl(icon.icon_url!)} className="text-[10px] text-lavender hover:underline">Copy URL</button>
                      )}
                      <button onClick={() => handleToggle(icon)} disabled={isPending} className={`w-8 h-4 rounded-full relative transition-colors flex-shrink-0 ${icon.is_active ? "bg-success" : "bg-silver"}`}>
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${icon.is_active ? "left-[16px]" : "left-0.5"}`} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {filtered.length === 0 && <p className="text-sm text-mist text-center py-8">No icons match your search</p>}

          {/* Add form */}
          <div className="bg-white rounded-xl border border-silver p-4">
            <h2 className="text-sm font-semibold text-charcoal mb-3">+ Add Icon</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" placeholder="Icon name" value={newName} onChange={e => setNewName(e.target.value)} className={inputCls} />
              <SimpleSelect value={newCategory} onValueChange={setNewCategory} options={catOpts} placeholder="Category" />
              <div className="flex items-center gap-2">
                <input type="url" placeholder="Icon URL" value={newIconUrl} onChange={e => { setNewIconUrl(e.target.value); setNewIconFile(null); }} className={inputCls + " flex-1"} disabled={!!newIconFile} />
                <span className="text-xs text-mist">or</span>
                <label className="cursor-pointer px-3 py-1.5 text-xs border border-gray-200 rounded hover:bg-gray-50 shrink-0">
                  {newIconFile ? newIconFile.name.slice(0, 15) + "..." : "Upload file"}
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setNewIconFile(f); setNewIconUrl(""); }
                    }}
                  />
                </label>
                {newIconFile && (
                  <button onClick={() => setNewIconFile(null)} className="text-xs text-mist hover:text-red-400">x</button>
                )}
              </div>
              <input type="url" placeholder="Website URL" value={newWebsiteUrl} onChange={e => setNewWebsiteUrl(e.target.value)} className={inputCls} />
            </div>
            <button onClick={handleAdd} disabled={isPending || newIconUploading || !newName.trim()} className="mt-3 px-4 py-2 bg-lavender text-white text-sm rounded-md hover:bg-lavender-dark transition-colors disabled:opacity-50">
              {newIconUploading ? "Uploading..." : isPending ? "Saving..." : "Save Icon"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EditInline({ icon, onSave, onCancel }: { icon: Icon; onSave: (icon: Icon, fd: FormData) => void; onCancel: () => void }) {
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
    <div className="w-full space-y-1.5">
      <input value={name} onChange={e => setName(e.target.value)} className={inputSmCls + " w-full"} placeholder="Name" />
      <SimpleSelect value={category} onValueChange={setCategory} options={catOpts} placeholder="Category" />
      <input value={iconUrl} onChange={e => setIconUrl(e.target.value)} placeholder="Icon URL" className={inputSmCls + " w-full"} />
      <input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="Website URL" className={inputSmCls + " w-full"} />
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="text-xs px-2 py-1 bg-lavender text-white rounded hover:bg-lavender-dark">Save</button>
        <button onClick={onCancel} className="text-xs px-2 py-1 text-mist hover:text-charcoal">Cancel</button>
      </div>
    </div>
  );
}
