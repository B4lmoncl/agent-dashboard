"use client";
import React from "react";

interface Props { children: React.ReactNode; fallbackLabel?: string; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.fallbackLabel || "View"} crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-4 text-center tab-content-enter">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="text-2xl" style={{ color: "rgba(239,68,68,0.5)" }}>◇</span>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: "#ef4444" }}>Something broke.</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              {this.props.fallbackLabel || "This view"} encountered an error. The Hall is investigating. Reluctantly.
            </p>
          </div>
          {this.state.error?.message && (
            <p className="text-xs font-mono px-4 py-2 rounded-lg max-w-md break-all" style={{ background: "rgba(239,68,68,0.05)", color: "rgba(239,68,68,0.4)", border: "1px solid rgba(239,68,68,0.1)" }}>
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs px-4 py-2 rounded-lg font-semibold"
            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
