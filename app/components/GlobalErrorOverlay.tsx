"use client";

import { useEffect, useState } from "react";

interface CaughtError {
  source: "window.onerror" | "unhandledrejection";
  message: string;
  stack?: string;
}

/**
 * Surfaces errors an ErrorBoundary structurally can't catch: uncaught
 * exceptions outside React's render/lifecycle (event handlers, timers) and
 * unhandled promise rejections (e.g. a .then() chain with no .catch() —
 * exactly the shape of bug that leaves a component's "loading" state stuck
 * forever with zero console output, which otherwise just looks like a blank
 * page with no clue why).
 */
export default function GlobalErrorOverlay() {
  const [caught, setCaught] = useState<CaughtError | null>(null);

  useEffect(() => {
    function onError(e: ErrorEvent) {
      console.error("[GlobalErrorOverlay] window error:", e.error ?? e.message);
      setCaught({
        source: "window.onerror",
        message: e.message || String(e.error),
        stack: e.error?.stack,
      });
    }
    function onRejection(e: PromiseRejectionEvent) {
      const reason = e.reason;
      console.error("[GlobalErrorOverlay] unhandled promise rejection:", reason);
      setCaught({
        source: "unhandledrejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!caught) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        overflowY: "auto",
        background: "#FAF7F2",
        color: "#262220",
        padding: "24px 20px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something broke.</div>
      <p style={{ fontSize: 14, color: "#857A6D", marginBottom: 16, lineHeight: 1.5 }}>
        An unhandled {caught.source === "unhandledrejection" ? "promise rejection" : "error"} occurred outside
        React&apos;s render — the kind that normally leaves a blank page with no clue why.
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
        {caught.message}
        {caught.stack ? `\n\n${caught.stack}` : ""}
      </pre>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => setCaught(null)}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "1px solid #DCD3C6",
            background: "#FFFFFF",
            color: "#262220",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Dismiss
        </button>
        <button
          onClick={() => window.location.reload()}
          style={{
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
    </div>
  );
}
