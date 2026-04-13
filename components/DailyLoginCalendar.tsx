"use client";

import { useState, useEffect, useCallback } from "react";
import { useDashboard } from "@/app/DashboardContext";
import { getAuthHeaders } from "@/lib/auth-client";
import { useModalBehavior } from "@/components/ModalPortal";
import { Tip, TipCustom } from "@/components/GameTooltip";

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
  { days: 7,   label: "7-Day",   reward: "+1 Rune, +1 Essenz",    cosmetic: "Title: Flammenhüter",      color: "#22c55e" },
  { days: 14,  label: "14-Day",  reward: "+2 Rune, +2 Essenz",    cosmetic: null,                        color: "#3b82f6" },
  { days: 30,  label: "30-Day",  reward: "+3 Rune, +5 Essenz",    cosmetic: "Title + Frame: Unerschütterlich", color: "#a855f7" },
  { days: 90,  label: "90-Day",  reward: "XP Bonus + Epic Loot",  cosmetic: "Title + Frame: Eiserner Wille",   color: "#ef4444" },
  { days: 365, label: "365-Day", reward: "Legendary Loot",        cosmetic: "Title + Frame: Die Ewige Flamme", color: "#f97316" },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function DailyLoginCalendar({ onClose }: { onClose: () => void }) {
  useModalBehavior(true, onClose);
  const { playerName, reviewApiKey: apiKey } = useDashboard();
  const [claimedToday, setClaimedToday] = useState(false);
  const [claiming, setClaiming] = useState(false);
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
    } catch { /* network error — calendar still shows last known state */ }
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
  const alreadyClaimedToday = claimedToday || claimSet.has(todayStr);

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
            <Tip k="login_calendar" heading><h2 className="text-base font-bold" style={{ color: "#fbbf24" }}>Login Calendar</h2></Tip>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{monthNames[month]} {year}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <Tip k="streak"><p className="text-sm font-bold" style={{ color: "#fbbf24", cursor: "help" }}>{streakDays} Day Streak</p></Tip>
              <TipCustom title="Monatlicher Fortschritt" icon="◆" accent="#fbbf24" body={<p>Anzahl der beanspruchten Tagesbelohnungen in diesem Monat.</p>}>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)", cursor: "help" }}>{claimedThisMonth}/{daysInMonth} this month</p>
              </TipCustom>
            </div>
            <button onClick={onClose} className="text-xs px-2 py-1 rounded-lg transition-all hover:bg-w8" style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer", background: "rgba(255,255,255,0.04)" }}>ESC</button>
          </div>
        </div>
        {!alreadyClaimedToday && apiKey ? (
          <button
            onClick={async () => {
              if (claiming || alreadyClaimedToday || !apiKey) return;
              setClaiming(true);
              try {
                const { getAuthHeaders } = await import("@/lib/auth-client");
                const r = await fetch("/api/daily-bonus/claim", { method: "POST", headers: { ...getAuthHeaders(apiKey), "Content-Type": "application/json" }, body: JSON.stringify({ playerId: playerName }) });
                if (r.ok) {
                  setClaimedToday(true); fetchStatus();
                  // Play appropriate sound
                  try {
                    const { SFX } = await import("@/lib/sounds");
                    const d = await r.clone().json().catch(() => null);
                    if (d?.milestone) SFX.streakMilestone();
                    else SFX.questComplete();
                  } catch { /* sound optional */ }
                }
              } catch { /* toast handled elsewhere */ }
              setClaiming(false);
            }}
            disabled={claiming}
            className={`w-full mt-2 py-2 rounded-lg text-sm font-bold${!claiming ? " claimable-breathe" : ""}`}
            style={{ background: claiming ? "rgba(251,191,36,0.08)" : "rgba(251,191,36,0.15)", color: claiming ? "rgba(251,191,36,0.5)" : "#fbbf24", border: `1px solid ${claiming ? "rgba(251,191,36,0.15)" : "rgba(251,191,36,0.35)"}`, cursor: claiming ? "not-allowed" : "pointer" }}
          >
            {claiming ? "Claiming..." : "Claim Daily Bonus"}
          </button>
        ) : (
          <p className={`text-xs mt-2 text-center py-1.5 rounded-lg${alreadyClaimedToday ? " tab-content-enter" : ""}`} style={{ color: alreadyClaimedToday ? "rgba(34,197,94,0.6)" : "rgba(255,255,255,0.25)", background: alreadyClaimedToday ? "rgba(34,197,94,0.05)" : "transparent" }}>
            {alreadyClaimedToday ? "✓ Today's bonus claimed" : "Log in to claim your daily bonus"}
          </p>
        )}

        {loading ? (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 py-4">{Array.from({ length: 28 }, (_, i) => <div key={i} className="skeleton-card" style={{ height: 40 }} />)}</div>
        ) : (
          <>
            {/* Calendar Grid */}
            <div>
              {/* Day labels */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 mb-1">
                {dayLabels.map(label => (
                  <div key={label} className="text-center text-xs font-semibold py-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {label}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
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
                        <span className="absolute bottom-0.5 text-xs" style={{ color: "#a78bfa", fontSize: 12, lineHeight: 1 }}>●</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Milestone Progress */}
            <div className="space-y-1.5 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <TipCustom title="Streak-Meilensteine" icon="★" accent="#fbbf24" body={<p>Belohnungen f&uuml;r ununterbrochene Login-Streaks. Je l&auml;nger der Streak, desto besser die Boni.</p>}>
                <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)", cursor: "help" }}>Streak-Meilensteine</p>
              </TipCustom>
              {MILESTONES.map(m => {
                const reached = streakDays >= m.days;
                const mc = m.color || "#fbbf24";
                return (
                  <div key={m.days} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-lg" style={{
                    background: reached ? `${mc}12` : "rgba(255,255,255,0.02)",
                    border: `1px solid ${reached ? `${mc}40` : "rgba(255,255,255,0.05)"}`,
                  }}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold" style={{ color: reached ? mc : "rgba(255,255,255,0.3)" }}>
                        {reached ? "✓" : "○"} {m.label}
                      </span>
                      {m.cosmetic && (
                        <span className="text-xs truncate" style={{ color: reached ? `${mc}bb` : "rgba(255,255,255,0.15)", fontSize: 12 }}>
                          {m.cosmetic}
                        </span>
                      )}
                    </div>
                    <span className="flex-shrink-0" style={{ color: reached ? mc : "rgba(255,255,255,0.2)" }}>
                      {m.reward}
                    </span>
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
