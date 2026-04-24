"use client";

import { useRef, useEffect, useState } from "react";
import type { User, Quest, QuestsData } from "@/app/types";
import { createStarterQuestsIfNew, CURRENT_SEASON } from "@/app/utils";

function LastUpdated({ lastRefresh }: { lastRefresh: Date | null }) {
  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    if (!lastRefresh) return;
    setSecondsAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000));
    const tick = setInterval(() => setSecondsAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000)), 1000);
    return () => clearInterval(tick);
  }, [lastRefresh]);
  if (!lastRefresh) return <span>—</span>;
  return <span>{secondsAgo < 5 ? "gerade eben" : `vor ${secondsAgo}s`}</span>;
}
import { SFX } from "@/lib/sounds";
import { setAccessToken, clearAuth, getAuthHeaders } from "@/lib/auth-client";
import { TipCustom } from "@/components/GameTooltip";
import NotificationCenter from "@/components/NotificationCenter";

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
  lastRefresh: Date | null;
  refresh: () => Promise<void>;
  setOnboardingOpen: (v: boolean) => void;
  setInfoOverlayOpen: (v: boolean) => void;
  setInfoOverlayTab: (v: "roadmap" | "changelog" | "guide") => void;
  onTodayOpen?: () => void;
  onNeedsEmail?: () => void;
}

