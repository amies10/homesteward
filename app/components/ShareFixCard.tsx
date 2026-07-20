"use client";

import { useState } from "react";
import Modal from "@/app/components/Modal";
import Logo from "@/app/components/Logo";
import { shareText } from "@/lib/share";

interface Props {
  issueTitle: string;
  savings: number | null;
  onClose: () => void;
}

// I2: share-a-fix preview card, opened from the diy page's congrats screen,
// the issue page's post-save banner, and the completed page's per-card
// "Share" button.
export default function ShareFixCard({ issueTitle, savings, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const showSavings = savings !== null && savings > 0;

  async function handleShare() {
    const text = `I fixed "${issueTitle}"${
      showSavings ? ` and saved ~$${Math.round(savings)}` : ""
    } with Porchlight — homesteward-tau.vercel.app?ref=share`;
    try {
      const result = await shareText("I fixed it myself", text);
      if (result === "copied") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch (err) {
      // Native share sheet was cancelled by the user — silent no-op.
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={380}>
      <p className="mb-3.5 text-center font-display text-lg font-semibold text-porch-text">Share this win</p>

      <div className="rounded-2xl bg-gradient-to-br from-porch-accent to-porch-accent-hover p-6 text-center text-white">
        <p className="font-display text-[21px] font-semibold leading-snug">I fixed {issueTitle} 🛠</p>
        {showSavings && (
          <p className="mt-2 text-[14.5px] leading-relaxed text-white/90">
            …and saved ~${Math.round(savings).toLocaleString("en-US")} doing it myself
          </p>
        )}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-white/80">
          <span>with</span>
          <Logo size={18} showWordmark wordmarkSize={13} wordmarkColor="#FFFFFF" className="opacity-90" />
        </div>
      </div>

      <button
        onClick={handleShare}
        className="btn-press mt-4 flex min-h-[44px] w-full items-center justify-center rounded-[10px] border-none bg-porch-accent py-3 text-[14.5px] font-semibold text-white"
      >
        {copied ? "Copied ✓" : "Share"}
      </button>
      <button
        onClick={onClose}
        className="btn-press mt-2 flex min-h-[44px] w-full items-center justify-center rounded-[10px] border border-porch-border-input bg-porch-surface py-2.5 text-[13.5px] font-semibold text-porch-text-secondary"
      >
        Close
      </button>
    </Modal>
  );
}
