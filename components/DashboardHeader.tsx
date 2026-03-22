"use client";

import { useRef, useEffect, useState } from "react";
import type { User, Quest, QuestsData } from "@/app/types";
import { createStarterQuestsIfNew, CURRENT_SEASON } from "@/app/utils";
import { SFX } from "@/lib/sounds";
import { setAccessToken, clearAuth } from "@/lib/auth-client";
import { TipCustom } from "@/components/GameTooltip";

interface DashboardHeaderProps {
  dashView: string;
  setDashView: (v: string) => void;
  playerName: string;
  setPlayerName: (v: string) => void;
  loggedInUser: User | null;
  playerLevelInfo: { level: number; title: string };
  reviewApiKey: string;
  setReviewApiKey: (v: string) => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  needsAttention: number;
  suggestedCount: number;
  apiLive: boolean;
  lastUpdatedStr: string;
  refresh: () => Promise<void>;
  setOnboardingOpen: (v: boolean) => void;
  setInfoOverlayOpen: (v: boolean) => void;
  setInfoOverlayTab: (v: "roadmap" | "changelog" | "guide") => void;
  onTodayOpen?: () => void;
}

export default function DashboardHeader({
  dashView, setDashView,
  playerName, setPlayerName,
  loggedInUser, playerLevelInfo,
  reviewApiKey, setReviewApiKey,
  isAdmin, setIsAdmin,
  needsAttention, suggestedCount,
  apiLive, lastUpdatedStr,
  refresh,
  setOnboardingOpen,
  setInfoOverlayOpen, setInfoOverlayTab,
  onTodayOpen,
}: DashboardHeaderProps) {
  const settingsPopupRef = useRef<HTMLDivElement>(null);
  const [settingsPopupOpen, setSettingsPopupOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [reviewKeyInput, setReviewKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [soundMuted, setSoundMuted] = useState(() => {
    try { return localStorage.getItem("qh_sound_muted") === "1"; } catch { return false; }
  });

  // Init sound system from stored preference
  useEffect(() => {
    SFX.initFromStorage();
  }, []);

  const toggleMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    SFX.setMuted(next);
    if (!next) SFX.click(); // play a click to confirm unmute
  };

  // Settings popup — click-outside to close
  useEffect(() => {
    if (!settingsPopupOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsPopupRef.current && !settingsPopupRef.current.contains(e.target as Node)) {
        setSettingsPopupOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsPopupOpen]);

  const handleLogin = async () => {
    if (!reviewKeyInput || !playerNameInput || authLoading) return;
    setAuthLoading(true);
    try {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerNameInput, password: reviewKeyInput }),
    });
    const data = await r.json();
    if (data.success) {
      setAccessToken(data.accessToken || null);
      try { localStorage.setItem("dash_api_key", data.apiKey); } catch { /* private browsing */ }
      try { localStorage.setItem("dash_player_name", data.name); } catch { /* private browsing */ }
      setPlayerName(data.name);
      setReviewApiKey(data.apiKey);
      setIsAdmin(data.isAdmin);
      setLoginOpen(false);
      setLoginError("");
      createStarterQuestsIfNew(data.name, data.apiKey).then(() => refresh());
    } else {
      setLoginError(data.error || "Invalid credentials");
    }
    } catch { setLoginError("Connection error"); }
    finally { setAuthLoading(false); }
  };

  const handleRegister = async () => {
    if (!registerName.trim() || authLoading) return;
    if (registerPassword.length < 6) { setRegisterError("Password must be at least 6 characters"); return; }
    if (registerPassword !== registerPasswordConfirm) { setRegisterError("Passwords do not match"); return; }
    setAuthLoading(true);
    try {
    const r = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: registerName.trim(), password: registerPassword }),
    });
    const data = await r.json();
    if (r.ok) {
      setRegisterSuccess(true);
      setAccessToken(data.accessToken || null);
      try { localStorage.setItem("dash_api_key", data.apiKey); } catch { /* private browsing */ }
      try { localStorage.setItem("dash_player_name", data.name); } catch { /* private browsing */ }
      setPlayerName(data.name);
      setReviewApiKey(data.apiKey);
      setIsAdmin(false);
      setRegisterError("");
      setRegisterPassword("");
      setRegisterPasswordConfirm("");
      await createStarterQuestsIfNew(data.name, data.apiKey);
      await refresh();
    } else {
      setRegisterError(data.error || "Registration failed");
    }
    } catch { setRegisterError("Connection error"); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    // Revoke refresh token on server + clear local state
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    clearAuth();
    setReviewApiKey("");
    setPlayerName("");
    setIsAdmin(false);
    setSettingsPopupOpen(false);
  };

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-xl"
      style={{
        position: "relative",
        zIndex: 40,
        background: "rgba(11,13,17,0.35)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(255,68,68,0.15)",
        overflow: "visible",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between" style={{ overflow: "visible" }}>
        <div className="flex items-center gap-3">
          <button
            data-feedback-id="header.guild-gate"
            className="flex items-center gap-2"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", transition: "opacity 0.15s", alignSelf: "flex-start" }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
            onClick={() => { setDashView("questBoard"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            title="Home — Quest Hall"
          >
            <img src="/guild-gate.png" alt="Quest Hall" className="h-20 w-20" style={{ imageRendering: "auto", display: "block", marginBottom: "-8px", marginTop: "4px" }} />
            <span className="font-semibold text-sm tracking-tight text-primary">
              Quest Hall
            </span>
          </button>
          <button
            data-feedback-id="header.season-badge"
            className="text-xs px-2 py-0.5 rounded font-medium btn-interactive"
            style={{ color: CURRENT_SEASON.color, background: CURRENT_SEASON.bg, border: `1px solid ${CURRENT_SEASON.color}40`, cursor: "pointer" }}
            onClick={() => setDashView("season")}
          >
            <TipCustom title={`Season: ${CURRENT_SEASON.name}`} icon={CURRENT_SEASON.icon} accent={CURRENT_SEASON.color} body={<p>Current season. Click to view the Season tab with details and seasonal rewards.</p>}>
              <span>{CURRENT_SEASON.icon} {CURRENT_SEASON.name}</span>
            </TipCustom>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button
            data-feedback-id="header.sound-toggle"
            onClick={toggleMute}
            className="btn-interactive text-xs px-2 py-0.5 rounded text-w40 bg-w5 border-w10"
            title={soundMuted ? "Enable sound" : "Mute sound"}
            aria-label={soundMuted ? "Unmute sound effects" : "Mute sound effects"}
            style={{ minWidth: 28, textAlign: "center" }}
          >
            {soundMuted ? "🔇" : "🔊"}
          </button>
          {onTodayOpen && playerName && (
            <button
              onClick={onTodayOpen}
              className="btn-interactive text-xs px-2 py-0.5 rounded font-semibold"
              style={{ background: "rgba(129,140,248,0.1)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.2)" }}
              title="Today's tasks"
              aria-label="Open today's task overview"
            >
              📅 Today
            </button>
          )}
          <button
            data-feedback-id="header.info-button"
            onClick={() => { setInfoOverlayTab("guide"); setInfoOverlayOpen(true); }}
            className="btn-interactive text-xs px-2 py-0.5 rounded text-w40 bg-w5 border-w10"
            title="Info, Guide & Tutorial"
            aria-label="Open info, guide and tutorial"
          >
            Info
          </button>
          {/* Login / User area */}
          <div className="relative" data-tutorial="login-btn" data-feedback-id="header.login-badge">
            {reviewApiKey && playerName ? (
              <div ref={settingsPopupRef} className="flex items-center gap-2">
                <button
                  title={`${playerName} — Settings`}
                  onClick={() => setSettingsPopupOpen(v => !v)}
                  className="btn-interactive flex items-center justify-center font-bold flex-shrink-0"
                  style={{
                    width: 48, height: 48, borderRadius: "50%",
                    overflow: "hidden",
                    border: `2px solid ${loggedInUser?.color ?? "#a78bfa"}60`,
                    boxShadow: `0 2px 8px ${loggedInUser?.color ?? "#a78bfa"}40`,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <img src="/images/portraits/hero-male.png" alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "auto" }} onError={e => { const t = e.currentTarget as HTMLImageElement; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; (t.nextElementSibling as HTMLElement).style.display = "flex"; }} />
                  <div style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${loggedInUser?.color ?? "#a78bfa"}, ${loggedInUser?.color ?? "#a78bfa"}88)`, color: "#fff", fontSize: 13, fontWeight: "bold" }}>{playerName.slice(0, 1).toUpperCase()}</div>
                </button>
                {settingsPopupOpen && (
                  <div className="absolute right-0 top-9 z-50 rounded-xl shadow-xl flex flex-col bg-surface-alt border-w10" style={{ minWidth: 200, overflow: "hidden" }}>
                    <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: `linear-gradient(135deg, ${loggedInUser?.color ?? "#a78bfa"}, ${loggedInUser?.color ?? "#a78bfa"}88)`, color: "#fff" }}>
                          {playerName.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-primary">{playerName}</p>
                          <p className="text-xs text-w35">Lv.{playerLevelInfo.level} · {playerLevelInfo.title}</p>
                        </div>
                      </div>
                    </div>
                    <button
                      className="flex items-center gap-2 px-4 py-2.5 text-xs text-left text-w50"
                      style={{ background: "none", border: "none", cursor: "not-allowed", opacity: 0.5 }}
                    >
                      Settings <span className="text-w25">(coming soon)</span>
                    </button>
                    <div className="bg-w7" style={{ height: 1, margin: "0 12px" }} />
                    <button
                      className="flex items-center gap-2 px-4 py-2.5 text-xs text-left"
                      style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "none"}
                      onClick={handleLogout}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => setLoginOpen(v => !v)}
                  className="btn-interactive text-xs px-2 py-0.5 rounded text-w40 bg-w5 border-w10"
                >
                  Login
                </button>
                {loginOpen && (
                  <div className="absolute right-0 top-7 z-50 rounded-xl p-3 shadow-xl flex flex-col gap-2 bg-surface-alt" style={{ border: "1px solid rgba(139,92,246,0.3)", minWidth: "220px" }}>
                    {!registerOpen ? (
                      <>
                        <input
                          type="text"
                          value={playerNameInput}
                          onChange={e => setPlayerNameInput(e.target.value)}
                          placeholder="Your name"
                          className="text-xs px-2 py-1 rounded input-dark"
                        />
                        <input
                          type="password"
                          value={reviewKeyInput}
                          onChange={e => setReviewKeyInput(e.target.value)}
                          placeholder="Password"
                          className="text-xs px-2 py-1 rounded input-dark"
                          onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
                        />
                        {loginError && <p role="alert" className="text-xs" style={{ color: "#ef4444" }}>{loginError}</p>}
                        <div className="flex gap-1">
                          <button
                            onClick={handleLogin}
                            disabled={authLoading}
                            className="flex-1 text-xs px-3 py-1 rounded font-medium"
                            style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)", opacity: authLoading ? 0.5 : 1 }}
                          >
                            {authLoading ? "Signing in…" : "Sign In"}
                          </button>
                          <button
                            onClick={() => { setLoginOpen(false); setOnboardingOpen(true); }}
                            className="text-xs px-3 py-1 rounded font-medium"
                            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                          >
                            Register
                          </button>
                        </div>
                      </>
                    ) : registerSuccess ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>Account Created!</p>
                        <p className="text-xs text-w50">You are now logged in.</p>
                        <button
                          onClick={() => { setRegisterOpen(false); setRegisterSuccess(false); setLoginOpen(false); }}
                          className="text-xs px-3 py-1 rounded font-medium"
                          style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.4)" }}
                        >
                          Done
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold" style={{ color: "#22c55e" }}>Create Account</p>
                        <input type="text" value={registerName} onChange={e => setRegisterName(e.target.value)} placeholder="Choose a name" className="text-xs px-2 py-1 rounded input-dark" />
                        <input type="password" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} placeholder="Password (min 6 chars)" className="text-xs px-2 py-1 rounded input-dark" />
                        <input type="password" value={registerPasswordConfirm} onChange={e => setRegisterPasswordConfirm(e.target.value)} placeholder="Confirm password" className="text-xs px-2 py-1 rounded input-dark" />
                        {registerError && <p role="alert" className="text-xs" style={{ color: "#ef4444" }}>{registerError}</p>}
                        <div className="flex gap-1">
                          <button onClick={handleRegister} disabled={authLoading} className="flex-1 text-xs px-3 py-1 rounded font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", opacity: authLoading ? 0.5 : 1 }}>{authLoading ? "Creating…" : "Create"}</button>
                          <button onClick={() => { setRegisterOpen(false); setRegisterError(""); setRegisterPassword(""); setRegisterPasswordConfirm(""); }} className="text-xs px-2 py-1 rounded text-w30 bg-w4 border-w8">Back</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          {needsAttention > 0 && (
            <div className="text-xs px-2 py-0.5 rounded font-medium" style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
              {needsAttention} need attention
            </div>
          )}
          {suggestedCount > 0 && (
            <div className="text-xs px-2 py-0.5 rounded font-semibold" style={{ color: "#f59e0b", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.35)" }}>
              {suggestedCount} to review
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-w30">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: apiLive ? "#22c55e" : "rgba(255,255,255,0.15)", animation: apiLive ? "pulse-online 2s ease-in-out infinite" : "none" }} />
            {apiLive ? "API Live" : "Static"}
          </div>
          <div className="text-xs font-mono flex items-center gap-1.5 text-w25">
            <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: "rgba(255,102,51,0.5)" }} />
            Updated <span style={{ display: "inline-block", minWidth: "4rem" }}>{lastUpdatedStr}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
