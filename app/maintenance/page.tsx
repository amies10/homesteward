"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import MonthGrid from "@/app/maintenance/components/MonthGrid";
import DayDetailSheet from "@/app/maintenance/components/DayDetailSheet";
import TaskManageList from "@/app/maintenance/components/TaskManageList";
import SuggestionPicker from "@/app/maintenance/components/SuggestionPicker";
import { PlusIcon, TrashIcon } from "@/app/components/icons";
import NotifyToggle from "@/app/components/NotifyToggle";
import {
  loadMasterTasks,
  loadUserTasks,
  loadAllLogs,
  addUserTasks,
  logCompletion,
  computeMarkers,
  computeEntriesForDate,
  todayLocal,
  type MasterTask,
  type UserTask,
  type MaintenanceLog,
  type UserTaskSelection,
} from "@/lib/maintenance";

const RECURRENCE_OPTIONS = [1, 3, 6, 12, 24];

interface Selection {
  recurrenceMonths: number;
  lastDone: string; // blank = start today
  notify: boolean;
}

export default function MaintenancePage() {
  const [masterTasks, setMasterTasks] = useState<MasterTask[]>([]);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savingSetup, setSavingSetup] = useState(false);

  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [customName, setCustomName] = useState("");
  const [customNotify, setCustomNotify] = useState(false);
  const [customTasks, setCustomTasks] = useState<Array<{ name: string; recurrenceMonths: number; notify: boolean }>>([]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showManage, setShowManage] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  async function refetch() {
    const [master, tasks, allLogs] = await Promise.all([loadMasterTasks(), loadUserTasks(), loadAllLogs()]);
    setMasterTasks(master);
    setUserTasks(tasks);
    setLogs(allLogs);
    setLoaded(true);
  }

  useEffect(() => {
    refetch();
  }, []);

  const isFirstRun = loaded && userTasks.length === 0;

  const markers = useMemo(() => computeMarkers(userTasks, logs, year, month), [userTasks, logs, year, month]);
  const dayEntries = useMemo(
    () => (selectedDate ? computeEntriesForDate(userTasks, logs, selectedDate) : []),
    [userTasks, logs, selectedDate]
  );

  const existingTaskIds = useMemo(
    () => new Set(userTasks.filter((t) => t.taskId).map((t) => t.taskId!)),
    [userTasks]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, MasterTask[]> = {};
    for (const task of masterTasks) {
      const cat = task.category ?? "Other";
      (groups[cat] ??= []).push(task);
    }
    return groups;
  }, [masterTasks]);

  function toggleSelection(task: MasterTask) {
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

  function addCustomTaskDraft() {
    if (!customName.trim()) return;
    setCustomTasks((prev) => [...prev, { name: customName.trim(), recurrenceMonths: 12, notify: customNotify }]);
    setCustomName("");
    setCustomNotify(false);
  }

  async function handleSaveSetup() {
    const selectionEntries: UserTaskSelection[] = Object.entries(selections).map(([taskId, sel]) => ({
      taskId,
      recurrenceMonths: sel.recurrenceMonths,
      anchorDate: sel.lastDone || todayLocal(),
      notify: sel.notify,
    }));
    const customEntries: UserTaskSelection[] = customTasks.map((c) => ({
      customName: c.name,
      recurrenceMonths: c.recurrenceMonths,
      anchorDate: todayLocal(),
      notify: c.notify,
    }));
    const all = [...selectionEntries, ...customEntries];
    if (!all.length) return;

    setSavingSetup(true);
    await addUserTasks(all);
    await refetch();
    setSavingSetup(false);
  }

  async function handleLogComplete(userTaskId: string, notes?: string) {
    await logCompletion(userTaskId, selectedDate ?? todayLocal(), notes);
    setLogs(await loadAllLogs());
  }

  function goPrevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1);
  }
  function goNextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1);
  }

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <AppHeader backHref="/" backLabel="Dashboard" />

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Maintenance Calendar</span>
      </div>

      {!loaded ? null : isFirstRun ? (
        <>
          <div className="px-5 pt-2">
            <p className="text-[13.5px] leading-relaxed text-porch-text-secondary">
              Pick the routine tasks you want to track. We&apos;ll figure out when each is next due.
            </p>
          </div>

          {Object.entries(grouped).map(([category, tasks]) => (
            <div key={category} className="mx-5 mt-4 space-y-2 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">{category}</p>
              {tasks.map((task) => {
                const sel = selections[task.id];
                const isSelected = !!sel;
                return (
                  <div key={task.id} className="rounded-[10px] border border-porch-border bg-porch-bg px-3.5 py-3">
                    <button
                      onClick={() => toggleSelection(task)}
                      className="flex w-full items-start gap-2.5 text-left"
                    >
                      <div
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-[1.5px] ${
                          isSelected ? "border-porch-accent bg-porch-accent" : "border-porch-border-input bg-porch-surface"
                        }`}
                      >
                        {isSelected && <span className="h-2 w-2 rounded-sm bg-white" />}
                      </div>
                      <div>
                        <p className="text-[13.5px] font-semibold text-porch-text">{task.name}</p>
                        {task.description && (
                          <p className="mt-0.5 text-[12px] text-porch-text-secondary">{task.description}</p>
                        )}
                      </div>
                    </button>

                    {isSelected && (
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
          ))}

          <div className="mx-5 mt-4 space-y-2.5 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">Add your own</p>
            {customTasks.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-[10px] bg-porch-bg px-3 py-2">
                <span className="text-[13px] text-porch-text">{c.name} — every {c.recurrenceMonths}mo</span>
                <button onClick={() => setCustomTasks((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove" className="p-1">
                  <TrashIcon />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustomTaskDraft(); }}
                placeholder="Custom task name"
                className="flex-1 rounded-[10px] border border-porch-border-input bg-porch-surface px-3 py-2.5 text-[13.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
              />
              <button
                onClick={addCustomTaskDraft}
                disabled={!customName.trim()}
                aria-label="Add custom task"
                className="btn-press flex shrink-0 items-center justify-center rounded-[10px] border-none bg-porch-accent px-3 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PlusIcon color="#FFFFFF" />
              </button>
            </div>
            <NotifyToggle checked={customNotify} onChange={setCustomNotify} showNote />
          </div>

          <div className="px-5 pt-6">
            <button
              onClick={handleSaveSetup}
              disabled={(Object.keys(selections).length === 0 && customTasks.length === 0) || savingSetup}
              className="btn-press w-full rounded-[10px] border-none bg-porch-accent py-3.5 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingSetup ? "Saving…" : "Start Tracking"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="px-5 pt-2">
            <button
              onClick={() => setShowManage(true)}
              className="text-[13px] font-semibold text-porch-accent"
            >
              Manage tasks
            </button>
          </div>
          <div className="mx-5 mt-3">
            <MonthGrid
              year={year}
              month={month}
              markers={markers}
              selectedDate={selectedDate}
              onSelectDay={setSelectedDate}
              onPrevMonth={goPrevMonth}
              onNextMonth={goNextMonth}
            />
          </div>
        </>
      )}

      {selectedDate && (
        <DayDetailSheet
          date={selectedDate}
          entries={dayEntries}
          onLogComplete={handleLogComplete}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {showManage && (
        <TaskManageList
          userTasks={userTasks}
          onClose={() => setShowManage(false)}
          onChange={refetch}
          onRevisitSuggestions={() => { setShowManage(false); setShowSuggestions(true); }}
        />
      )}

      {showSuggestions && (
        <SuggestionPicker
          masterTasks={masterTasks}
          existingTaskIds={existingTaskIds}
          onClose={() => setShowSuggestions(false)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
