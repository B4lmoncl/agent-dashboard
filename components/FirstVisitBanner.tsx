"use client";

import { useFirstVisit } from "@/hooks/useFirstVisit";

interface FirstVisitBannerProps {
  viewId: string;
  title: string;
  description: string;
  accentColor?: string;
}

/**
 * Shows a dismissable hint banner the first time a user opens a view.
 * Once dismissed, never shows again (persisted in localStorage).
 */
export default function FirstVisitBanner({ viewId, title, description, accentColor = "#e9a84c" }: FirstVisitBannerProps) {
  const { isFirstVisit, dismiss } = useFirstVisit(viewId);

  if (!isFirstVisit) return null;

  return (
    <div
      className="rounded-lg px-3 py-2.5 mb-3 flex items-start gap-2 tab-content-enter"
      style={{ background: `${accentColor}0a`, border: `1px solid ${accentColor}30` }}
    >
      <span className="text-sm mt-0.5" style={{ color: accentColor, flexShrink: 0 }}>?</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: accentColor }}>{title}</p>
        <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>{description}</p>
      </div>
      <button
        onClick={dismiss}
        className="text-xs px-2 py-0.5 rounded flex-shrink-0"
        style={{ background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}25`, cursor: "pointer" }}
      >
        OK
      </button>
    </div>
  );
}
