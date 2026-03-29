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

  // Body scroll lock (ref-counted to handle multiple concurrent modals)
  useEffect(() => {
    if (!isOpen) return;
    const w = window as unknown as { _modalLockCount?: number };
    w._modalLockCount = (w._modalLockCount || 0) + 1;
    document.body.style.overflow = "hidden";
    return () => {
      w._modalLockCount = Math.max(0, (w._modalLockCount || 1) - 1);
      if (w._modalLockCount === 0) document.body.style.overflow = "";
    };
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
        style={{ background: `radial-gradient(circle at center, rgba(0,0,0,${Math.max(0, bgOpacity - 0.15)}) 0%, rgba(0,0,0,${bgOpacity}) 50%, rgba(0,0,0,${Math.min(1, bgOpacity + 0.1)}) 100%)`, backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", zIndex }}
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
