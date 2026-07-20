"use client";

import { useEffect, useRef } from "react";

interface Props {
  children: React.ReactNode;
  onClose?: () => void;
  maxWidth?: number;
  maxHeight?: string;
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), textarea, input, select';

export default function Modal({ children, onClose, maxWidth = 380, maxHeight }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose?.();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(38,34,32,0.35)] px-5"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth, maxHeight }}
        className="w-full overflow-y-auto rounded-[18px] bg-porch-surface p-[22px] shadow-[0_12px_40px_rgba(38,34,32,0.2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
      >
        {children}
      </div>
    </div>
  );
}
