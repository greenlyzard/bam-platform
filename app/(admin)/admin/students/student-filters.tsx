"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function StudentFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [consent, setConsent] = useState(searchParams.get("consent") ?? "__all__");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (consent && consent !== "__all__") params.set("consent", consent);
    router.push(`/admin/students${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="max-w-xs flex-1">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name..."
          className="w-full h-10 rounded-lg border border-silver bg-white px-3 text-sm text-charcoal placeholder:text-mist focus:border-lavender focus:ring-1 focus:ring-lavender outline-none"
        />
      </div>
      <div>
        <Select value={consent} onValueChange={setConsent}>
          <SelectTrigger className="h-10 w-[160px]">
            <SelectValue placeholder="All Consent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Consent</SelectItem>
            <SelectItem value="yes">Consented</SelectItem>
            <SelectItem value="no">Missing Consent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <button
        type="submit"
        className="h-10 rounded-lg bg-lavender hover:bg-lavender-dark text-white text-sm font-semibold px-5 transition-colors"
      >
        Filter
      </button>
    </form>
  );
}
