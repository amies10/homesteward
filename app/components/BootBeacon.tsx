"use client";

import { useEffect } from "react";

// Reports that React actually hydrated. If the ?debug panel shows the inline
// script's env line but never "react: hydrated", the client bundle isn't
// executing (e.g. dev resources blocked cross-origin) — the exact failure
// mode where the shell paints but content never appears.
export default function BootBeacon() {
  useEffect(() => {
    (window as unknown as { __boot?: { push: (m: string) => void } }).__boot?.push("react: hydrated");
  }, []);
  return null;
}
