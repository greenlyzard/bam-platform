"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export function CartIndicator() {
  const { itemCount, totalCents, registrationTotalCents } = useCart();

  if (itemCount === 0) return null;

  const grandTotal = totalCents + registrationTotalCents;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(grandTotal / 100);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-4">
      <Link
        href="/enroll/cart"
        className="flex items-center justify-between w-full rounded-2xl bg-charcoal text-white px-5 py-3.5 shadow-xl hover:bg-charcoal/90 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
              />
            </svg>
            <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-gold text-[10px] font-bold flex items-center justify-center">
              {itemCount}
            </span>
          </div>
          <span className="text-sm font-medium">
            {itemCount} class{itemCount !== 1 ? "es" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{formatted}</span>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
            />
          </svg>
        </div>
      </Link>
    </div>
  );
}
