"use client";

import { createContext, useContext } from "react";
import type { User, QuestsData, ClassDef } from "@/app/types";

// ─── Context shape — shared state accessed by 3+ components ─────────────────
export interface DashboardContextValue {
  // Auth (used by 10+ components)
  playerName: string;
  reviewApiKey: string;
  isAdmin: boolean;
  loggedInUser: User | null;

  // Game data (used by 5+ components)
  users: User[];
  quests: QuestsData;
  classesList: ClassDef[];

  // Core actions (used by 3+ components)
  refresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ value, children }: { value: DashboardContextValue; children: React.ReactNode }) {
  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
