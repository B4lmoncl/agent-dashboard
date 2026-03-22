"use client";

import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { useModalBehavior } from "@/components/ModalPortal";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayNum: number;
  claimed: boolean;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
}

// ─── Streak milestone rewards preview ────────────────────────────────────────

const MILESTONES = [
  { days: 7,  label: "7-Day Bonus",  reward: "+1 Runensplitter, +1 Essenz" },
  { days: 14, label: "14-Day Bonus", reward: "+2 Runensplitter, +2 Essenz" },
  { days: 30, label: "30-Day Bonus", reward: "+3 Runensplitter, +5 Essenz" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DailyLoginCalendar({ onClose }: { onClose: () => void }) {
  useModalBehavior(true, onClose);
  const { playerName, reviewApiKey: apiKey } = useDashboard();
  const [claimHistory, setClaimHistory] = useState<string[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`/api/daily-bonus/status/${encodeURIComponent(playerName)}`);
      if (r.ok) {
        const data = await r.json();
        setClaimHistory(data.claimHistory || []);
        setStreakDays(data.streakDays || 0);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [playerName]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Build calendar for current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Monday = 0

  const claimSet = new Set(claimHistory);

  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({
      date: dateStr,
      dayNum: d,
      claimed: claimSet.has(dateStr),
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
      isFuture: dateStr > todayStr,
    });
  }

  const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const dayLabels = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  const claimedThisMonth = days.filter(d => d.claimed).length;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-5 space-y-4"
        style={{ background: "#1a1a1a", border: "1px solid rgba(251,191,36,0.3)", boxShadow: "0 0 60px rgba(251,191,36,0.1)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold" style={{ color: "#fbbf24" }}>Login Calendar</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{monthNames[month]} {year}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold" style={{ color: "#fbbf24" }}>{streakDays} Day Streak</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{claimedThisMonth}/{daysInMonth} this month</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-7 gap-1 py-4">{Array.from({ length: 28 }, (_, i) => <div key={i} className="skeleton-card" style={{ height: 40 }} />)}</div>
        ) : (
          <>
            {/* Calendar Grid */}
            <div>
              {/* Day labels */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {dayLabels.map(label => (
                  <div key={label} className="text-center text-xs font-semibold py-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {label}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for offset */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ width: "100%", aspectRatio: "1" }} />
                ))}

                {days.map(day => {
                  const bg = day.claimed
                    ? "rgba(251,191,36,0.2)"
                    : day.isToday
                      ? "rgba(167,139,250,0.15)"
                      : "rgba(255,255,255,0.03)";
                  const border = day.claimed
                    ? "rgba(251,191,36,0.5)"
                    : day.isToday
                      ? "rgba(167,139,250,0.4)"
                      : "rgba(255,255,255,0.06)";
                  const textColor = day.claimed
                    ? "#fbbf24"
                    : day.isToday
                      ? "#a78bfa"
                      : day.isPast
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(255,255,255,0.4)";

                  return (
                    <div
                      key={day.date}
                      className="flex flex-col items-center justify-center rounded-lg relative"
                      style={{
                        aspectRatio: "1",
                        background: bg,
                        border: `1px solid ${border}`,
                        transition: "all 0.15s",
                      }}
                    >
                      <span className="text-xs font-semibold" style={{ color: textColor }}>{day.dayNum}</span>
                      {day.claimed && (
                        <span className="absolute bottom-0.5 text-xs" style={{ color: "#fbbf24", fontSize: 12, lineHeight: 1 }}>✓</span>
                      )}
                      {day.isToday && !day.claimed && (
                        <span className="absolute bottom-0.5 text-xs" style={{ color: "#a78bfa", fontSize: 8, lineHeight: 1 }}>●</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Milestone Progress */}
            <div className="space-y-1.5 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>Streak-Meilensteine</p>
              {MILESTONES.map(m => {
                const reached = streakDays >= m.days;
                return (
                  <div key={m.days} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg" style={{
                    background: reached ? "rgba(251,191,36,0.08)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${reached ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.05)"}`,
                  }}>
                    <span style={{ color: reached ? "#fbbf24" : "rgba(255,255,255,0.3)" }}>
                      {reached ? "✓ " : ""}{m.label}
                    </span>
                    <span style={{ color: reached ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>{m.reward}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-2 rounded-xl text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
