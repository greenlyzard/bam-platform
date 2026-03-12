"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Role } from "@/lib/auth/getSessionWithRole";

interface RoleContextValue {
  role: Role;
  fullName: string | null;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({
  role,
  fullName,
  children,
}: {
  role: Role;
  fullName: string | null;
  children: ReactNode;
}) {
  return (
    <RoleContext.Provider value={{ role, fullName }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within a RoleProvider");
  }
  return ctx;
}
