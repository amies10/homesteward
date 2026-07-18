"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string | null;
}

// Must be a class component — React error boundaries have no hook equivalent.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught a render error:", error, info.componentStack);
    this.setState({ info: info.componentStack ?? null });
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#FAF7F2",
          color: "#262220",
          padding: "24px 20px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something broke.</div>
        <p style={{ fontSize: 14, color: "#857A6D", marginBottom: 16, lineHeight: 1.5 }}>
          Porchlight hit an error it couldn&apos;t recover from. The details below are shown so this can be
          diagnosed instead of just showing a blank page.
        </p>
        <pre
          style={{
            background: "#FFFFFF",
            border: "1px solid #ECE5DC",
            borderRadius: 10,
            padding: 14,
            fontSize: 12,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            marginBottom: 12,
          }}
        >
          {error.name}: {error.message}
          {error.stack ? `\n\n${error.stack}` : ""}
        </pre>
        {info && (
          <details style={{ fontSize: 12, color: "#857A6D" }}>
            <summary style={{ cursor: "pointer" }}>Component stack</summary>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{info}</pre>
          </details>
        )}
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 16,
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            background: "#7D234A",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
