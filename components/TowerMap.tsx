"use client";

import { useEffect } from "react";
import { FLOORS } from "@/app/config";

interface FloorNotification {
  /** Number of actionable items on this floor (0 = no dot) */
  count: number;
  /** Accent color override (optional, defaults to floor color) */
  color?: string;
}

interface TowerMapProps {
  activeFloor: string;
  activeRoom: string;
  playerLevel: number;
  onNavigate: (room: string) => void;
  onClose: () => void;
  /** Per-floor notification dots: { floorId: { count, color? } } */
  notifications?: Record<string, FloorNotification>;
}

// Floor accent gradients for the tower cross-section visual
const FLOOR_BG: Record<string, string> = {
  turmspitze: "linear-gradient(135deg, #1a1505 0%, #111318 100%)",
  breakaway: "linear-gradient(135deg, #1a0a14 0%, #111318 100%)",
  charakterturm: "linear-gradient(135deg, #0a1220 0%, #111318 100%)",
  gewerbeviertel: "linear-gradient(135deg, #140a1e 0%, #111318 100%)",
  haupthalle: "linear-gradient(135deg, #1a0f08 0%, #111318 100%)",
};

// Skulduggery-style floor flavor text
const FLOOR_FLAVOR: Record<string, string> = {
  turmspitze: "Where ambition meets the stars.",
  breakaway: "Every hero needs a place to not be one.",
  charakterturm: "Your story, your rules, your gear.",
  gewerbeviertel: "The sound of hammers never stops here.",
  haupthalle: "Adventure begins at the door.",
};

