"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "@/app/components/Modal";
import { CheckIcon } from "@/app/components/icons";
import NotifyToggle from "@/app/components/NotifyToggle";
import { addUserTasks, todayLocal, type MasterTask, type UserTaskSelection } from "@/lib/maintenance";

const RECURRENCE_OPTIONS = [1, 3, 6, 12, 24];

interface Selection {
  recurrenceMonths: number;
  lastDone: string; // blank = start today
  notify: boolean;
}

interface Props {
  masterTasks: MasterTask[];
  existingTaskIds: Set<string>;
  suggestedNames?: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}

export default function SuggestionPicker({ masterTasks, existingTaskIds, suggestedNames, onClose, onSaved }: Props) {
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [saving, setSaving] = useState(false);

  // Pre-check non-already-added suggested tasks once, the same pattern as
  // the maintenance page's own first-run pre-population.
  const prepopulatedRef = useRef(false);
  useEffect(() => {
    if (prepopulatedRef.current || !suggestedNames || masterTasks.length === 0) return;
    prepopulatedRef.current = true;
    setSelections((prev) => {
      const next = { ...prev };
      for (const task of masterTasks) {
        if (existingTaskIds.has(task.id)) continue;
        if (suggestedNames.has(task.name) && !next[task.id]) {
          next[task.id] = { recurrenceMonths: task.defaultRecurrenceMonths, lastDone: "", notify: false };
        }
      }
      return next;
    });
  }, [masterTasks, existingTaskIds, suggestedNames]);

  const grouped = useMemo(() => {
    const groups: Record<string, MasterTask[]> = {};
    for (const task of masterTasks) {
      const cat = task.category ?? "Other";
      (groups[cat] ??= []).push(task);
    }
    return groups;
  }, [masterTasks]);

  function toggleSelection(task: MasterTask) {
    if (existingTaskIds.has(task.id)) return;
    setSelections((prev) => {
      const next = { ...prev };
      if (next[task.id]) delete next[task.id];
      else next[task.id] = { recurrenceMonths: task.defaultRecurrenceMonths, lastDone: "", notify: false };
      return next;
    });
  }

  function updateSelection(taskId: string, partial: Partial<Selection>) {
    setSelections((prev) => ({ ...prev, [taskId]: { ...prev[taskId], ...partial } }));
  }

  async function handleSave() {
    const entries: UserTaskSelection[] = Object.entries(selections).map(([taskId, sel]) => ({
      taskId,
      recurrenceMonths: sel.recurrenceMonths,
      anchorDate: sel.lastDone || todayLocal(),
      notify: sel.notify,
    }));
    if (!entries.length) return;

    setSaving(true);
    await addUserTasks(entries);
    setSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal onClose={onClose} maxWidth={440} maxHeight="80vh">
      <div className="mb-1 font-display text-lg font-semibold text-porch-text">Revisit Suggestions</div>
      <p className="mb-1 text-[13px] text-porch-text-secondary">
        Curated routine tasks — pick any you skipped the first time.
      </p>
      <p className="mb-4 text-[11px] leading-relaxed text-porch-text-tertiary">
        Reminders will be delivered once Porchlight is added to your home screen.
      </p>

      <div className="space-y-4">
        {Object.entries(grouped).map(([category, tasks]) => (
          <div key={category}>
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">
              {category}
            </p>
            <div className="space-y-2">
              {tasks.map((task) => {
                const alreadyAdded = existingTaskIds.has(task.id);
                const sel = selections[task.id];
                const isSelected = !!sel;
                return (
                  <div
                    key={task.id}
                    className={`rounded-[10px] border px-3.5 py-3 ${
                      alreadyAdded ? "border-porch-border bg-porch-bg opacity-60" : "border-porch-border bg-porch-bg"
                    }`}
                  >
                    <button
                      onClick={() => toggleSelection(task)}
                      disabled={alreadyAdded}
                      className="flex w-full items-start gap-2.5 text-left disabled:cursor-not-allowed"
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] ${
                          alreadyAdded || isSelected
                            ? "border-porch-accent bg-porch-accent"
                            : "border-porch-border-input bg-porch-surface"
                        }`}
                      >
                        {(alreadyAdded || isSelected) && <CheckIcon size={12} strokeWidth={3} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[13.5px] font-semibold text-porch-text">{task.name}</p>
                          {suggestedNames?.has(task.name) && (
                            <span className="rounded-full bg-porch-accent-tint px-2 py-[1px] text-[10.5px] font-semibold text-porch-accent">
                              Suggested for your home
                            </span>
                          )}
                        </div>
                        {alreadyAdded ? (
                          <p className="mt-0.5 text-[12px] text-porch-text-tertiary">Already on your calendar</p>
                        ) : (
                          task.description && (
                            <p className="mt-0.5 text-[12px] text-porch-text-secondary">{task.description}</p>
                          )
                        )}
                      </div>
                    </button>

                    {isSelected && !alreadyAdded && (
                      <div className="mt-2.5 pl-[30px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={sel.recurrenceMonths}
                            onChange={(e) => updateSelection(task.id, { recurrenceMonths: Number(e.target.value) })}
                            className="rounded-[6px] border border-porch-border-input bg-porch-surface px-2 py-1 text-[12px] text-porch-text"
                          >
                            {RECURRENCE_OPTIONS.map((m) => (
                              <option key={m} value={m}>Every {m} mo</option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={sel.lastDone}
                            onChange={(e) => updateSelection(task.id, { lastDone: e.target.value })}
                            className="rounded-[6px] border border-porch-border-input bg-porch-surface px-2 py-1 text-[12px] text-porch-text"
                          />
                          <span className="text-[11px] text-porch-text-tertiary">last done (blank = today)</span>
                        </div>
                        <div className="mt-2.5">
                          <NotifyToggle
                            checked={sel.notify}
                            onChange={(notify) => updateSelection(task.id, { notify })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        <button
          onClick={onClose}
          className="btn-press flex-1 rounded-[10px] border border-porch-border-input bg-porch-surface py-2.5 text-sm font-semibold text-porch-text-secondary"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={Object.keys(selections).length === 0 || saving}
          className="btn-press flex-1 rounded-[10px] border-none bg-porch-accent py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Adding…" : "Add Selected"}
        </button>
      </div>
    </Modal>
  );
}
