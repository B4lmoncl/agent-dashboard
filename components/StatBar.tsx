import { ReactNode } from "react";

interface StatBarProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  subColor?: string;
  horizontal?: boolean;
  tooltip?: ReactNode;
  onClick?: () => void;
}

export default function StatBar({ label, value, sub, accent = "rgba(255,255,255,0.8)", subColor, horizontal, tooltip, onClick }: StatBarProps) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex flex-col gap-0.5 relative group"
      style={{ background: "#181818", border: "1px solid rgba(255,68,68,0.15)", cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
      </div>
      {horizontal ? (
        <div className="flex items-baseline gap-3">
          <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
          {sub && <p className="text-lg font-bold" style={{ color: subColor || "rgba(255,255,255,0.3)" }}>{sub}</p>}
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
          {sub && <p className="text-xs" style={{ color: subColor || "rgba(255,255,255,0.3)" }}>{sub}</p>}
        </>
      )}
      {tooltip && (
        <div
          className="absolute left-0 top-full mt-1 rounded-xl p-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
          style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
