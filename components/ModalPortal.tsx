"use client";
import { useEffect, useState, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";

export function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/**
 * Hook for consistent modal behavior:
 * - ESC to close
 * - Body scroll lock while open
 */
export function useModalBehavior(isOpen: boolean, onClose: () => void) {
  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);
}

/**
 * Standard modal overlay with:
 * - Fixed viewport-centered positioning
 * - Click-outside to close
 * - ESC to close
 * - Body scroll lock
 * - overscroll-behavior: contain on inner container
 */
export function ModalOverlay({
  isOpen,
  onClose,
  children,
  zIndex = 50,
  bgOpacity = 0.75,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  zIndex?: number;
  bgOpacity?: number;
}) {
  useModalBehavior(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ background: `rgba(0,0,0,${bgOpacity})`, zIndex }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <div onClick={e => e.stopPropagation()} style={{ overscrollBehavior: "contain" }}>
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}
