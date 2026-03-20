"use client";

import { useEffect, useRef, useState } from "react";
import FeedbackModal from "./FeedbackModal";

interface FeedbackOverlayProps {
  active: boolean;
  onExit: () => void;
  playerName?: string;
}

function findFeedbackTarget(el: Element | null): Element | null {
  let current: Element | null = el;
  while (current) {
    if (current.getAttribute("data-feedback-id")) return current;
    current = current.parentElement;
  }
  return null;
}

function getElementPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  while (current) {
    const fid = current.getAttribute("data-feedback-id");
    if (fid) parts.unshift(fid);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

export default function FeedbackOverlay({ active, onExit, playerName }: FeedbackOverlayProps) {
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [elementPath, setElementPath] = useState<string>("");
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string>("");
  const hoveredElRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!active) {
      setHighlightRect(null);
      setElementPath("");
      hoveredElRef.current = null;
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
      const target = findFeedbackTarget(e.target as Element);
      if (target !== hoveredElRef.current) {
        hoveredElRef.current = target;
        setHighlightRect(target ? target.getBoundingClientRect() : null);
        setElementPath(target ? getElementPath(target) : "");
      } else if (target) {
        setHighlightRect(target.getBoundingClientRect());
      }
    };

    const onClick = (e: MouseEvent) => {
      // Don't capture clicks on the feedback modal itself
      const feedbackModal = (e.target as Element).closest("[data-feedback-modal]");
      if (feedbackModal) return;

      e.preventDefault();
      e.stopPropagation();
      const target = findFeedbackTarget(e.target as Element);
      const path = target ? getElementPath(target) : "unknown";
      setPendingPath(path);
      setModalOpen(true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };

    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousemove", onMouseMove, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active, onExit]);

  if (!active) return null;

  return (
    <>
      {/* Crosshair cursor overlay (pointer-events none so hover still works) */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9997,
          cursor: "crosshair",
          pointerEvents: "none",
        }}
      />

      {/* Highlighted element border */}
      {highlightRect && !modalOpen && (
        <div
          style={{
            position: "fixed",
            top: highlightRect.top - 2,
            left: highlightRect.left - 2,
            width: highlightRect.width + 4,
            height: highlightRect.height + 4,
            border: "2px solid #818cf8",
            borderRadius: 5,
            background: "rgba(129,140,248,0.08)",
            zIndex: 9998,
            pointerEvents: "none",
            boxShadow: "0 0 0 1px rgba(129,140,248,0.15), inset 0 0 16px rgba(129,140,248,0.04)",
          }}
        />
      )}

      {/* Floating path label near cursor */}
      {elementPath && !modalOpen && (
        <div
          style={{
            position: "fixed",
            left: Math.min(cursorPos.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 260),
            top: cursorPos.y + 18,
            zIndex: 9999,
            background: "rgba(10,10,16,0.96)",
            border: "1px solid rgba(129,140,248,0.4)",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 12,
            color: "#818cf8",
            fontFamily: "monospace",
            maxWidth: 240,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
          }}
        >
          {elementPath}
        </div>
      )}

      {/* Top banner indicating feedback mode is active */}
      {!modalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "rgba(129,140,248,0.92)",
            color: "#fff",
            textAlign: "center",
            fontSize: 12,
            fontWeight: 600,
            padding: "6px 0",
            letterSpacing: "0.03em",
            pointerEvents: "none",
          }}
        >
          (α) Feedback Mode — click any element to report · Press Esc to exit
        </div>
      )}

      {/* Feedback modal */}
      {modalOpen && (
        <div data-feedback-modal="true">
          <FeedbackModal
            elementPath={pendingPath}
            playerName={playerName}
            onClose={() => setModalOpen(false)}
          />
        </div>
      )}
    </>
  );
}
