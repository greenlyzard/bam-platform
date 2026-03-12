"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, ClassInfo } from "@/types/enrollment";

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (classId: string) => void;
  clearCart: () => void;
  itemCount: number;
  /** Total monthly tuition in cents */
  totalCents: number;
  /** Total registration fees in cents */
  registrationTotalCents: number;
  hasClass: (classId: string) => boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      // Don't add duplicates (same class)
      if (prev.some((i) => i.classInfo.id === item.classInfo.id)) return prev;
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((classId: string) => {
    setItems((prev) => prev.filter((i) => i.classInfo.id !== classId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const hasClass = useCallback(
    (classId: string) => items.some((i) => i.classInfo.id === classId),
    [items]
  );

  const totalCents = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.classInfo.monthlyTuitionCents ?? 0),
        0
      ),
    [items]
  );

  const registrationTotalCents = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (item.classInfo.registrationFeeCents ?? 0),
        0
      ),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        clearCart,
        itemCount: items.length,
        totalCents,
        registrationTotalCents,
        hasClass,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
