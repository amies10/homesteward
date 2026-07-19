"use client";

import { useState } from "react";
import Modal from "@/app/components/Modal";
import { CheckIcon } from "@/app/components/icons";
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
  const [loggingId, setLoggingId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const label = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  async function handleLog(userTaskId: string) {
    setLoggingId(userTaskId);
    await onLogComplete(userTaskId);
    setDoneIds((prev) => new Set(prev).add(userTaskId));
    setLoggingId(null);
  }

  return (
    <Modal onClose={onClose} maxWidth={400} maxHeight="75vh">
      <div className="mb-4 font-display text-lg font-semibold text-porch-text">{label}</div>

      {entries.length === 0 ? (
        <p className="text-sm text-porch-text-secondary">Nothing due or done this day.</p>
      ) : (
        <div className="space-y-2.5">
          {entries.map(({ task, status }) => {
            const style = STATUS_STYLE[status];
            const justLogged = doneIds.has(task.id);
            const isDone = status === "completed" || justLogged;
            return (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-porch-border bg-porch-bg px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-porch-text">{task.name}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${style.cls}`}>
                    {isDone ? "Done" : style.label}
                  </span>
                </div>
                {!isDone && (
                  <button
                    onClick={() => handleLog(task.id)}
                    disabled={loggingId === task.id}
                    className="btn-press flex shrink-0 items-center gap-1 rounded-[8px] border-none bg-porch-accent px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
                  >
                    {loggingId === task.id ? "…" : <CheckIcon size={13} strokeWidth={3} />}
                    Mark done
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
