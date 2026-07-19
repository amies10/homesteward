"use client";

import { useState } from "react";
import Modal from "@/app/components/Modal";
import { PlusIcon } from "@/app/components/icons";
import NotifyToggle from "@/app/components/NotifyToggle";
import { updateUserTask, deactivateUserTask, reactivateUserTask, addUserTasks, todayLocal, type UserTask } from "@/lib/maintenance";

const RECURRENCE_OPTIONS = [1, 3, 6, 12, 24];

interface Props {
  userTasks: UserTask[];
  onClose: () => void;
  onChange: () => void;
  onRevisitSuggestions: () => void;
}

export default function TaskManageList({ userTasks, onClose, onChange, onRevisitSuggestions }: Props) {
  const [customName, setCustomName] = useState("");
  const [customRecurrence, setCustomRecurrence] = useState(12);
  const [customNotify, setCustomNotify] = useState(false);
  const [addingCustom, setAddingCustom] = useState(false);

  async function handleRecurrenceChange(id: string, months: number) {
    await updateUserTask(id, { recurrenceMonths: months });
    onChange();
  }

  async function handleToggleActive(task: UserTask) {
    if (task.active) await deactivateUserTask(task.id);
    else await reactivateUserTask(task.id);
    onChange();
  }

  async function handleToggleNotify(task: UserTask) {
    await updateUserTask(task.id, { notify: !task.notify });
    onChange();
  }

  async function handleAddCustom() {
    if (!customName.trim()) return;
    setAddingCustom(true);
    await addUserTasks([
      { customName: customName.trim(), recurrenceMonths: customRecurrence, anchorDate: todayLocal(), notify: customNotify },
    ]);
    setCustomName("");
    setCustomNotify(false);
    setAddingCustom(false);
    onChange();
  }

  return (
    <Modal onClose={onClose} maxWidth={420} maxHeight="80vh">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-lg font-semibold text-porch-text">Manage Tasks</span>
        <button
          onClick={onRevisitSuggestions}
          className="text-[12.5px] font-semibold text-porch-accent"
        >
          Revisit Suggestions
        </button>
      </div>

      <div className="space-y-2.5">
        {userTasks.map((task) => (
          <div key={task.id} className="rounded-[10px] border border-porch-border bg-porch-bg px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className={`truncate text-[14px] font-semibold ${task.active ? "text-porch-text" : "text-porch-text-tertiary line-through"}`}>
                {task.name}
              </span>
              <button
                onClick={() => handleToggleActive(task)}
                className="btn-press shrink-0 rounded-full border border-porch-border-input bg-porch-surface px-2.5 py-1 text-[11.5px] font-semibold text-porch-text-secondary"
              >
                {task.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[12px] text-porch-text-secondary">Every</span>
              <select
                value={task.recurrenceMonths}
                onChange={(e) => handleRecurrenceChange(task.id, Number(e.target.value))}
                className="rounded-[6px] border border-porch-border-input bg-porch-surface px-2 py-1 text-[12.5px] text-porch-text"
              >
                {RECURRENCE_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} month{m !== 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2.5">
              <NotifyToggle checked={task.notify} onChange={() => handleToggleNotify(task)} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-porch-border pt-4">
        <p className="mb-2 text-[13px] font-semibold text-porch-text">Add a custom task</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Task name"
            className="flex-1 rounded-[10px] border border-porch-border-input bg-porch-surface px-3 py-2.5 text-[13.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
          />
          <select
            value={customRecurrence}
            onChange={(e) => setCustomRecurrence(Number(e.target.value))}
            className="rounded-[10px] border border-porch-border-input bg-porch-surface px-2 text-[13px] text-porch-text"
          >
            {RECURRENCE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}mo
              </option>
            ))}
          </select>
          <button
            onClick={handleAddCustom}
            disabled={!customName.trim() || addingCustom}
            aria-label="Add task"
            className="btn-press flex shrink-0 items-center justify-center rounded-[10px] border-none bg-porch-accent px-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <PlusIcon color="#FFFFFF" />
          </button>
        </div>
        <div className="mt-2.5">
          <NotifyToggle checked={customNotify} onChange={setCustomNotify} showNote />
        </div>
      </div>
    </Modal>
  );
}
