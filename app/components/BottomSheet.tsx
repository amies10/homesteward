"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  collapsedHeight?: number;
  expandedHeight?: number;
  handleLabel?: React.ReactNode;
  persistentContent?: React.ReactNode;
  children: React.ReactNode;
  zIndex?: number;
  position?: "fixed" | "absolute";
}

/**
 * Draggable pill-handle sheet. Drag-gating state (dragActive/startY/startHeight/
 * moved) lives in refs, not useState — pointermove/touchmove can fire before
 * pointerdown/touchstart's setState commits, which drops the first bit of
 * drag movement if gated on state instead. `height` itself is mirrored into a
 * ref too so the native (non-passive) touch listeners — bound once on mount —
 * always read the latest value instead of a stale closure.
 *
 * Pointer Events are the primary path (covers mouse + most modern mobile
 * browsers), with native touchstart/touchmove/touchend listeners layered on
 * top as a fallback: iOS Safari in particular has a history of not reliably
 * delivering pointermove during a drag unless the gesture is also fought off
 * via a non-passive touchmove + preventDefault, which React's JSX
 * onTouchMove can't do (React always attaches touch listeners as passive).
 */
export default function BottomSheet({
  collapsedHeight = 96,
  expandedHeight,
  handleLabel,
  persistentContent,
  children,
  zIndex = 30,
  position = "fixed",
}: Props) {
  const [height, setHeightState] = useState(collapsedHeight);
  const [dragging, setDragging] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);

  const heightRef = useRef(collapsedHeight);
  const dragActive = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const moved = useRef(false);

  function setHeight(h: number) {
    heightRef.current = h;
    setHeightState(h);
  }

  function expandedH() {
    return expandedHeight ?? (typeof window !== "undefined" ? Math.round(window.innerHeight * 0.9) : 640);
  }

  function beginDrag(clientY: number) {
    dragActive.current = true;
    startY.current = clientY;
    startHeight.current = heightRef.current;
    moved.current = false;
    setDragging(true);
  }

  function updateDrag(clientY: number) {
    if (!dragActive.current) return;
    const delta = startY.current - clientY;
    if (Math.abs(delta) > 6) moved.current = true;
    const h = Math.max(collapsedHeight, Math.min(expandedH(), startHeight.current + delta));
    setHeight(h);
  }

  function endDrag() {
    if (!dragActive.current) return;
    dragActive.current = false;
    if (!moved.current) {
      const target = heightRef.current <= collapsedHeight + 10 ? expandedH() : collapsedHeight;
      setHeight(target);
    }
    setDragging(false);
  }

  function onPointerDown(e: React.PointerEvent) {
    const target = e.target as Element;
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {}
    beginDrag(e.clientY);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragActive.current) return;
    e.preventDefault();
    updateDrag(e.clientY);
  }

  useEffect(() => {
    const el = handleRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      beginDrag(e.touches[0].clientY);
    }
    function onTouchMove(e: TouchEvent) {
      if (!dragActive.current) return;
      e.preventDefault();
      updateDrag(e.touches[0].clientY);
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", endDrag, { passive: true });
    el.addEventListener("touchcancel", endDrag, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", endDrag);
      el.removeEventListener("touchcancel", endDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const expanded = height > collapsedHeight + 10;
  const positionClass = position === "fixed" ? "fixed" : "absolute";

  return (
    <div
      style={{ height, transition: dragging ? "none" : "height 0.28s cubic-bezier(0.2,0.8,0.2,1)", zIndex }}
      className={`${positionClass} left-0 right-0 bottom-0 flex flex-col overflow-hidden rounded-t-[20px] border-t border-porch-border bg-porch-surface shadow-[0_-8px_24px_rgba(38,34,32,0.14)]`}
    >
      <div
        ref={handleRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: "none", cursor: "grab" }}
        className="flex shrink-0 flex-col items-center gap-2.5 pt-2.5"
      >
        <span className="h-1 w-9 rounded-full bg-porch-border-input" />
        {persistentContent}
        {expanded && handleLabel}
      </div>

      {expanded && (
        <div className="flex-1 overflow-y-auto px-5 pb-2 pt-3.5" style={{ touchAction: "pan-y" }}>
          {children}
        </div>
      )}
    </div>
  );
}
