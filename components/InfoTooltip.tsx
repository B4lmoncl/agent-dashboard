"use client";

import { useState, useEffect, useRef } from "react";

export function InfoTooltip({ text, align = "left" }: { text: string; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center" style={{ lineHeight: 1 }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{
          width: 16, height: 16, borderRadius: "50%",
          border: "1.5px solid rgba(255,215,0,0.5)",
          background: "rgba(255,215,0,0.1)",
          color: "#FFD700",
          fontFamily: "Georgia, serif",
          fontSize: 9, fontWeight: "bold",
          cursor: "pointer",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: 0, lineHeight: 1, flexShrink: 0,
        }}
        title="Info"
      >?</button>
      {open && (
        <div
          className="absolute rounded-xl p-3 text-xs leading-relaxed"
          style={{
            background: "#1c1c1c",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            color: "rgba(255,255,255,0.6)",
            width: 280,
            top: "calc(100% + 6px)",
            ...(align === "right" ? { right: 0 } : { left: 0 }),
            zIndex: 9900,
            whiteSpace: "normal",
          }}
        >
          <button
            onClick={() => setOpen(false)}
            style={{ position: "absolute", top: 6, right: 8, color: "rgba(255,255,255,0.3)", fontSize: 12, lineHeight: 1 }}
          >x</button>
          <p className="pr-5">{text}</p>
        </div>
      )}
    </div>
  );
}

export default InfoTooltip;
