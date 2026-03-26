"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface IconRecord {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  category: string;
}

export interface IconPickerProps {
  onSelect: (icon: IconRecord) => void;
  selectedId?: string;
  category?: string | string[];
  triggerLabel?: string;
  allowClear?: boolean;
}

const CAT_COLORS: Record<string, string> = {
  company: "bg-lavender/10 text-lavender-dark",
  school: "bg-info/10 text-info",
  discipline: "bg-gold/10 text-gold-dark",
  certification: "bg-success/10 text-success",
  intensive: "bg-cloud text-slate",
  award: "bg-error/10 text-error",
};

export function IconPicker({ onSelect, selectedId, category, triggerLabel = "Choose icon", allowClear }: IconPickerProps) {
  const [icons, setIcons] = useState<IconRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      let q = supabase.from("icon_library").select("id,name,slug,icon_url,category").eq("is_active", true).order("sort_order");
      if (category) {
        const cats = Array.isArray(category) ? category : [category];
        q = q.in("category", cats);
      }
      const { data } = await q;
      if (data) setIcons(data);
    })();
  }, [category]);

  // click-outside
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const selected = icons.find((i) => i.id === selectedId);
  const categories = ["all", ...Array.from(new Set(icons.map((i) => i.category)))];
  const filtered = icons.filter((i) => {
    if (catFilter !== "all" && i.category !== catFilter) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function handleSelect(icon: IconRecord) {
    onSelect(icon);
    setOpen(false);
    setSearch("");
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 border border-silver rounded-md px-3 py-1.5 text-sm text-charcoal hover:border-lavender transition-colors bg-white min-w-[160px]"
      >
        {selected ? (
          <>
            <span className="w-5 h-5 rounded-full bg-lavender-light flex items-center justify-center overflow-hidden flex-shrink-0">
              {selected.icon_url ? (
                <img src={selected.icon_url} alt="" className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="text-[10px] font-medium text-lavender">{selected.name.charAt(0).toUpperCase()}</span>
              )}
            </span>
            <span className="truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-mist">{triggerLabel}</span>
        )}
        <svg className="w-3 h-3 ml-auto text-mist flex-shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3" /></svg>
      </button>

      {/* Popover (desktop) / Modal (mobile) */}
      {open && (
        <>
          {/* Mobile overlay */}
          <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setOpen(false)} />

          <div className="fixed inset-4 z-50 bg-white rounded-xl shadow-xl flex flex-col md:absolute md:inset-auto md:top-full md:left-0 md:mt-1 md:w-80 md:max-h-80 md:rounded-lg md:shadow-lg md:z-30 border border-silver">
            {/* Search */}
            <div className="p-2 border-b border-silver">
              <input
                autoFocus
                type="text"
                placeholder="Search icons..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-silver rounded-md px-2 py-1 text-sm focus:outline-none focus:border-lavender"
              />
            </div>

            {/* Category tabs */}
            <div className="flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-silver/50">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCatFilter(c)}
                  className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap transition-colors ${
                    catFilter === c ? "bg-lavender text-white" : "bg-silver/20 text-slate hover:bg-silver/40"
                  }`}
                >
                  {c === "all" ? "All" : c.charAt(0).toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>

            {/* Icon grid */}
            <div className="flex-1 overflow-y-auto p-2">
              <div className="grid grid-cols-4 md:grid-cols-3 gap-2">
                {allowClear && (
                  <button
                    onClick={() => { onSelect({ id: "", name: "", slug: "", icon_url: null, category: "" }); setOpen(false); }}
                    className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-silver/10 transition-colors"
                  >
                    <span className="w-10 h-10 rounded-full bg-silver/20 flex items-center justify-center text-mist text-lg">&times;</span>
                    <span className="text-[10px] text-mist">No Icon</span>
                  </button>
                )}
                {filtered.map((icon) => (
                  <button
                    key={icon.id}
                    onClick={() => handleSelect(icon)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-silver/10 transition-colors ${
                      icon.id === selectedId ? "ring-2 ring-lavender bg-lavender/5" : ""
                    }`}
                  >
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 ${
                      icon.icon_url ? "bg-cloud" : (CAT_COLORS[icon.category]?.split(" ")[0] ?? "bg-silver/20")
                    }`}>
                      {icon.icon_url ? (
                        <img src={icon.icon_url} alt={icon.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <span className={`text-sm font-medium ${CAT_COLORS[icon.category]?.split(" ")[1] ?? "text-mist"}`}>
                          {icon.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] text-charcoal truncate w-full text-center">{icon.name}</span>
                  </button>
                ))}
                {filtered.length === 0 && !allowClear && (
                  <p className="col-span-full text-xs text-mist text-center py-4">No icons found</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default IconPicker;
