"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "qh_visited_views";

function getVisited(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markVisited(viewId: string) {
  try {
    const visited = getVisited();
    visited.add(viewId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited]));
  } catch { /* localStorage unavailable */ }
}

/**
 * Returns whether this is the first time the user opens this view.
 * Call `dismiss()` to mark it as visited (persists in localStorage).
 */
export function useFirstVisit(viewId: string): { isFirstVisit: boolean; dismiss: () => void } {
  const [isFirstVisit, setIsFirstVisit] = useState(() => !getVisited().has(viewId));

  const dismiss = useCallback(() => {
    markVisited(viewId);
    setIsFirstVisit(false);
  }, [viewId]);

  return { isFirstVisit, dismiss };
}
