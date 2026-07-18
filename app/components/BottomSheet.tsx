"use client";

import { useRef, useState } from "react";

interface Props {
  collapsedHeight?: number;
  expandedHeight?: number;
  handleLabel?: React.ReactNode;
  children: React.ReactNode;
  zIndex?: number;
  position?: "fixed" | "absolute";
}

/**
 * Draggable pill-handle sheet. Drag-gating state lives in refs (not useState) —
 * pointermove can fire before pointerdown's setState commits, which drops the
 * first bit of drag movement if gated on state instead.
 */
export default function BottomSheet({
  collapsedHeight = 96,
  expandedHeight,
  handleLabel,
  children,
  zIndex = 30,
  position = "fixed",
}: Props) {
  const [height, setHeight] = useState(collapsedHeight);
  const [dragging, setDragging] = useState(false);

  const dragActive = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const moved = useRef(false);

  function expandedH() {
    return expandedHeight ?? (typeof window !== "undefined" ? Math.round(window.innerHeight * 0.9) : 640);
  }

  function onPointerDown(e: React.PointerEvent) {
    const target = e.target as Element;
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {}
    dragActive.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    moved.current = false;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragActive.current) return;
    const delta = startY.current - e.clientY;
    if (Math.abs(delta) > 6) moved.current = true;
    const h = Math.max(collapsedHeight, Math.min(expandedH(), startHeight.current + delta));
    setHeight(h);
  }

  function onPointerUp() {
    if (!dragActive.current) return;
    dragActive.current = false;
    if (!moved.current) {
      const target = height <= collapsedHeight + 10 ? expandedH() : collapsedHeight;
      setHeight(target);
    }
    setDragging(false);
  }

  const expanded = height > collapsedHeight + 10;
  const positionClass = position === "fixed" ? "fixed" : "absolute";

  return (
    <div
      style={{ height, transition: dragging ? "none" : "height 0.28s cubic-bezier(0.2,0.8,0.2,1)", zIndex }}
      className={`${positionClass} left-0 right-0 bottom-0 flex flex-col overflow-hidden rounded-t-[20px] border-t border-porch-border bg-porch-surface shadow-[0_-8px_24px_rgba(38,34,32,0.14)]`}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ touchAction: "none", cursor: "grab" }}
        className="flex shrink-0 flex-col items-center gap-2.5 pt-2.5"
      >
        <span className="h-1 w-9 rounded-full bg-porch-border-input" />
        {expanded && handleLabel}
      </div>

      {expanded && <div className="flex-1 overflow-y-auto px-5 pb-2 pt-3.5">{children}</div>}
    </div>
  );
}
