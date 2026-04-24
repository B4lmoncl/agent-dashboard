"use client";

import { useEffect, useState, useCallback } from "react";
import { getBalance } from "@/lib/balance-cache";
import CountUp from "@/components/CountUp";
import type { User } from "@/app/types";
import { ModalPortal } from "@/components/ModalPortal";
import { Tip } from "@/components/GameTooltip";
import { getAuthHeaders } from "@/lib/auth-client";
import { useDashboard } from "@/app/DashboardContext";

interface DashboardModalsProps {
  loggedInUser: User | null;
  animGold: string | number;
  forgeTemp: number;
  forgeTempColor: string;
  forgeTempLabel: string;
  openQuestsCount: number;
  // Currencies modal
  currenciesOpen: boolean;
  setCurrenciesOpen: (v: boolean) => void;
  currencyExpanded: string | null;
  setCurrencyExpanded: (v: string | null) => void;
  // Modifier modal
  modifierOpen: boolean;
  setModifierOpen: (v: boolean) => void;
  // Stat info popups
  streakInfoOpen: boolean;
  setStreakInfoOpen: (v: boolean) => void;
  activeQuestsInfoOpen: boolean;
  setActiveQuestsInfoOpen: (v: boolean) => void;
  xpInfoOpen: boolean;
  setXpInfoOpen: (v: boolean) => void;
  // Quest counts
  inProgressCount: number;
  // Navigation
  onNavigate?: (view: string) => void;
}

