"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// Client mirror of the server-persisted enrollment cart (enrollment_carts via bam_cart_token).
// Mounted once in the portal layout so the global cart indicator and the Browse Classes buttons
// share one source of truth. All mutations go through /api/enrollment/cart, then refresh() re-reads.

export interface PortalCartItem {
  id: string;
  class_id: string;
  student_id: string | null;
  student_name: string | null;
  price_cents: number;
  class_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  teacher_name: string | null;
}

interface PortalCartValue {
  items: PortalCartItem[];
  count: number;
  totalCents: number;
  loading: boolean;
  hasClass: (classId: string) => boolean;
  refresh: () => Promise<void>;
  addClass: (
    classId: string,
    studentId?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  removeItem: (itemId: string) => Promise<{ ok: boolean; error?: string }>;
}

const PortalCartContext = createContext<PortalCartValue | null>(null);

export function PortalCartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<PortalCartItem[]>([]);
  const [totalCents, setTotalCents] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/enrollment/cart", { cache: "no-store" });
      const data = await res.json();
      setItems((data.items as PortalCartItem[]) ?? []);
      setTotalCents((data.total_cents as number) ?? 0);
    } catch {
      // Leave the last-known cart in place on a transient fetch failure.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addClass = useCallback(
    async (classId: string, studentId?: string) => {
      try {
        const res = await fetch("/api/enrollment/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            class_id: classId,
            ...(studentId ? { student_id: studentId } : {}),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: false, error: (data?.error as string) ?? "Could not add to cart." };
        }
        // Re-read through GET (buildCart) rather than trusting the POST body — that keeps a single
        // authoritative read path and avoids depending on the POST response shape.
        await refresh();
        return { ok: true };
      } catch {
        return { ok: false, error: "Could not add to cart. Please try again." };
      }
    },
    [refresh]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      try {
        const res = await fetch("/api/enrollment/cart", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_id: itemId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: false, error: (data?.error as string) ?? "Could not remove item." };
        }
        await refresh();
        return { ok: true };
      } catch {
        return { ok: false, error: "Could not remove item. Please try again." };
      }
    },
    [refresh]
  );

  const hasClass = useCallback(
    (classId: string) => items.some((i) => i.class_id === classId),
    [items]
  );

  const value = useMemo<PortalCartValue>(
    () => ({
      items,
      count: items.length,
      totalCents,
      loading,
      hasClass,
      refresh,
      addClass,
      removeItem,
    }),
    [items, totalCents, loading, hasClass, refresh, addClass, removeItem]
  );

  return (
    <PortalCartContext.Provider value={value}>{children}</PortalCartContext.Provider>
  );
}

export function usePortalCart() {
  const ctx = useContext(PortalCartContext);
  if (!ctx) throw new Error("usePortalCart must be used within PortalCartProvider");
  return ctx;
}
