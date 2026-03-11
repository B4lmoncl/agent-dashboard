"use client";

export default function GuildHallBackground() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        background: "linear-gradient(to bottom, #02010a 0%, #0d0b1a 33%, #120d22 70%, #1c1438 100%)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/guild-hall-bg.png"
        alt=""
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "1200px",
          height: "auto",
          imageRendering: "pixelated",
          opacity: 0.35,
          userSelect: "none",
        }}
      />
    </div>
  );
}
