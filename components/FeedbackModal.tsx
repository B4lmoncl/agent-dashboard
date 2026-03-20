"use client";

import { useState } from "react";
import { ModalOverlay } from "./ModalPortal";

interface FeedbackModalProps {
  elementPath: string;
  playerName?: string;
  onClose: () => void;
}

export default function FeedbackModal({ elementPath, playerName, onClose }: FeedbackModalProps) {
  const [type, setType] = useState<"bug" | "feedback">("feedback");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!text.trim()) { setError("Please describe the issue or suggestion."); return; }
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          elementPath,
          type,
          text: text.trim(),
          userId: playerName || "anonymous",
          timestamp: new Date().toISOString(),
        }),
      });
      if (r.ok) {
        setSubmitted(true);
        setTimeout(onClose, 1500);
      } else {
        setError("Failed to submit. Try again.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay isOpen onClose={onClose} zIndex={10001} bgOpacity={0.8}>
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #221c12 0%, #1a1509 60%, #1e190e 100%)",
          border: "1px solid rgba(180,140,70,0.35)",
          boxShadow: "0 0 60px rgba(129,140,248,0.12), 0 0 30px rgba(180,140,70,0.08)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#e8e8e8" }}>
              <span style={{ color: "#818cf8", fontFamily: "monospace", marginRight: 6 }}>(α)</span>
              Alpha Feedback
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Help us improve Quest Hall</p>
          </div>
          <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>

        <div className="px-5 py-4 space-y-4" style={{ overscrollBehavior: "contain" }}>
          {submitted ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-sm font-semibold" style={{ color: "#22c55e" }}>Feedback submitted!</p>
              <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Thank you for helping improve Quest Hall.</p>
            </div>
          ) : (
            <>
              {/* Element path breadcrumb */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Element</label>
                <div
                  className="text-xs px-3 py-2 rounded-lg font-mono"
                  style={{
                    background: "rgba(129,140,248,0.08)",
                    border: "1px solid rgba(129,140,248,0.2)",
                    color: "#818cf8",
                    wordBreak: "break-all",
                    lineHeight: 1.5,
                  }}
                >
                  {elementPath || "unknown"}
                </div>
              </div>

              {/* Type toggle */}
              <div>
                <label className="text-xs mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>Type</label>
                <div className="flex gap-2">
                  {([["bug", "Bug"], ["feedback", "Suggestion"]] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setType(val)}
                      className="flex-1 text-xs py-2 rounded-lg font-medium transition-all"
                      style={{
                        background: type === val
                          ? (val === "bug" ? "rgba(239,68,68,0.15)" : "rgba(251,191,36,0.12)")
                          : "rgba(255,255,255,0.04)",
                        color: type === val
                          ? (val === "bug" ? "#ef4444" : "#fbbf24")
                          : "rgba(255,255,255,0.35)",
                        border: `1px solid ${type === val
                          ? (val === "bug" ? "rgba(239,68,68,0.4)" : "rgba(251,191,36,0.35)")
                          : "rgba(255,255,255,0.1)"}`,
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text */}
              <div>
                <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Description</label>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Describe the issue or suggestion..."
                  rows={4}
                  className="w-full text-xs px-3 py-2 rounded-lg resize-none"
                  style={{
                    background: "#141414",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#e8e8e8",
                    outline: "none",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 text-xs py-2 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    color: "rgba(255,255,255,0.35)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !text.trim()}
                  className="flex-1 text-xs py-2 rounded-lg font-semibold"
                  style={{
                    background: submitting || !text.trim()
                      ? "rgba(245,158,11,0.06)"
                      : "linear-gradient(180deg, rgba(245,158,11,0.25), rgba(245,158,11,0.15))",
                    color: submitting || !text.trim() ? "rgba(245,158,11,0.3)" : "#f59e0b",
                    border: `1px solid ${submitting || !text.trim() ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.4)"}`,
                    cursor: submitting || !text.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}
