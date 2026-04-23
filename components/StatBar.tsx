import { useRef, useEffect, useState } from "react";
import CountUp from "@/components/CountUp";

interface StatBarProps {
  label: string;
  value: string | number;
  value2?: string;
  value2Color?: string;
  sub?: string;
  accent?: string;
  subColor?: string;
  onClick?: () => void;
  inline?: boolean;
}

export default function StatBar({ label, value, value2, value2Color, sub, accent = "rgba(255,255,255,0.8)", subColor, onClick, inline }: StatBarProps) {
  // Detect value changes for flash animation
  const prevValueRef = useRef<string | number>(value);
  const [flashClass, setFlashClass] = useState("");
  useEffect(() => {
    if (prevValueRef.current === value) return;
    const prev = typeof prevValueRef.current === "number" ? prevValueRef.current : parseInt(String(prevValueRef.current).replace(/\D/g, ""), 10) || 0;
    const curr = typeof value === "number" ? value : parseInt(String(value).replace(/\D/g, ""), 10) || 0;
    if (curr > prev && prev > 0) setFlashClass("stat-flash-up");
    else if (curr < prev && prev > 0) setFlashClass("stat-flash-down");
    prevValueRef.current = value;
    const t = setTimeout(() => setFlashClass(""), 800);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div
      className="rounded-2xl px-5 py-4 flex flex-col gap-0.5 relative h-full stat-card-depth crystal-breathe card-floor-border"
      style={{ background: "#181818", border: "1px solid rgba(255,68,68,0.15)", cursor: onClick ? "pointer" : "default", "--glow-color": `${accent}18` } as React.CSSProperties}
      onClick={onClick}
    >
      {inline ? (
        <>
          <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</p>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold font-mono${flashClass ? ` ${flashClass}` : ""}`} style={{ color: accent }}>{typeof value === "number" ? <CountUp value={value} duration={700} /> : value}</span>
            {value2 && (
              <>
                {value2.startsWith("◆") ? (
                  <>
                    <span className="text-base font-bold mx-1" style={{
                      background: "linear-gradient(to right, #a855f7, #fbbf24)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>◆</span>
                    <span className="text-base font-bold" style={{ color: value2Color || "rgba(255,255,255,0.5)" }}>{value2.slice(1).trim()}</span>
                  </>
                ) : (
                  <span className="text-base font-bold" style={{ color: value2Color || "rgba(255,255,255,0.5)" }}>{value2}</span>
                )}
              </>
            )}
          </div>
          {sub && <p className="text-xs mt-0.5" style={{ color: subColor || "rgba(255,255,255,0.3)" }}>{sub}</p>}
        </>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className={`text-2xl font-bold${flashClass ? ` ${flashClass}` : ""}`} style={{ color: accent }}>{typeof value === "number" ? <CountUp value={value} duration={700} /> : value}</p>
            {value2 && (
              <>
                {value2.startsWith("◆") ? (
                  <>
                    <span className="text-2xl font-bold" style={{
                      background: "linear-gradient(to right, #a855f7, #fbbf24)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}>◆</span>
                    <p className="text-2xl font-bold" style={{ color: value2Color || "rgba(255,255,255,0.5)" }}>{value2.slice(1)}</p>
                  </>
                ) : (
                  <p className="text-2xl font-bold" style={{ color: value2Color || "rgba(255,255,255,0.5)" }}>{value2}</p>
                )}
              </>
            )}
          </div>
          {sub && <p className="text-xs" style={{ color: subColor || "rgba(255,255,255,0.3)" }}>{sub}</p>}
        </>
      )}
    </div>
  );
}
