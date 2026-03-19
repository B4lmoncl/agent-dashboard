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
        <div className="flex flex-col items-center justify-center gap-3 py-16 px-4 text-center">
          <p className="text-sm font-semibold" style={{ color: "#ff4444" }}>Something went wrong</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{this.state.error?.message || "Unknown error"}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
