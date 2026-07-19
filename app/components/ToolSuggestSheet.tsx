"use client";

import { useState } from "react";
import Modal from "@/app/components/Modal";
import { CheckIcon } from "@/app/components/icons";

interface Props {
  tools: string[];
  onConfirm: (selected: string[]) => void;
  onDismiss: () => void;
}

export default function ToolSuggestSheet({ tools, onConfirm, onDismiss }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(tools));

  function toggle(tool: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tool)) next.delete(tool);
      else next.add(tool);
      return next;
    });
  }

  return (
    <Modal onClose={onDismiss}>
      <div className="mb-1 font-display text-lg font-semibold text-porch-text">Add to your toolbox?</div>
      <p className="mb-4 text-[13.5px] text-porch-text-secondary">
        Nice work. Want to remember that you have these tools for next time?
      </p>

      <div className="mb-5 space-y-2">
        {tools.map((tool) => {
          const isSelected = selected.has(tool);
          return (
            <button
              key={tool}
              onClick={() => toggle(tool)}
              className={`btn-press flex w-full items-center gap-2.5 rounded-[10px] border-[1.5px] px-3.5 py-3 text-left ${
                isSelected ? "border-porch-accent bg-porch-accent-tint" : "border-porch-border bg-porch-surface"
              }`}
            >
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] ${
                  isSelected ? "border-porch-accent bg-porch-accent" : "border-porch-border-input bg-porch-surface"
                }`}
              >
                {isSelected && <CheckIcon size={12} strokeWidth={3} />}
              </div>
              <span className="text-[14px] text-porch-text">{tool}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onDismiss}
          className="btn-press flex-1 rounded-[10px] border border-porch-border-input bg-porch-surface py-2.5 text-sm font-semibold text-porch-text-secondary"
        >
          Skip
        </button>
        <button
          onClick={() => onConfirm(Array.from(selected))}
          disabled={selected.size === 0}
          className="btn-press flex-1 rounded-[10px] border-none bg-porch-accent py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add {selected.size > 0 ? `(${selected.size})` : ""}
        </button>
      </div>
    </Modal>
  );
}
