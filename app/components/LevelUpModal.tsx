"use client";

import Modal from "./Modal";
import { SKILL_OPTIONS } from "./SkillLevelPicker";
import type { SkillLevel } from "@/lib/sections";

interface Props {
  skillLevel: SkillLevel;
  onClose: () => void;
}

export default function LevelUpModal({ skillLevel, onClose }: Props) {
  const label = SKILL_OPTIONS.find((o) => o.value === skillLevel)?.label ?? skillLevel;

  return (
    <Modal onClose={onClose} maxWidth={360}>
      <div className="flex flex-col items-center gap-3.5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-porch-accent-tint text-[32px]">
          🏆
        </div>
        <p className="font-display text-xl font-semibold text-porch-text">You&apos;ve leveled up!</p>
        <p className="text-sm leading-relaxed text-porch-text-secondary">
          You&apos;re now {label}. More DIY fixes will be recommended for you.
        </p>
        <button
          onClick={onClose}
          className="btn-press mt-1.5 w-full rounded-full border-none bg-porch-accent px-6 py-3 text-[14.5px] font-semibold text-white"
        >
          Keep it going
        </button>
      </div>
    </Modal>
  );
}