export default function TowerMap({ activeFloor, activeRoom, playerLevel, onNavigate, onClose, notifications = {} }: TowerMapProps) {
  // ESC key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Find the nearest unlock (floor OR room) above current level for "Next unlock" teaser
  const upcomingUnlocks: { level: number; label: string }[] = [];
  FLOORS.forEach(f => {
    if ((f.minLevel || 1) > playerLevel) upcomingUnlocks.push({ level: f.minLevel || 1, label: `Floor: ${f.name}` });
    f.rooms.forEach(r => {
      const rLvl = r.minLevel || f.minLevel || 1;
      if (rLvl > playerLevel) upcomingUnlocks.push({ level: rLvl, label: `${r.label}` });
    });
  });
  upcomingUnlocks.sort((a, b) => a.level - b.level);
  const nextUnlock = upcomingUnlocks[0];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tower map navigation"
        className="w-full max-w-md sm:max-w-lg rounded-2xl overflow-hidden tab-content-enter"
        style={{ background: "#0d0e12", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 25px 100px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)", maxHeight: "88vh", overflowY: "auto", overscrollBehavior: "contain" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between" style={{ background: "linear-gradient(180deg, #0d0e12 60%, transparent)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div>
            <p className="text-base font-bold tracking-wide" style={{ color: "#e8e8e8" }}>Quest Hall</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Level {playerLevel} · {FLOORS.filter(f => playerLevel >= (f.minLevel || 1)).length}/{FLOORS.length} Floors
            </p>
            {nextUnlock && (
              <p className="text-xs mt-0.5" style={{ color: "rgba(230,204,128,0.55)" }}>
                Next at Lv{nextUnlock.level}: <span className="font-semibold">{nextUnlock.label}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 flex items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", cursor: "pointer", border: "1px solid rgba(255,255,255,0.10)" }}>
            <span className="text-xs font-mono">ESC</span>
          </button>
        </div>

        {/* Ambient crystal particles — floor-colored */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { x: 8, y: 12, color: "rgba(251,191,36,0.4)", dur: 3 },
            { x: 88, y: 25, color: "rgba(236,72,153,0.35)", dur: 3.8 },
            { x: 15, y: 42, color: "rgba(59,130,246,0.4)", dur: 4.2 },
            { x: 82, y: 58, color: "rgba(168,85,247,0.35)", dur: 3.5 },
            { x: 25, y: 72, color: "rgba(249,115,22,0.4)", dur: 4 },
            { x: 70, y: 85, color: "rgba(129,140,248,0.3)", dur: 3.3 },
          ].map((p, i) => (
            <div key={`tp-${i}`} className="absolute rounded-full" style={{
              width: 2, height: 2,
              left: `${p.x}%`,
              top: `${p.y}%`,
              background: p.color,
              boxShadow: `0 0 4px ${p.color}`,
              animation: `ambient-spark ${p.dur}s ease-in-out ${i * 0.5}s infinite`,
              opacity: 0,
            }} />
          ))}
        </div>

        {/* Tower cross-section — top to bottom */}
        <div className="relative px-3 pb-4 space-y-1">
          {/* Crystal vein removed — was the unexplained line on the left */}
          {/* Tower spire decoration */}
          <div className="flex flex-col items-center pb-3">
            <div style={{
              width: 0, height: 0,
              borderLeft: "20px solid transparent", borderRight: "20px solid transparent",
              borderBottom: "12px solid rgba(251,191,36,0.2)",
              filter: "drop-shadow(0 0 6px rgba(251,191,36,0.15))",
            }} />
            <div style={{
              width: 0, height: 0,
              borderLeft: "35px solid transparent", borderRight: "35px solid transparent",
              borderBottom: "10px solid rgba(251,191,36,0.1)",
              marginTop: -2,
            }} />
            <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.2), transparent)", marginTop: 2 }} />
          </div>

          {FLOORS.map((floor, fi) => {
            const floorLocked = playerLevel < (floor.minLevel || 1);
            const isActiveFloor = floor.id === activeFloor;
            const notif = notifications[floor.id];
            const hasNotification = notif && notif.count > 0;

            return (
              <div key={floor.id} className="rounded-xl overflow-hidden relative group" style={{ background: isActiveFloor ? (FLOOR_BG[floor.id] || "rgba(255,255,255,0.02)") : "rgba(255,255,255,0.015)", border: `1px solid ${isActiveFloor ? `${floor.color}25` : "rgba(255,255,255,0.03)"}`, opacity: floorLocked ? 0.35 : 1, transition: "all 0.2s ease" }} onMouseEnter={e => { if (!floorLocked) (e.currentTarget as HTMLElement).style.borderColor = `${floor.color}35`; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isActiveFloor ? `${floor.color}25` : "rgba(255,255,255,0.03)"; }}>
                {/* Background banner image */}
                {!floorLocked && floor.banner && (
                  <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url(${floor.banner})`, backgroundSize: "cover", backgroundPosition: "center right", opacity: isActiveFloor ? 0.18 : 0.08 }} />
                )}
                {/* Floor accent bar + crystal vein branch */}
                {!floorLocked && (
                  <div className="relative">
                    <div style={{ height: isActiveFloor ? 2 : 1, background: `linear-gradient(90deg, transparent, ${floor.color}${isActiveFloor ? "80" : "30"}, transparent)` }} />
                    {/* Tiny crystal vein branch from left edge */}
                    <div className="absolute pointer-events-none" style={{
                      left: 0, top: -6, width: 20, height: 12,
                      background: `linear-gradient(90deg, ${floor.color}15, transparent)`,
                      filter: "blur(3px)",
                    }} />
                  </div>
                )}

                {/* Floor header — click to navigate to first available room */}
                <div
                  className="relative flex items-center gap-3 px-4 py-2.5"
                  style={{ cursor: floorLocked ? "default" : "pointer", paddingTop: 12, paddingBottom: 8 }}
                  onClick={() => {
                    if (floorLocked) return;
                    const firstRoom = floor.rooms.find(r => !r.minLevel || playerLevel >= r.minLevel);
                    if (firstRoom) { onNavigate(firstRoom.key); onClose(); }
                  }}
                >
                  {/* Floor icon */}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{
                    background: isActiveFloor ? `${floor.color}18` : `${floor.color}08`,
                    border: `1px solid ${isActiveFloor ? `${floor.color}40` : `${floor.color}15`}`,
                    boxShadow: isActiveFloor ? `0 0 12px ${floor.color}20` : "none",
                  }}>
                    <span style={{ color: floor.color, fontSize: 18, filter: isActiveFloor ? `drop-shadow(0 0 4px ${floor.color}60)` : "none" }}>{floor.icon}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold" style={{ fontSize: 14, color: floorLocked ? "rgba(255,255,255,0.25)" : isActiveFloor ? floor.color : "rgba(255,255,255,0.7)" }}>
                        {floor.name}
                      </p>
                      {isActiveFloor && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: `${floor.color}18`, color: floor.color, fontSize: 12 }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: floor.color, boxShadow: `0 0 6px ${floor.color}`, animation: "ambient-spark 2s ease-in-out infinite" }} />
                          HERE
                        </span>
                      )}
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>
                      {floorLocked ? floor.subtitle : (FLOOR_FLAVOR[floor.id] || floor.subtitle)}
                      {!floorLocked && (() => {
                        const unlockedRooms = floor.rooms.filter(r => !r.minLevel || playerLevel >= r.minLevel).length;
                        return unlockedRooms < floor.rooms.length ? (
                          <span style={{ marginLeft: 6, color: "rgba(255,255,255,0.4)" }}>{unlockedRooms}/{floor.rooms.length}</span>
                        ) : null;
                      })()}
                    </p>
                  </div>

                  {/* Notification dot */}
                  {hasNotification && !floorLocked && (
                    <div className="relative flex-shrink-0 claimable-breathe" style={{ ["--claim-color" as string]: `${(notif.color || floor.color)}30` }}>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{
                        background: (notif.color || floor.color) + "25",
                        color: notif.color || floor.color,
                        border: `1px solid ${(notif.color || floor.color)}40`,
                        fontSize: 12,
                        minWidth: 20,
                      }}>
                        {notif.count > 9 ? "9+" : notif.count}
                      </span>
                    </div>
                  )}

                  {floorLocked && (
                    <span className="text-xs flex-shrink-0 px-2 py-0.5 rounded" style={{ color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      Lv.{floor.minLevel}
                    </span>
                  )}
                </div>

                {/* Room unlock progress bar */}
                {!floorLocked && (() => {
                  const unlocked = floor.rooms.filter(r => !r.minLevel || playerLevel >= r.minLevel).length;
                  const total = floor.rooms.length;
                  if (unlocked >= total) return null;
                  return (
                    <div className="relative mx-4 mb-1.5 rounded-full overflow-hidden" style={{ height: 2, background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ height: "100%", width: `${(unlocked / total) * 100}%`, background: `${floor.color}50`, borderRadius: 2 }} />
                    </div>
                  );
                })()}

                {/* Rooms */}
                <div className="relative flex flex-wrap gap-2 px-4 pb-3.5">
                  {floor.rooms.map(room => {
                    const roomLocked = floorLocked || !!(room.minLevel && playerLevel < room.minLevel);
                    const isActive = activeRoom === room.key;
                    return (
                      <button
                        key={room.key}
                        onClick={() => { if (!roomLocked) { onNavigate(room.key); onClose(); } }}
                        disabled={roomLocked}
                        title={roomLocked ? `Requires Level ${room.minLevel || floor.minLevel}` : room.label}
                        className="text-xs px-3 py-2.5 rounded-lg transition-all flex items-center gap-1.5 hover:brightness-125"
                        style={{
                          minHeight: 40,
                          background: isActive ? `${floor.color}20` : roomLocked ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.035)",
                          color: isActive ? floor.color : roomLocked ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.45)",
                          border: `1px solid ${isActive ? `${floor.color}50` : "rgba(255,255,255,0.04)"}`,
                          cursor: roomLocked ? "not-allowed" : "pointer",
                          fontWeight: isActive ? 700 : 400,
                          boxShadow: isActive ? `0 0 10px ${floor.color}20, inset 0 1px 0 rgba(255,255,255,0.05)` : "none",
                        }}
                      >
                        {room.iconSrc && <img src={room.iconSrc} alt="" width={14} height={14} style={{ imageRendering: "auto", opacity: roomLocked ? 0.3 : 0.7 }} onError={e => { e.currentTarget.style.display = "none"; }} />}
                        {isActive && !room.iconSrc && <span style={{ fontSize: 12 }}>◆</span>}
                        {room.label}
                        {roomLocked && !floorLocked && room.minLevel && (
                          <span style={{ fontSize: 12, opacity: 0.5, marginLeft: 2 }}>Lv{room.minLevel}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Floor separator — horizontal divider with crystal node */}
                {fi < FLOORS.length - 1 && (
                  <div className="flex items-center gap-2 py-1 px-4">
                    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${floor.color}20, rgba(255,255,255,0.06))` }} />
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: `${floor.color}30`, boxShadow: `0 0 4px ${floor.color}15` }} />
                    <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, rgba(255,255,255,0.06), ${FLOORS[fi + 1]?.color || "#fff"}20, transparent)` }} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Tower base decoration */}
          <div className="flex flex-col items-center pt-2 space-y-1">
            <div style={{ width: 140, height: 2, background: "linear-gradient(90deg, transparent, rgba(249,115,22,0.12), transparent)" }} />
            <div style={{ width: 180, height: 3, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)", borderRadius: 2 }} />
          </div>
          <p className="text-center text-xs italic pt-2 pb-1" style={{ color: "rgba(255,255,255,0.1)", fontSize: 12 }}>
            Der Turm erinnert sich an jeden, der seine Hallen betritt.
          </p>
        </div>
      </div>
    </div>
  );
}
