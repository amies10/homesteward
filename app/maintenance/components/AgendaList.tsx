"use client";

import { useState } from "react";
import { CheckIcon } from "@/app/components/icons";
import CompleteWithNotes from "@/app/maintenance/components/CompleteWithNotes";
import type { upcomingEntries } from "@/lib/maintenance";

interface Props {
  entries: ReturnType<typeof upcomingEntries>;
  onLogComplete: (userTaskId: string, notes?: string) => Promise<void>;
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function AgendaList({ entries, onLogComplete }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const overdue = entries.filter((e) => e.overdue);
  const upcoming = entries.filter((e) => !e.overdue);

  async function handleLog(userTaskId: string, notes?: string) {
    await onLogComplete(userTaskId, notes);
    setExpandedId(null);
  }

  function Row({ date, task }: { date: string; task: (typeof entries)[number]["task"]; overdue: boolean }) {
    const expanded = expandedId === task.id;
    return (
      <div className="rounded-[10px] border border-porch-border bg-porch-bg px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-porch-text-tertiary">
              {formatDate(date)}
            </p>
            <p className="truncate text-[14px] font-semibold text-porch-text">{task.name}</p>
          </div>
          <button
            onClick={() => setExpandedId(expanded ? null : task.id)}
            className="btn-press flex shrink-0 items-center gap-1 rounded-[8px] border-none bg-porch-accent px-3 py-2 text-[12.5px] font-semibold text-white"
          >
            <CheckIcon size={13} strokeWidth={3} />
            Mark done
          </button>
        </div>
        {expanded && (
          <CompleteWithNotes
            onSubmit={(notes) => handleLog(task.id, notes)}
            onCancel={() => setExpandedId(null)}
          />
        )}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
        <p className="text-sm text-porch-text-secondary">Nothing due in the next 90 days.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {overdue.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-urgent">Overdue</p>
          <div className="space-y-2">
            {overdue.map(({ date, task, overdue: isOverdue }) => (
              <Row key={task.id} date={date} task={task} overdue={isOverdue} />
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">
            Next 90 days
          </p>
          <div className="space-y-2">
            {upcoming.map(({ date, task, overdue: isOverdue }) => (
              <Row key={task.id} date={date} task={task} overdue={isOverdue} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