export default function DashboardHeader({
  dashView, setDashView,
  playerName, setPlayerName,
  loggedInUser, playerLevelInfo,
  reviewApiKey, setReviewApiKey,
  isAdmin, setIsAdmin,
  needsAttention, suggestedCount,
  apiLive, lastRefresh,
  refresh,
  setOnboardingOpen,
  setInfoOverlayOpen, setInfoOverlayTab,
  onTodayOpen,
  onNeedsEmail,
}: DashboardHeaderProps) {
  const settingsPopupRef = useRef<HTMLDivElement>(null);
  const [settingsPopupOpen, setSettingsPopupOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const loginRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loginOpen) return;
    const handler = (e: MouseEvent) => {
      if (loginRef.current && !loginRef.current.contains(e.target as Node)) setLoginOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [loginOpen]);
  const [playerNameInput, setPlayerNameInput] = useState("");
  const [reviewKeyInput, setReviewKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirm, setRegisterPasswordConfirm] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ hasEmail: boolean; email: string | null; emailVerified: boolean } | null>(null);
  const [settingsMsg, setSettingsMsg] = useState("");
  const [changePwCurrent, setChangePwCurrent] = useState("");
  const [changePwNew, setChangePwNew] = useState("");
  const [changePwConfirm, setChangePwConfirm] = useState("");
  const [changePwLoading, setChangePwLoading] = useState(false);
  const [soundMuted, setSoundMuted] = useState(() => {
    try { return localStorage.getItem("qh_sound_muted") === "1"; } catch { return false; }
  });
  const [soundVolume, setSoundVolume] = useState(() => {
    try { const v = localStorage.getItem("qh_sound_volume"); return v != null ? parseFloat(v) : 0.3; } catch { return 0.3; }
  });

  // Init sound system from stored preference
  useEffect(() => {
    SFX.initFromStorage();
    try { const v = localStorage.getItem("qh_sound_volume"); if (v != null) SFX.setVolume(parseFloat(v)); } catch { /* private browsing */ }
  }, []);

  const toggleMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    SFX.setMuted(next);
    if (!next) SFX.click(); // play a click to confirm unmute
  };

  const handleVolumeChange = (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setSoundVolume(clamped);
    SFX.setVolume(clamped);
    try { localStorage.setItem("qh_sound_volume", String(clamped)); } catch { /* private browsing */ }
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

  // Scroll lock + ESC key for settings modal
  useEffect(() => {
    if (!settingsModalOpen) return;
    const w = window as unknown as { _modalLockCount?: number };
    w._modalLockCount = (w._modalLockCount || 0) + 1;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSettingsModalOpen(false); };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      w._modalLockCount = Math.max(0, (w._modalLockCount || 1) - 1);
      if (w._modalLockCount === 0) document.body.style.overflow = "";
    };
  }, [settingsModalOpen]);

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
      // Trigger email migration modal for existing users without email
      if (data.needsEmail && onNeedsEmail) {
        setTimeout(() => onNeedsEmail(), 500);
      }
    } else {
      setLoginError(data.error || "Name oder Passwort stimmen nicht.");
    }
    } catch { setLoginError("Die Leitungen nach Aethermoor flackern. Versuch es nochmal."); }
    finally { setAuthLoading(false); }
  };

  const handleRegister = async () => {
    if (!registerName.trim() || authLoading) return;
    if (!registerEmail.trim() || !registerEmail.includes("@")) { setRegisterError("Gültige E-Mail-Adresse erforderlich."); return; }
    if (registerPassword.length < 8) { setRegisterError("Passwort muss mindestens 8 Zeichen lang sein."); return; }
    if (!/[A-Z]/.test(registerPassword)) { setRegisterError("Passwort braucht mindestens einen Großbuchstaben."); return; }
    if (!/[0-9]/.test(registerPassword)) { setRegisterError("Passwort braucht mindestens eine Zahl."); return; }
    if (registerPassword !== registerPasswordConfirm) { setRegisterError("Passwörter stimmen nicht überein."); return; }
    setAuthLoading(true);
    try {
    const r = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: registerName.trim(), email: registerEmail.trim(), password: registerPassword }),
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
      setRegisterError(data.error || "Anmeldung fehlgeschlagen.");
    }
    } catch { setRegisterError("Die Leitungen nach Aethermoor flackern. Versuch es nochmal."); }
    finally { setAuthLoading(false); }
  };

  const handleLogout = () => {
    // Revoke refresh token on server + clear local state
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(e => console.error('[dashboard-header]', e));
    clearAuth();
    setReviewApiKey("");
    setPlayerName("");
    setIsAdmin(false);
    setSettingsPopupOpen(false);
  };

  return (
    <>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex flex-wrap items-center justify-between gap-y-2" style={{ overflow: "visible" }}>
        <div className="flex items-center gap-3">
          <button
            data-feedback-id="header.guild-gate"
            className="flex items-center gap-2"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", transition: "opacity 0.15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.75"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}
            onClick={() => { setDashView("questBoard"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            title="Home — Quest Hall"
          >
            <img src="/guild-gate.png" alt="Quest Hall" style={{ width: 48, height: 48, imageRendering: "auto", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
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
          {/* Notification Center */}
          <NotificationCenter onNavigate={(v) => setDashView(v)} />
          <div className="flex items-center gap-1.5">
            <button
              data-feedback-id="header.sound-toggle"
              onClick={toggleMute}
              className="btn-interactive text-xs px-2 py-1.5 sm:py-0.5 rounded text-w40 bg-w5 border-w10"
              title={soundMuted ? "Enable sound" : "Mute sound"}
              aria-label={soundMuted ? "Unmute sound effects" : "Mute sound effects"}
              style={{ minWidth: 36, textAlign: "center", fontFamily: "monospace", transition: "background 0.15s, color 0.15s" }}
            >
              {soundMuted ? "×" : "♪"}
            </button>
            {!soundMuted && (
              <input
                type="range"
                min={0} max={100} step={5}
                value={Math.round(soundVolume * 100)}
                onChange={e => handleVolumeChange(parseInt(e.target.value, 10) / 100)}
                className="w-14 h-1 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "#818cf8", background: `linear-gradient(to right, #818cf8 ${soundVolume * 100}%, rgba(255,255,255,0.1) ${soundVolume * 100}%)` }}
                title={`Volume: ${Math.round(soundVolume * 100)}%`}
              />
            )}
          </div>
          <button
            data-feedback-id="header.info-button"
            onClick={() => { setInfoOverlayTab("guide"); setInfoOverlayOpen(true); }}
            className="btn-interactive text-xs px-2 py-1.5 sm:py-0.5 rounded text-w40 bg-w5 border-w10"
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
                  <img src={`/images/portraits/hero-${loggedInUser?.avatarStyle || "male"}.png`} alt={playerName} style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "auto" }} onError={e => { const t = e.currentTarget as HTMLImageElement; t.style.opacity = "0"; t.style.width = "0"; t.style.overflow = "hidden"; (t.nextElementSibling as HTMLElement).style.display = "flex"; }} />
                  <div style={{ display: "none", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: `linear-gradient(135deg, ${loggedInUser?.color ?? "#a78bfa"}, ${loggedInUser?.color ?? "#a78bfa"}88)`, color: "#fff", fontSize: 13, fontWeight: "bold" }}>{playerName.slice(0, 1).toUpperCase()}</div>
                </button>
                {settingsPopupOpen && (
                  <div className="absolute right-0 top-9 z-50 rounded-xl shadow-xl flex flex-col bg-surface-alt border-w10 tab-content-enter" style={{ minWidth: 200, overflow: "hidden" }}>
                    <div className="px-4 py-3 relative" style={{ borderBottom: "1px solid rgba(255,255,255,0.11)" }}>
                      <button onClick={() => setSettingsPopupOpen(false)} aria-label="Schließen" className="absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center" style={{ color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.04)", cursor: "pointer", fontSize: 12 }}>✕</button>
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
                      className="flex items-center gap-2 px-4 py-2.5 text-xs text-left text-w50 relative"
                      style={{ background: "none", border: "none", cursor: "pointer", transition: "background 0.15s ease" }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)"}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "none"}
                      onClick={async () => {
                        setSettingsPopupOpen(false);
                        setSettingsModalOpen(true);
                        try {
                          const r = await fetch("/api/auth/email-status", { headers: getAuthHeaders(reviewApiKey) });
                          if (r.ok) setEmailStatus(await r.json());
                        } catch { /* ignore */ }
                      }}
                    >
                      Settings
                      {emailStatus && !emailStatus.emailVerified && <span className="w-2 h-2 rounded-full" style={{ background: "#f59e0b", position: "absolute", top: 8, right: 12 }} />}
                    </button>
                    <div className="bg-w7" style={{ height: 1, margin: "0 12px" }} />
                    <button
                      className="flex items-center gap-2 px-4 py-2.5 text-xs text-left"
                      style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", transition: "background 0.15s ease" }}
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
                  className="btn-interactive text-xs px-2 py-1.5 sm:py-0.5 rounded text-w40 bg-w5 border-w10"
                >
                  Login
                </button>
                {loginOpen && (
                  <div ref={loginRef} className="absolute right-0 top-7 z-50 rounded-xl p-3 shadow-xl flex flex-col gap-2 bg-surface-alt tab-content-enter" style={{ border: "1px solid rgba(139,92,246,0.3)", minWidth: "min(220px, calc(100vw - 2rem))" }}>
                    {!registerOpen ? (
                      <>
                        <input
                          type="text"
                          value={playerNameInput}
                          onChange={e => setPlayerNameInput(e.target.value)}
                          placeholder="E-Mail oder Name"
                          className="text-xs px-2 py-1 rounded input-dark"
                        />
                        <input
                          type="password"
                          value={reviewKeyInput}
                          onChange={e => setReviewKeyInput(e.target.value)}
                          placeholder="Passwort"
                          className="text-xs px-2 py-1 rounded input-dark"
                          onKeyDown={e => { if (e.key === "Enter") handleLogin(); }}
                        />
                        {loginError && <p role="alert" className="text-xs" style={{ color: "#ef4444" }}>{loginError}</p>}
                        <div className="flex gap-1">
                          <button
                            onClick={handleLogin}
                            disabled={authLoading}
                            title={authLoading ? "Meldet an…" : "In deinen Account einloggen"}
                            className="flex-1 text-xs px-3 py-2 rounded-lg font-bold btn-interactive"
                            style={{ background: "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(139,92,246,0.2))", color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.5)", opacity: authLoading ? 0.5 : 1, cursor: authLoading ? "not-allowed" : "pointer" }}
                          >
                            {authLoading ? "Meldet an…" : "Anmelden"}
                          </button>
                          <button
                            onClick={() => { setLoginOpen(false); setOnboardingOpen(true); }}
                            className="text-xs px-3 py-1 rounded font-medium"
                            style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                          >
                            Registrieren
                          </button>
                        </div>
                        {!forgotOpen ? (
                          <button onClick={() => setForgotOpen(true)} className="text-xs" style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer", background: "none", border: "none", padding: 0 }}>Passwort vergessen?</button>
                        ) : (
                          <div className="space-y-1.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.10)" }}>
                            <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} placeholder="Deine E-Mail-Adresse" className="text-xs px-2 py-1 rounded input-dark w-full" />
                            <button
                              onClick={async () => {
                                try {
                                  const r = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: forgotEmail }) });
                                  const d = await r.json().catch(() => ({}));
                                  if (!r.ok) {
                                    setForgotMsg({ text: d.error || "Der Bote ist verloren gegangen — wahrscheinlich in einer Taverne.", ok: false });
                                  } else {
                                    setForgotMsg({ text: d.message || "Schau in deinen Posteingang.", ok: true });
                                  }
                                } catch { setForgotMsg({ text: "Die Leitungen nach Aethermoor flackern. Versuch es nochmal.", ok: false }); }
                              }}
                              disabled={!forgotEmail.includes("@")}
                              title={!forgotEmail.includes("@") ? "Gültige E-Mail-Adresse eingeben" : undefined}
                              className="text-xs px-3 py-1 rounded font-medium w-full"
                              style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)", cursor: forgotEmail.includes("@") ? "pointer" : "not-allowed" }}
                            >Send Reset Link</button>
                            {forgotMsg && <p className="text-xs" style={{ color: forgotMsg.ok ? "#22c55e" : "#ef4444" }}>{forgotMsg.text}</p>}
                          </div>
                        )}
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
                        <input type="text" value={registerName} onChange={e => setRegisterName(e.target.value)} placeholder="Name wählen" className="text-xs px-2 py-1 rounded input-dark" />
                        <input type="email" value={registerEmail} onChange={e => setRegisterEmail(e.target.value)} placeholder="E-Mail-Adresse" className="text-xs px-2 py-1 rounded input-dark" />
                        <input type="password" value={registerPassword} onChange={e => setRegisterPassword(e.target.value)} placeholder="Passwort (8+ Zeichen, A-Z, 0-9)" className="text-xs px-2 py-1 rounded input-dark" />
                        <input type="password" value={registerPasswordConfirm} onChange={e => setRegisterPasswordConfirm(e.target.value)} placeholder="Passwort bestätigen" className="text-xs px-2 py-1 rounded input-dark" />
                        {registerError && <p role="alert" className="text-xs" style={{ color: "#ef4444" }}>{registerError}</p>}
                        <div className="flex gap-1">
                          <button onClick={handleRegister} disabled={authLoading} title={authLoading ? "Account wird erstellt…" : "Account erstellen"} className="flex-1 text-xs px-3 py-1 rounded font-medium" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", opacity: authLoading ? 0.5 : 1, cursor: authLoading ? "not-allowed" : "pointer" }}>{authLoading ? "Wird erstellt…" : "Erstellen"}</button>
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
            {apiLive ? "Online" : "Offline"}
          </div>
          {/* Night mode / Mondlicht indicator */}
          {(() => {
            const h = parseInt(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin", hour: "numeric", hour12: false }), 10);
            const isNight = h >= 22 || h < 6;
            if (!isNight) return null;
            return (
              <div className="flex items-center gap-1 text-xs" style={{ color: "#818cf8" }} title="Mondlicht-Schmiede active (22:00-06:00 Berlin) — +20% minimum rolls on crafted gear">
                <span style={{ fontSize: 12, animation: "crystal-breathe 3s ease-in-out infinite", ["--glow-color" as string]: "rgba(129,140,248,0.4)" }}>☽</span>
                <span style={{ opacity: 0.6 }}>Mondlicht</span>
              </div>
            );
          })()}
          <div className="text-xs font-mono flex items-center gap-1.5 text-w25">
            <span className="w-1.5 h-1.5 rounded-full inline-block animate-pulse" style={{ background: "rgba(255,102,51,0.5)" }} />
            Updated <span style={{ display: "inline-block", minWidth: "4rem" }}><LastUpdated lastRefresh={lastRefresh} /></span>
          </div>
        </div>
      </div>
    </header>

    {/* Settings Modal */}
    {settingsModalOpen && (
      <div className="fixed inset-0 z-[150] flex items-center justify-center modal-backdrop" onClick={() => setSettingsModalOpen(false)}>
        <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ background: "#111318", border: "1px solid rgba(129,140,248,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-3" style={{ background: "rgba(129,140,248,0.06)", borderBottom: "1px solid rgba(129,140,248,0.15)" }}>
            <p className="text-sm font-bold" style={{ color: "#818cf8" }}>Einstellungen</p>
            <button onClick={() => setSettingsModalOpen(false)} className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}><span className="text-xs font-mono" style={{ fontSize: 12 }}>ESC</span></button>
          </div>
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {/* Email Section */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Email</p>
              {emailStatus?.hasEmail ? (
                <div className="rounded-lg px-3 py-2 space-y-1.5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>{emailStatus.email}</span>
                    {emailStatus.emailVerified
                      ? <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>Verified</span>
                      : <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>Nicht verifiziert</span>
                    }
                  </div>
                  {!emailStatus.emailVerified && (
                    <div className="space-y-1">
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Passwort-Reset braucht eine verifizierte E-Mail.</p>
                      <button
                        onClick={async () => {
                          try {
                            const r = await fetch("/api/auth/resend-verification", { method: "POST", headers: getAuthHeaders(reviewApiKey) });
                            const d = await r.json();
                            setSettingsMsg(d.message || d.error || "Done");
                            setTimeout(() => setSettingsMsg(""), 5000);
                          } catch { setSettingsMsg("Die Leitungen nach Aethermoor flackern. Versuch es nochmal."); }
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                        style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)", cursor: "pointer" }}
                      >Resend verification email</button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>No email set. Use the migration prompt to add one.</p>
              )}
            </div>

            {/* ─── Profile Section ─── */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Profile</p>
              <div className="space-y-3">
                {/* Avatar Style */}
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>Avatar</p>
                  <div className="flex gap-2">
                    {(["male", "female"] as const).map(style => (
                      <button
                        key={style}
                        onClick={async () => {
                          try {
                            await fetch(`/api/player/${encodeURIComponent(playerName)}/profile`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                              body: JSON.stringify({ avatarStyle: style }),
                            });
                            refresh();
                            setSettingsMsg("Avatar updated.");
                            setTimeout(() => setSettingsMsg(""), 3000);
                          } catch { setSettingsMsg("Die Leitungen nach Aethermoor flackern. Versuch es nochmal."); }
                        }}
                        className="flex-1 rounded-lg p-2 flex flex-col items-center gap-1"
                        style={{
                          background: (loggedInUser?.avatarStyle || "male") === style ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)",
                          border: `2px solid ${(loggedInUser?.avatarStyle || "male") === style ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.07)"}`,
                          cursor: "pointer",
                        }}
                      >
                        <img src={`/images/portraits/hero-${style}.png`} alt={style} className="w-10 h-10 rounded-lg object-cover" style={{ imageRendering: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
                        <span className="text-xs capitalize" style={{ color: (loggedInUser?.avatarStyle || "male") === style ? "#a78bfa" : "rgba(255,255,255,0.3)" }}>{style === "male" ? "Male" : "Female"}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Relationship Status */}
                <div>
                  <p className="text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.45)" }}>Relationship</p>
                  <div className="flex gap-1 flex-wrap">
                    {["single", "relationship", "married", "complicated"].map(s => (
                      <button
                        key={s}
                        onClick={async () => {
                          try {
                            await fetch(`/api/player/${encodeURIComponent(playerName)}/profile`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) },
                              body: JSON.stringify({ relationshipStatus: s }),
                            });
                            refresh();
                          } catch { setSettingsMsg("Der Beziehungsstatus bleibt unverändert."); }
                        }}
                        className="text-xs px-2 py-1 rounded"
                        style={{
                          background: (loggedInUser?.relationshipStatus || "single") === s ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)",
                          color: (loggedInUser?.relationshipStatus || "single") === s ? "#a78bfa" : "rgba(255,255,255,0.3)",
                          border: `1px solid ${(loggedInUser?.relationshipStatus || "single") === s ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.06)"}`,
                          cursor: "pointer",
                        }}
                      >{s === "relationship" ? "In a relationship" : s === "complicated" ? "It's complicated" : s.charAt(0).toUpperCase() + s.slice(1)}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Change Password Section */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Change Password</p>
              <div className="space-y-2">
                <input type="password" value={changePwCurrent} onChange={e => setChangePwCurrent(e.target.value)} placeholder="Aktuelles Passwort" className="w-full text-xs px-3 py-2 rounded-lg input-dark" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8" }} />
                <input type="password" value={changePwNew} onChange={e => setChangePwNew(e.target.value)} placeholder="Neues Passwort (8+ Zeichen, 1 Großbuchstabe, 1 Zahl)" className="w-full text-xs px-3 py-2 rounded-lg input-dark" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8" }} />
                <input type="password" value={changePwConfirm} onChange={e => setChangePwConfirm(e.target.value)} placeholder="Neues Passwort bestätigen" className="w-full text-xs px-3 py-2 rounded-lg input-dark" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8e8e8" }} />
                {changePwNew && changePwConfirm && changePwNew !== changePwConfirm && (
                  <p className="text-xs" style={{ color: "#ef4444" }}>Passwords don&apos;t match</p>
                )}
                <button
                  onClick={async () => {
                    setChangePwLoading(true);
                    try {
                      const r = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders(reviewApiKey) }, body: JSON.stringify({ currentPassword: changePwCurrent, newPassword: changePwNew }) });
                      const d = await r.json();
                      setSettingsMsg(d.message || d.error || "Done");
                      if (r.ok) { setChangePwCurrent(""); setChangePwNew(""); setChangePwConfirm(""); }
                      setTimeout(() => setSettingsMsg(""), 5000);
                    } catch { setSettingsMsg("Die Leitungen nach Aethermoor flackern. Versuch es nochmal."); }
                    setChangePwLoading(false);
                  }}
                  disabled={changePwLoading || !changePwCurrent || !changePwNew || changePwNew !== changePwConfirm || changePwNew.length < 8}
                  title={changePwLoading ? "Changing password..." : !changePwCurrent ? "Enter current password" : !changePwNew || changePwNew.length < 8 ? "New password must be at least 8 characters" : changePwNew !== changePwConfirm ? "Passwörter stimmen nicht überein." : undefined}
                  className="w-full text-xs py-2 rounded-lg font-semibold"
                  style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.3)", cursor: changePwLoading || !changePwCurrent || !changePwNew || changePwNew !== changePwConfirm ? "not-allowed" : "pointer", opacity: changePwLoading ? 0.5 : 1 }}
                >{changePwLoading ? "Changing..." : "Change Password"}</button>
              </div>
            </div>

            {/* Feedback */}
            {settingsMsg && (
              <div className="rounded-lg px-3 py-2 text-xs" style={{ background: settingsMsg.includes("error") || settingsMsg.includes("incorrect") ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${settingsMsg.includes("error") || settingsMsg.includes("incorrect") ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.2)"}`, color: settingsMsg.includes("error") || settingsMsg.includes("incorrect") ? "#ef4444" : "#22c55e" }}>
                {settingsMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
