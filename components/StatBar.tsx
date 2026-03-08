interface StatBarProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

export default function StatBar({ label, value, sub, accent = "rgba(255,255,255,0.8)" }: StatBarProps) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex flex-col gap-0.5"
      style={{ background: "#181818", border: "1px solid rgba(255,68,68,0.15)" }}
    >
      <p className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</p>}
    </div>
  );
}
