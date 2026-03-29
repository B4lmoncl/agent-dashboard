"use client";

import { FLOORS } from "@/app/config";

interface TowerMapProps {
  activeFloor: string;
  activeRoom: string;
  playerLevel: number;
  onNavigate: (room: string) => void;
  onClose: () => void;
}

export default function TowerMap({ activeFloor, activeRoom, playerLevel, onNavigate, onClose }: TowerMapProps) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 modal-backdrop" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-2xl overflow-hidden tab-content-enter"
        style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 20px 60px rgba(0,0,0,0.8)", maxHeight: "85vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <p className="text-sm font-bold" style={{ color: "#e8e8e8" }}>Tower Map</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Navigate Urithiru</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>x</button>
        </div>

        {/* Tower — top to bottom */}
        <div className="p-3 space-y-1">
          {/* Decorative tower top */}
          <div className="text-center mb-2">
            <div style={{ width: 0, height: 0, borderLeft: "40px solid transparent", borderRight: "40px solid transparent", borderBottom: "20px solid rgba(251,191,36,0.15)", margin: "0 auto" }} />
          </div>

          {FLOORS.map((floor, fi) => {
            const floorLocked = playerLevel < (floor.minLevel || 1);
            const isActiveFloor = floor.id === activeFloor;

            return (
              <div key={floor.id}>
                {/* Floor header */}
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded-t-lg"
                  style={{
                    background: isActiveFloor ? `${floor.color}12` : "rgba(255,255,255,0.02)",
                    borderLeft: `3px solid ${floorLocked ? "rgba(255,255,255,0.06)" : floor.color}`,
                    opacity: floorLocked ? 0.4 : 1,
                  }}
                >
                  <span style={{ color: floor.color, fontSize: 14 }}>{floor.icon}</span>
                  <div className="flex-1">
                    <p className="text-xs font-bold" style={{ color: floorLocked ? "rgba(255,255,255,0.3)" : floor.color }}>{floor.name}</p>
                    <p style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }}>{floor.subtitle}</p>
                  </div>
                  {floorLocked && <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Lv.{floor.minLevel}</span>}
                  {isActiveFloor && <span className="w-1.5 h-1.5 rounded-full" style={{ background: floor.color, boxShadow: `0 0 6px ${floor.color}` }} />}
                </div>

                {/* Rooms */}
                <div className="flex flex-wrap gap-1 px-2 pb-2 pt-1 rounded-b-lg" style={{ background: "rgba(255,255,255,0.01)", borderLeft: `3px solid ${floorLocked ? "rgba(255,255,255,0.03)" : `${floor.color}30`}` }}>
                  {floor.rooms.map(room => {
                    const roomLocked = floorLocked || !!(room.minLevel && playerLevel < room.minLevel);
                    const isActive = activeRoom === room.key;
                    return (
                      <button
                        key={room.key}
                        onClick={() => { if (!roomLocked) { onNavigate(room.key); onClose(); } }}
                        disabled={roomLocked}
                        title={roomLocked ? `Requires Level ${room.minLevel || floor.minLevel}` : room.label}
                        className="text-xs px-2 py-1 rounded transition-all"
                        style={{
                          background: isActive ? `${floor.color}20` : roomLocked ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
                          color: isActive ? floor.color : roomLocked ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.4)",
                          border: `1px solid ${isActive ? `${floor.color}50` : "rgba(255,255,255,0.05)"}`,
                          cursor: roomLocked ? "not-allowed" : "pointer",
                          fontWeight: isActive ? 700 : 400,
                        }}
                      >
                        {isActive && <span style={{ marginRight: 3 }}>●</span>}
                        {room.label}
                        {roomLocked && <span style={{ marginLeft: 3, opacity: 0.5 }}>🔒</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Floor connector line */}
                {fi < FLOORS.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <div style={{ width: 1, height: 8, background: "rgba(255,255,255,0.06)" }} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Decorative tower base */}
          <div className="text-center mt-1">
            <div style={{ width: 100, height: 3, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)", margin: "0 auto" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
