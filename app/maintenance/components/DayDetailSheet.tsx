"use client";

import { useState } from "react";
import Modal from "@/app/components/Modal";
import { CheckIcon } from "@/app/components/icons";
import CompleteWithNotes from "@/app/maintenance/components/CompleteWithNotes";
import type { DayEntry } from "@/lib/maintenance";

const STATUS_STYLE: Record<DayEntry["status"], { label: string; cls: string }> = {
  due: { label: "Due", cls: "text-[#B45309] bg-[#FBEEDC]" },
  overdue: { label: "Overdue", cls: "text-porch-urgent bg-red-50" },
  completed: { label: "Done", cls: "text-[#3E7A4F] bg-porch-accent-tint" },
};

interface Props {
  date: string;
  entries: DayEntry[];
  onLogComplete: (userTaskId: string, notes?: string) => Promise<void>;
  onClose: () => void;
}

export default function DayDetailSheet({ date, entries, onLogComplete, onClose }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const label = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  async function handleLog(userTaskId: string, notes?: string) {
    await onLogComplete(userTaskId, notes);
    setDoneIds((prev) => new Set(prev).add(userTaskId));
    setExpandedId(null);
  }

  return (
    <Modal onClose={onClose} maxWidth={400} maxHeight="75vh">
      <div className="mb-4 font-display text-lg font-semibold text-porch-text">{label}</div>

      {entries.length === 0 ? (
        <p className="text-sm text-porch-text-secondary">Nothing due or done this day.</p>
      ) : (
        <div className="space-y-2.5">
          {entries.map(({ task, status, lastLog }) => {
            const style = STATUS_STYLE[status];
            const justLogged = doneIds.has(task.id);
            const isDone = status === "completed" || justLogged;
            const expanded = expandedId === task.id;
            return (
              <div
                key={task.id}
                className="rounded-[10px] border border-porch-border bg-porch-bg px-3.5 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-porch-text">{task.name}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${style.cls}`}>
                      {isDone ? "Done" : style.label}
                    </span>
                    {isDone && lastLog?.notes && (
                      <p className="mt-1 text-[12px] italic leading-relaxed text-porch-text-tertiary">
                        {lastLog.notes}
                      </p>
                    )}
                  </div>
                  {!isDone && (
                    <button
                      onClick={() => setExpandedId(expanded ? null : task.id)}
                      className="btn-press flex shrink-0 items-center gap-1 rounded-[8px] border-none bg-porch-accent px-3 py-2 text-[12.5px] font-semibold text-white"
                    >
                      <CheckIcon size={13} strokeWidth={3} />
                      Mark done
                    </button>
                  )}
                </div>
                {!isDone && expanded && (
                  <CompleteWithNotes
                    onSubmit={(notes) => handleLog(task.id, notes)}
                    onCancel={() => setExpandedId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
