"use client";

import { useEffect, useRef, useState } from "react";
import { XIcon } from "./icons";

interface Props {
  collapsedHeight?: number;
  expandedHeight?: number;
  /** Height to open at when first mounted. Defaults to collapsedHeight (peek only). */
  initialHeight?: number;
  handleLabel?: React.ReactNode;
  persistentContent?: React.ReactNode;
  /** Rendered inside the scrollable body when expanded. */
  children: React.ReactNode;
  /** Rendered below children, pinned to the bottom (doesn't scroll) — e.g. a chat input row. */
  footer?: React.ReactNode;
  /** Shows a close (X) button in the handle row; tapping it doesn't trigger drag/tap-toggle. */
  onClose?: () => void;
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
 * top: React's JSX onTouchMove is always passive and can't preventDefault to
 * stop the browser's native scroll from competing with the drag — a real gap
 * on iOS Safari in particular.
 *
 * The whole handle row (not just the small pill) is the drag/tap target —
 * when collapsed, its min-height fills the entire visible collapsed strip,
 * since a target sized to just the pill's own content (~15-20px) is nearly
 * impossible to hit reliably with a finger, even though a mouse cursor
 * doesn't have that problem.
 */
export default function BottomSheet({
  collapsedHeight = 96,
  expandedHeight,
  initialHeight,
  handleLabel,
  persistentContent,
  children,
  footer,
  onClose,
  zIndex = 30,
  position = "fixed",
}: Props) {
  const [height, setHeightState] = useState(initialHeight ?? collapsedHeight);
  const [dragging, setDragging] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);

  const heightRef = useRef(initialHeight ?? collapsedHeight);
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

  function isNoDragTarget(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest("[data-nodrag]");
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
    if (isNoDragTarget(e.target)) return;
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
      if (isNoDragTarget(e.target)) return;
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
        style={{ touchAction: "none", cursor: "grab", minHeight: expanded ? undefined : collapsedHeight }}
        className="relative flex shrink-0 flex-col items-center gap-2.5 pt-2.5"
      >
        <span className="h-1 w-9 rounded-full bg-porch-border-input" />
        {persistentContent}
        {expanded && handleLabel}
        {onClose && (
          <button
            data-nodrag
            onClick={onClose}
            aria-label="Close"
            className="btn-press absolute right-3 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border-none bg-porch-accent-tint"
          >
            <XIcon size={15} color="#6B5F55" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 pb-2 pt-3.5" style={{ touchAction: "pan-y" }}>
            {children}
          </div>
          {footer}
        </div>
      )}
    </div>
  );
}