export default function DashboardModals({
  loggedInUser, animGold,
  forgeTemp, forgeTempColor, forgeTempLabel,
  openQuestsCount,
  currenciesOpen, setCurrenciesOpen,
  currencyExpanded, setCurrencyExpanded,
  modifierOpen, setModifierOpen,
  streakInfoOpen, setStreakInfoOpen,
  activeQuestsInfoOpen, setActiveQuestsInfoOpen,
  xpInfoOpen, setXpInfoOpen,
  inProgressCount,
  onNavigate,
}: DashboardModalsProps) {
  const { reviewApiKey } = useDashboard();
  // Unified ESC key handler for all modals
  useEffect(() => {
    const anyOpen = currenciesOpen || modifierOpen || streakInfoOpen || activeQuestsInfoOpen || xpInfoOpen;
    if (!anyOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (currenciesOpen) { setCurrenciesOpen(false); setCurrencyExpanded(null); }
      if (modifierOpen) setModifierOpen(false);
      if (streakInfoOpen) setStreakInfoOpen(false);
      if (activeQuestsInfoOpen) setActiveQuestsInfoOpen(false);
      if (xpInfoOpen) setXpInfoOpen(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [currenciesOpen, modifierOpen, streakInfoOpen, activeQuestsInfoOpen, xpInfoOpen]);

  // Scroll lock handled by useModalBehavior in page.tsx (lines 357-365)

  // Currency conversion state
  const [conversionOpen, setConversionOpen] = useState(false);
  const [convFrom, setConvFrom] = useState("gold");
  const [convTo, setConvTo] = useState("runensplitter");
  const [convAmount, setConvAmount] = useState("");
  const [convConverting, setConvConverting] = useState(false);
  const [convResult, setConvResult] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const ALLOWED_PAIRS = [
    { from: "gold", to: "runensplitter", rate: 0.1 },
    { from: "stardust", to: "runensplitter", rate: 2 },
    { from: "runensplitter", to: "gold", rate: 0.15 },
    { from: "gold", to: "gildentaler", rate: 3 },
    { from: "gildentaler", to: "gold", rate: 0.25 },
  ];
  const TAX_RATE = 0.20;

  const currentPair = ALLOWED_PAIRS.find(p => p.from === convFrom && p.to === convTo);
  const convAmtNum = Math.max(0, Math.floor(Number(convAmount) || 0));
  const convReceived = currentPair && convAmtNum > 0 ? Math.floor(convAmtNum * currentPair.rate * (1 - TAX_RATE)) : 0;
  const convBalance = loggedInUser?.currencies?.[convFrom as keyof typeof loggedInUser.currencies] ?? 0;

  const handleConvert = useCallback(async () => {
    if (!loggedInUser || convConverting || convAmtNum <= 0 || !currentPair || convAmtNum > (convBalance as number)) return;
    setConvConverting(true);
    try {
      const r = await fetch(`/api/currency/${loggedInUser.id}/convert`, {
        method: "POST",
        headers: { ...getAuthHeaders(reviewApiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ from: convFrom, to: convTo, amount: convAmtNum }),
      });
      const d = await r.json();
      if (r.ok) {
        setConvResult({ text: `Converted ${d.spent} ${convFrom} → ${d.received} ${convTo}`, type: "success" });
        setConvAmount("");
        // Sync displayed balances from backend response (mutation is intentional —
        // loggedInUser.currencies is the live object from state.users, and we
        // update it to reflect the conversion immediately without full refresh)
        if (d.currencies && loggedInUser?.currencies) {
          Object.assign(loggedInUser.currencies, d.currencies);
        }
      } else {
        setConvResult({ text: d.error || "Conversion failed", type: "error" });
      }
    } catch {
      setConvResult({ text: "Network error", type: "error" });
    }
    setConvConverting(false);
    setTimeout(() => setConvResult(null), 3000);
  }, [loggedInUser, convConverting, convAmtNum, currentPair, convBalance, convFrom, convTo]);

  // When convFrom changes, auto-pick a valid "to"
  useEffect(() => {
    const validTo = ALLOWED_PAIRS.filter(p => p.from === convFrom);
    if (validTo.length > 0 && !validTo.find(p => p.to === convTo)) {
      setConvTo(validTo[0].to);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convFrom]); // convTo intentionally excluded — we WANT to reset it when convFrom changes

  const CURRENCY_SOURCE: Record<string, { view: string; label: string }> = {
    gold: { view: "questBoard", label: "Quest Board" },
    stardust: { view: "gacha", label: "Vault of Fate" },
    essenz: { view: "forge", label: "Artisan's Quarter" },
    runensplitter: { view: "questBoard", label: "Quest Board" },
    gildentaler: { view: "social", label: "The Breakaway" },
    sternentaler: { view: "challenges", label: "Challenges" },
  };

  const CURRENCY_HOW: Record<string, string> = {
    gold: "Earned from quests, rituals, and NPC chains. Multiplied by Streak, Forge Temperature, Weisheit stat, and Legendary gear. Used for Bazaar, crafting, and gear. Convertible to Runensplitter and Gildentaler.",
    stardust: "Awarded on level-up (5 + level). Used for Featured Gacha banner pulls. Convertible to Runensplitter.",
    essenz: "From daily login bonus, streak milestones, and item dismantling (Schmiedekunst). Used for profession switching and crafting recipes.",
    runensplitter: "Reward for every completed quest and daily login. Extra from streak milestones and gacha duplicates. Main currency for standard Gacha pulls. Convertible with Gold.",
    gildentaler: "Earned from Social and Co-op quests (+5 per quest). Redeemable for guild items in the shop. Convertible with Gold.",
    mondstaub: "Only from extreme consistency — long streak milestones and rare events. Reserved for limited rewards. Not convertible.",
    sternentaler: "Exclusive from weekly challenges (Star Path + Expedition). Redeemable for exclusive weekly rewards. Not convertible.",
  };

  return (
    <>
      {/* Currencies Modal */}
      {currenciesOpen && (() => {
        return (
          <ModalPortal>
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 modal-backdrop"
              onClick={() => { setCurrenciesOpen(false); setCurrencyExpanded(null); }}>
              <div className="w-full max-w-xs rounded-2xl p-5 bg-surface-alt border-w10" style={{ maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-primary">Währungen</h3>
                  <button onClick={() => { setCurrenciesOpen(false); setCurrencyExpanded(null); }} className="btn-close" aria-label="Schließen">×</button>
                </div>
                <div className="space-y-2 overflow-y-auto flex-1 scrollbar-rpg" style={{ scrollbarWidth: "thin" as const }}>
                  {[
                    { name: "Gold", key: "gold" as const, value: loggedInUser?.currencies?.gold ?? animGold, color: "#f59e0b", desc: "Das ehrliche Metall der Halle.", iconSrc: "/images/icons/currency-gold.png" },
                    { name: "Stardust", key: "stardust" as const, value: loggedInUser?.currencies?.stardust ?? 0, color: "#a78bfa", desc: "Geronnenes Sternenlicht.", iconSrc: "/images/icons/currency-stardust.png" },
                    { name: "Essenz", key: "essenz" as const, value: loggedInUser?.currencies?.essenz ?? 0, color: "#ef4444", desc: "Die stille Essenz der Beständigkeit.", iconSrc: "/images/icons/currency-essenz.png" },
                    { name: "Runensplitter", key: "runensplitter" as const, value: loggedInUser?.currencies?.runensplitter ?? 0, color: "#818cf8", desc: "Echos einer vergessenen Sprache.", iconSrc: "/images/icons/currency-runensplitter.png" },
                    { name: "Gildentaler", key: "gildentaler" as const, value: loggedInUser?.currencies?.gildentaler ?? 0, color: "#10b981", desc: "Münzen der Kameradschaft.", iconSrc: "/images/icons/currency-gildentaler.png" },
                    { name: "Mondstaub", key: "mondstaub" as const, value: loggedInUser?.currencies?.mondstaub ?? 0, color: "#c084fc", desc: "Hauch der Konzentration. Extrem selten.", iconSrc: "/images/icons/currency-mondstaub.png" },
                    { name: "Sternentaler", key: "sternentaler" as const, value: loggedInUser?.currencies?.sternentaler ?? 0, color: "#fbbf24", desc: "Exklusiv aus wöchentlichen Herausforderungen.", iconSrc: "/images/icons/currency-sternentaler.png" },
                  ].map(c => (
                    <div key={c.name}>
                      <div
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors"
                        style={{ background: currencyExpanded === c.key ? `${c.color}12` : "rgba(255,255,255,0.03)", border: `1px solid ${currencyExpanded === c.key ? c.color + "30" : "rgba(255,255,255,0.07)"}` }}
                        onClick={() => setCurrencyExpanded(currencyExpanded === c.key ? null : c.key)}
                      >
                        <img src={c.iconSrc} alt="" width={32} height={32} className={`currency-infused currency-${c.key} ${c.key === "stardust" ? "premium-stardust" : c.key === "runensplitter" ? "premium-rune-shards" : ""}`} style={{ imageRendering: "auto" }} onError={(e) => { const t = e.currentTarget; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold" style={{ color: c.color }}>{c.name}</p>
                          <p className="text-xs text-w30">{c.desc}</p>
                        </div>
                        <span className="text-sm font-mono font-bold" style={{ color: c.value === 0 && c.key !== "gold" ? "rgba(255,255,255,0.2)" : c.color }}>
                          {c.value === 0 && c.key !== "gold" ? "—" : <CountUp value={Number(c.value) || 0} duration={600} />}
                        </span>
                      </div>
                      {currencyExpanded === c.key && (
                        <div className="rounded-b-xl px-4 py-3 -mt-1" style={{ background: `${c.color}08`, borderLeft: `1px solid ${c.color}30`, borderRight: `1px solid ${c.color}30`, borderBottom: `1px solid ${c.color}30` }}>
                          <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: `${c.color}99` }}>How to earn {c.name}</p>
                          <p className="text-xs leading-relaxed text-w55">{CURRENCY_HOW[c.key]}</p>
                          {onNavigate && CURRENCY_SOURCE[c.key] && (
                            <button
                              onClick={() => { setCurrenciesOpen(false); setCurrencyExpanded(null); onNavigate(CURRENCY_SOURCE[c.key].view); }}
                              className="mt-2 w-full text-xs font-semibold py-1.5 rounded-lg btn-interactive"
                              style={{ background: `${c.color}15`, color: c.color, border: `1px solid ${c.color}30`, cursor: "pointer" }}
                            >
                              Go to {CURRENCY_SOURCE[c.key].label} {"\u2192"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Currency Conversion */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, marginTop: 8 }}>
                  <button
                    onClick={() => setConversionOpen(!conversionOpen)}
                    className="w-full text-xs font-semibold py-1.5 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
                  >
                    {conversionOpen ? "Ausblenden" : "Währungen tauschen"} {conversionOpen ? "▲" : "▼"}
                  </button>

                  {conversionOpen && (
                    <div className="mt-2 rounded-xl p-3 space-y-2 tab-content-enter" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <p className="text-xs text-w30">20% tax on all conversions</p>

                      {/* From / To selectors */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <p className="text-xs text-w25 mb-0.5">From</p>
                          <select
                            value={convFrom}
                            onChange={e => setConvFrom(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 rounded input-dark"
                            style={{ cursor: "pointer" }}
                          >
                            {[...new Set(ALLOWED_PAIRS.map(p => p.from))].map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                        <span className="text-xs text-w20 mt-4">{"\u2192"}</span>
                        <div className="flex-1">
                          <p className="text-xs text-w25 mb-0.5">To</p>
                          <select
                            value={convTo}
                            onChange={e => setConvTo(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 rounded input-dark"
                            style={{ cursor: "pointer" }}
                          >
                            {ALLOWED_PAIRS.filter(p => p.from === convFrom).map(p => (
                              <option key={p.to} value={p.to}>{p.to}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Amount */}
                      <div>
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-xs text-w25">Amount</p>
                          <p className="text-xs font-mono text-w25">Balance: {(convBalance as number).toLocaleString()}</p>
                        </div>
                        <input
                          type="number"
                          min={1}
                          max={convBalance as number}
                          value={convAmount}
                          onChange={e => setConvAmount(e.target.value)}
                          placeholder="0"
                          className="w-full text-xs px-2 py-1.5 rounded input-dark font-mono"
                        />
                      </div>

                      {/* Preview */}
                      {convAmtNum > 0 && currentPair && (
                        <div className="flex items-center justify-between px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.05)" }}>
                          <span className="text-xs text-w40">You receive</span>
                          <span className="text-xs font-mono font-bold" style={{ color: convReceived > 0 ? "#22c55e" : "#ef4444" }}>
                            {convReceived > 0 ? convReceived.toLocaleString() : "0 (too small)"} {convTo}
                          </span>
                        </div>
                      )}

                      {/* Result message */}
                      {convResult && (
                        <p className="text-xs font-semibold" style={{ color: convResult.type === "success" ? "#22c55e" : "#ef4444" }}>
                          {convResult.text}
                        </p>
                      )}

                      {/* Convert button */}
                      <button
                        onClick={handleConvert}
                        disabled={convConverting || convAmtNum <= 0 || convReceived <= 0 || convAmtNum > (convBalance as number)}
                        title={
                          convAmtNum <= 0 ? "Enter an amount" :
                          convAmtNum > (convBalance as number) ? `Not enough ${convFrom}` :
                          convReceived <= 0 ? "Amount too small after tax" :
                          `Convert ${convAmtNum} ${convFrom} → ${convReceived} ${convTo}`
                        }
                        className="w-full text-xs font-bold py-2 rounded-lg"
                        style={{
                          background: convAmtNum > 0 && convReceived > 0 && convAmtNum <= (convBalance as number) ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                          color: convAmtNum > 0 && convReceived > 0 && convAmtNum <= (convBalance as number) ? "#22c55e" : "rgba(255,255,255,0.2)",
                          border: `1px solid ${convAmtNum > 0 && convReceived > 0 ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
                          cursor: convConverting || convAmtNum <= 0 || convReceived <= 0 || convAmtNum > (convBalance as number) ? "not-allowed" : "pointer",
                          opacity: convConverting ? 0.5 : 1,
                        }}
                      >
                        {convConverting ? "Converting..." : "Convert"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalPortal>
        );
      })()}

      {/* Modifier Breakdown Modal */}
      {modifierOpen && loggedInUser?.modifiers && (
        <ModalPortal>
          <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}
            onClick={() => setModifierOpen(false)}>
            <div className="absolute inset-0 modal-backdrop-blur" />
            <div className="relative rounded-2xl p-5 bg-surface border-w12" style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.7)", minWidth: "min(320px, calc(100vw - 2rem))", maxWidth: 400, maxHeight: "85vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <Tip k="bonus_stacking"><h3 className="text-sm font-bold text-bright cursor-help">Modifikator-Übersicht</h3></Tip>
                <button onClick={() => setModifierOpen(false)} className="btn-close" aria-label="Schließen">×</button>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#a855f7" }}>XP Modifier</span>
                  <span className="text-lg font-mono font-black" style={{ color: loggedInUser.modifiers.xp.total >= 1 ? "#a855f7" : "#ef4444" }}>×{loggedInUser.modifiers.xp.total}</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: "Forge Temp", val: loggedInUser.modifiers.xp.forge, color: forgeTempColor, desc: `${forgeTemp}% — ${forgeTempLabel}` },
                    { label: "Kraft", val: loggedInUser.modifiers.xp.kraft ?? 1, color: "#f97316", desc: (loggedInUser.modifiers.xp.kraft ?? 1) > 1 ? `+${(((loggedInUser.modifiers.xp.kraft ?? 1) - 1) * 100).toFixed(1)}% (${(getBalance().stats.kraft?.effect || 0.005) * 100}% per Kraft point)` : "No Kraft bonus" },
                    { label: "Gear", val: loggedInUser.modifiers.xp.gear, color: "#818cf8", desc: loggedInUser.modifiers.xp.gear > 1 ? `+${Math.round((loggedInUser.modifiers.xp.gear - 1) * 100)}% from Tools` : "No Gear bonus" },
                    { label: "Companions", val: loggedInUser.modifiers.xp.companions, color: "#f472b6", desc: loggedInUser.modifiers.xp.companions > 1 ? `+${Math.round((loggedInUser.modifiers.xp.companions - 1) * 100)}% (2% per Companion)` : "No Companions summoned" },
                    { label: "Bond Level", val: loggedInUser.modifiers.xp.bond, color: "#fb923c", desc: loggedInUser.modifiers.xp.bond > 1 ? `+${Math.round((loggedInUser.modifiers.xp.bond - 1) * 100)}% (1% per Bond Level)` : "Bond Level 1" },
                    { label: "Quest Hoarding", val: loggedInUser.modifiers.xp.hoarding, color: "#ef4444", desc: loggedInUser.modifiers.xp.hoarding < 1 ? `-${loggedInUser.modifiers.xp.hoardingPct}% XP (${loggedInUser.modifiers.xp.hoardingCount} in progress, ${loggedInUser.modifiers.xp.hoardingCount - 20} over limit)` : `No malus (${loggedInUser.modifiers.xp.hoardingCount}/20 slots used)` },
                    ...(loggedInUser.modifiers.xp.legendary && loggedInUser.modifiers.xp.legendary !== 1 ? [{ label: "Legendary", val: loggedInUser.modifiers.xp.legendary, color: "#f97316", desc: `+${Math.round((loggedInUser.modifiers.xp.legendary - 1) * 100)}% from Legendary Gear` }] : []),
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between px-2 py-1 rounded-lg" style={{ background: r.val !== 1 ? "rgba(255,255,255,0.03)" : "transparent" }}>
                      <div>
                        <span className="text-xs font-medium" style={{ color: r.val !== 1 ? "#f0f0f0" : "rgba(255,255,255,0.3)" }}>{r.label}</span>
                        <p className="text-xs text-w30">{r.desc}</p>
                      </div>
                      <span className="font-mono font-bold text-sm" style={{ color: r.val !== 1 ? r.color : "rgba(255,255,255,0.2)" }}>×{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#fbbf24" }}>Gold Modifier</span>
                  <span className="text-lg font-mono font-black" style={{ color: "#fbbf24" }}>×{loggedInUser.modifiers.gold.total}</span>
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: "Forge Temp", val: loggedInUser.modifiers.gold.forge, color: forgeTempColor, desc: `${forgeTemp}% — ${forgeTempLabel}` },
                    { label: "Weisheit", val: loggedInUser.modifiers.gold.weisheit ?? 1, color: "#60a5fa", desc: (loggedInUser.modifiers.gold.weisheit ?? 1) > 1 ? `+${(((loggedInUser.modifiers.gold.weisheit ?? 1) - 1) * 100).toFixed(1)}% (${(getBalance().stats.weisheit?.effect || 0.004) * 100}% per Weisheit point)` : "No Weisheit bonus" },
                    { label: "Streak", val: loggedInUser.modifiers.gold.streak, color: "#f97316", desc: `${loggedInUser.streakDays ?? 0} days (+1.5% per day, max ×1.45)` },
                    ...(loggedInUser.modifiers.gold.legendary && loggedInUser.modifiers.gold.legendary !== 1 ? [{ label: "Legendary", val: loggedInUser.modifiers.gold.legendary, color: "#f97316", desc: `+${Math.round((loggedInUser.modifiers.gold.legendary - 1) * 100)}% from Legendary Gear` }] : []),
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between px-2 py-1 rounded-lg" style={{ background: r.val !== 1 ? "rgba(255,255,255,0.03)" : "transparent" }}>
                      <div>
                        <span className="text-xs font-medium" style={{ color: r.val !== 1 ? "#f0f0f0" : "rgba(255,255,255,0.3)" }}>{r.label}</span>
                        <p className="text-xs text-w30">{r.desc}</p>
                      </div>
                      <span className="font-mono font-bold text-sm" style={{ color: r.val !== 1 ? r.color : "rgba(255,255,255,0.2)" }}>×{r.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Streak Info Popup */}
      {streakInfoOpen && (
        <ModalPortal>
          <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} onClick={() => setStreakInfoOpen(false)}>
            <div className="absolute inset-0 modal-backdrop-blur" />
            <div className="relative rounded-2xl p-5 bg-surface border-w12" style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.7)", minWidth: "min(300px, calc(100vw - 2rem))", maxWidth: 380, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ color: "#f97316" }}>Forge Streak</h3>
                <button onClick={() => setStreakInfoOpen(false)} className="btn-close" aria-label="Schließen">×</button>
              </div>
              <p className="text-xs leading-relaxed mb-3 text-w60">
                Your consecutive days of quest completion. Keep the streak alive to earn bonus XP and keep companions happy.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-w3">
                  <span className="text-xs text-w50">Aktueller Streak</span>
                  <span className="font-mono font-bold text-sm" style={{ color: "#f97316" }}>{loggedInUser?.streakDays ?? 0}d</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-w3">
                  <span className="text-xs text-w50">Gold Bonus</span>
                  <span className="font-mono font-bold text-sm" style={{ color: "#fbbf24" }}>+{Math.min(((loggedInUser?.streakDays ?? 0) * 1.5), 45).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Active Quests Info Popup */}
      {activeQuestsInfoOpen && (
        <ModalPortal>
          <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} onClick={() => setActiveQuestsInfoOpen(false)}>
            <div className="absolute inset-0 modal-backdrop-blur" />
            <div className="relative rounded-2xl p-5 bg-surface border-w12" style={{ boxShadow: "0 12px 48px rgba(0,0,0,0.7)", minWidth: "min(300px, calc(100vw - 2rem))", maxWidth: 380, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ color: "#ef4444" }}>Quests</h3>
                <button onClick={() => setActiveQuestsInfoOpen(false)} className="btn-close" aria-label="Schließen">×</button>
              </div>
              <p className="text-xs leading-relaxed mb-3 text-w60">
                Your quest overview. Claiming too many quests at once (&gt;20) will apply an XP hoarding penalty.
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-w3">
                  <span className="text-xs text-w50">In Progress</span>
                  <span className="font-mono font-bold text-sm" style={{ color: "#ef4444" }}>{inProgressCount}</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-w3">
                  <span className="text-xs text-w50">Open on Board</span>
                  <span className="font-mono font-bold text-sm text-w50">{openQuestsCount}</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-w3">
                  <span className="text-xs text-w50">Total Completed</span>
                  <span className="font-mono font-bold text-sm" style={{ color: "#22c55e" }}>{loggedInUser?.questsCompleted ?? 0}</span>
                </div>
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-w3">
                  <span className="text-xs text-w50">Total XP Earned</span>
                  <span className="font-mono font-bold text-sm" style={{ color: "#a855f7" }}>{loggedInUser?.xp ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* XP Info Popup */}
      {xpInfoOpen && (
        <ModalPortal>
          <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }} onClick={() => setXpInfoOpen(false)}>
            <div className="absolute inset-0 modal-backdrop-blur" />
            <div className="relative rounded-2xl p-5 bg-surface" style={{ border: "1px solid rgba(167,139,250,0.25)", boxShadow: "0 12px 48px rgba(0,0,0,0.7)", minWidth: "min(320px, calc(100vw - 2rem))", maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold" style={{ color: "#a78bfa" }}>How XP Works</h3>
                <button onClick={() => setXpInfoOpen(false)} className="btn-close" aria-label="Schließen">×</button>
              </div>
              <p className="text-xs leading-relaxed mb-4 text-w55">
                XP scales with quest rarity. Higher rarity quests reward significantly more experience.
              </p>
              <div className="space-y-1.5 mb-4">
                {([
                  { rarity: "Common",    color: "#9ca3af", xp: 10 },
                  { rarity: "Uncommon",  color: "#22c55e", xp: 18 },
                  { rarity: "Rare",      color: "#3b82f6", xp: 30 },
                  { rarity: "Epic",      color: "#a855f7", xp: 50 },
                  { rarity: "Legendary", color: "#f97316", xp: 80 },
                ] as { rarity: string; color: string; xp: number }[]).map(({ rarity, color, xp }) => (
                  <div key={rarity} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-w3" style={{ border: `1px solid ${color}22` }}>
                    <span className="text-xs font-semibold" style={{ color }}>{rarity}</span>
                    <span className="font-mono font-bold text-sm" style={{ color: "#a78bfa" }}>{xp} XP</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg px-3 py-2.5 mb-3" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
                <p className="text-xs leading-relaxed text-w50">
                  Your <span style={{ color: "#a78bfa" }}>Forge</span>, <span style={{ color: "#fbbf24" }}>Gear</span>, and <span style={{ color: "#f43f5e" }}>Companion</span> bonuses multiply all earned XP — stack them for maximum gains.
                </p>
              </div>
              <p className="text-xs leading-relaxed text-w30">
                Higher levels require exponentially more XP. Every level up is an achievement.
              </p>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
