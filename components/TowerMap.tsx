"use client";

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

export default function TowerMap({ activeFloor, activeRoom, playerLevel, onNavigate, onClose, notifications = {} }: TowerMapProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden tab-content-enter"
        style={{ background: "#0d0e12", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 80px rgba(0,0,0,0.9), 0 0 40px rgba(0,0,0,0.5)", maxHeight: "88vh", overflowY: "auto", overscrollBehavior: "contain" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between" style={{ background: "linear-gradient(180deg, #0d0e12 60%, transparent)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div>
            <p className="text-base font-bold tracking-wide" style={{ color: "#e8e8e8" }}>Quest Hall</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Tower of Urithiru</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", cursor: "pointer", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs font-mono">ESC</span>
          </button>
        </div>

        {/* Ambient crystal particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[0,1,2,3,4].map(i => (
            <div key={`tp-${i}`} className="absolute rounded-full" style={{
              width: 2, height: 2,
              left: `${8 + i * 20}%`,
              top: `${15 + (i * 23) % 65}%`,
              background: i % 2 === 0 ? "rgba(129,140,248,0.5)" : "rgba(251,191,36,0.4)",
              boxShadow: `0 0 4px ${i % 2 === 0 ? "rgba(129,140,248,0.3)" : "rgba(251,191,36,0.25)"}`,
              animation: `ambient-spark ${3 + i * 0.8}s ease-in-out ${i * 0.6}s infinite`,
              opacity: 0,
            }} />
          ))}
        </div>

        {/* Tower cross-section — top to bottom */}
        <div className="relative px-3 pb-4 space-y-0.5">
          {/* Central crystal vein running through the tower */}
          <div className="absolute left-6 top-12 bottom-8 w-px pointer-events-none" style={{
            background: "linear-gradient(180deg, rgba(251,191,36,0.15), rgba(129,140,248,0.12), rgba(168,85,247,0.1), rgba(59,130,246,0.08), rgba(249,115,22,0.12))",
            boxShadow: "0 0 4px rgba(129,140,248,0.1)",
          }} />
          {/* Tower spire decoration */}
          <div className="flex justify-center pb-2">
            <div style={{
              width: 0, height: 0,
              borderLeft: "30px solid transparent", borderRight: "30px solid transparent",
              borderBottom: "16px solid rgba(251,191,36,0.12)",
              filter: "drop-shadow(0 0 8px rgba(251,191,36,0.1))",
            }} />
          </div>

          {FLOORS.map((floor, fi) => {
            const floorLocked = playerLevel < (floor.minLevel || 1);
            const isActiveFloor = floor.id === activeFloor;
            const notif = notifications[floor.id];
            const hasNotification = notif && notif.count > 0;

            return (
              <div key={floor.id} className="rounded-xl overflow-hidden" style={{ background: isActiveFloor ? (FLOOR_BG[floor.id] || "rgba(255,255,255,0.02)") : "rgba(255,255,255,0.015)", border: `1px solid ${isActiveFloor ? `${floor.color}25` : "rgba(255,255,255,0.03)"}`, opacity: floorLocked ? 0.35 : 1, transition: "all 0.2s ease" }}>
                {/* Floor accent bar */}
                {isActiveFloor && (
                  <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${floor.color}80, transparent)` }} />
                )}

                {/* Floor header */}
                <div className="flex items-center gap-3 px-4 py-2.5">
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
                      <p className="text-sm font-bold" style={{ color: floorLocked ? "rgba(255,255,255,0.25)" : isActiveFloor ? floor.color : "rgba(255,255,255,0.7)" }}>
                        {floor.name}
                      </p>
                      {isActiveFloor && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: `${floor.color}18`, color: floor.color, fontSize: 10 }}>
                          HERE
                        </span>
                      )}
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }}>{floor.subtitle}</p>
                  </div>

                  {/* Notification dot */}
                  {hasNotification && !floorLocked && (
                    <div className="relative flex-shrink-0">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{
                        background: (notif.color || floor.color) + "25",
                        color: notif.color || floor.color,
                        border: `1px solid ${(notif.color || floor.color)}40`,
                        fontSize: 10,
                        minWidth: 20,
                      }}>
                        {notif.count > 9 ? "9+" : notif.count}
                      </span>
                    </div>
                  )}

                  {floorLocked && <span className="text-xs flex-shrink-0" style={{ color: "rgba(255,255,255,0.15)" }}>Lv.{floor.minLevel}</span>}
                </div>

                {/* Rooms */}
                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                  {floor.rooms.map(room => {
                    const roomLocked = floorLocked || !!(room.minLevel && playerLevel < room.minLevel);
                    const isActive = activeRoom === room.key;
                    return (
                      <button
                        key={room.key}
                        onClick={() => { if (!roomLocked) { onNavigate(room.key); onClose(); } }}
                        disabled={roomLocked}
                        title={roomLocked ? `Requires Level ${room.minLevel || floor.minLevel}` : room.label}
                        className="text-xs px-2.5 py-1.5 rounded-lg transition-all"
                        style={{
                          background: isActive ? `${floor.color}20` : roomLocked ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.035)",
                          color: isActive ? floor.color : roomLocked ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.45)",
                          border: `1px solid ${isActive ? `${floor.color}50` : "rgba(255,255,255,0.04)"}`,
                          cursor: roomLocked ? "not-allowed" : "pointer",
                          fontWeight: isActive ? 700 : 400,
                          boxShadow: isActive ? `0 0 8px ${floor.color}15` : "none",
                        }}
                      >
                        {isActive && <span style={{ marginRight: 4, fontSize: 8 }}>◆</span>}
                        {room.label}
                      </button>
                    );
                  })}
                </div>

                {/* Floor connector — stairway visual */}
                {fi < FLOORS.length - 1 && (
                  <div className="flex items-center justify-center gap-1 py-0.5" style={{ opacity: 0.3 }}>
                    <div style={{ width: 6, height: 1, background: "rgba(255,255,255,0.15)" }} />
                    <div style={{ width: 4, height: 1, background: "rgba(255,255,255,0.1)", transform: "translateY(-1px)" }} />
                    <div style={{ width: 6, height: 1, background: "rgba(255,255,255,0.15)" }} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Tower base decoration */}
          <div className="flex justify-center pt-2">
            <div style={{ width: 120, height: 3, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)", borderRadius: 2 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
