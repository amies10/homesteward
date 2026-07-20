import { supabase } from "./supabase-client";
import type { Issue, PropertyDetails } from "./sections";

export interface MasterTask {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  defaultRecurrenceMonths: number;
}

export interface UserTask {
  id: string;
  taskId: string | null;
  name: string;
  description: string | null;
  recurrenceMonths: number;
  anchorDate: string; // YYYY-MM-DD
  active: boolean;
  notify: boolean;
}

export interface MaintenanceLog {
  id: string;
  userTaskId: string;
  completedOn: string; // YYYY-MM-DD
  notes: string | null;
}

export type DayStatus = "due" | "overdue" | "completed";

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

// ── Date math — always local calendar dates, never UTC/toISOString, which
// shifts across midnight for anyone west of UTC and would paint the wrong
// day's cell. ──────────────────────────────────────────────────────────────

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addMonthsLocal(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const daysInTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(d, daysInTarget);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function addDaysLocal(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(y, m - 1, d + days);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

// ── Reads ────────────────────────────────────────────────────────────────

export async function loadMasterTasks(): Promise<MasterTask[]> {
  try {
    const { data, error } = await supabase
      .from("maintenance_tasks")
      .select("id, name, description, category, default_recurrence_months")
      .order("category", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      defaultRecurrenceMonths: row.default_recurrence_months,
    }));
  } catch (err) {
    console.warn("[maintenance] loadMasterTasks failed", err);
    return [];
  }
}

export async function loadUserTasks(): Promise<UserTask[]> {
  try {
    const { data, error } = await supabase
      .from("user_maintenance_tasks")
      .select(
        "id, task_id, custom_name, custom_description, recurrence_months, anchor_date, active, notify, maintenance_tasks(name, description)"
      );
    if (error) throw error;
    return (data ?? []).map((row) => {
      const master = row.maintenance_tasks as unknown as { name: string; description: string | null } | null;
      return {
        id: row.id,
        taskId: row.task_id,
        name: row.custom_name ?? master?.name ?? "Task",
        description: row.custom_description ?? master?.description ?? null,
        recurrenceMonths: row.recurrence_months,
        anchorDate: row.anchor_date,
        active: row.active,
        notify: row.notify ?? false,
      };
    });
  } catch (err) {
    console.warn("[maintenance] loadUserTasks failed", err);
    return [];
  }
}

export async function loadAllLogs(): Promise<MaintenanceLog[]> {
  try {
    const { data, error } = await supabase
      .from("maintenance_logs")
      .select("id, user_task_id, completed_on, notes")
      .order("completed_on", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      userTaskId: row.user_task_id,
      completedOn: row.completed_on,
      notes: row.notes,
    }));
  } catch (err) {
    console.warn("[maintenance] loadAllLogs failed", err);
    return [];
  }
}

// ── Writes ───────────────────────────────────────────────────────────────

export interface UserTaskSelection {
  taskId?: string;
  customName?: string;
  customDescription?: string;
  recurrenceMonths: number;
  anchorDate: string;
  notify?: boolean;
}

export async function addUserTasks(selections: UserTaskSelection[]): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId || !selections.length) return;

  const rows = selections.map((s) => ({
    user_id: userId,
    task_id: s.taskId ?? null,
    custom_name: s.customName ?? null,
    custom_description: s.customDescription ?? null,
    recurrence_months: s.recurrenceMonths,
    anchor_date: s.anchorDate,
    notify: s.notify ?? false,
  }));

  try {
    const { error } = await supabase.from("user_maintenance_tasks").insert(rows);
    if (error) throw error;
  } catch (err) {
    console.warn("[maintenance] addUserTasks failed", err);
  }
}

export async function updateUserTask(
  id: string,
  partial: { recurrenceMonths?: number; active?: boolean; customName?: string; notify?: boolean }
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (partial.recurrenceMonths !== undefined) payload.recurrence_months = partial.recurrenceMonths;
  if (partial.active !== undefined) payload.active = partial.active;
  if (partial.customName !== undefined) payload.custom_name = partial.customName;
  if (partial.notify !== undefined) payload.notify = partial.notify;
  if (Object.keys(payload).length === 0) return;

  try {
    const { error } = await supabase.from("user_maintenance_tasks").update(payload).eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.warn("[maintenance] updateUserTask failed", err);
  }
}

export async function deactivateUserTask(id: string): Promise<void> {
  return updateUserTask(id, { active: false });
}

export async function reactivateUserTask(id: string): Promise<void> {
  return updateUserTask(id, { active: true });
}

export async function logCompletion(userTaskId: string, dateStr: string, notes?: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  try {
    const { error } = await supabase
      .from("maintenance_logs")
      .insert({ user_id: userId, user_task_id: userTaskId, completed_on: dateStr, notes: notes ?? null });
    if (error) throw error;
  } catch (err) {
    console.warn("[maintenance] logCompletion failed", err);
  }
}

// ── Pure schedule math ───────────────────────────────────────────────────

function lastLogFor(taskId: string, logs: MaintenanceLog[]): MaintenanceLog | undefined {
  return logs
    .filter((l) => l.userTaskId === taskId)
    .sort((a, b) => (a.completedOn < b.completedOn ? 1 : -1))[0];
}

export function nextDueDate(task: UserTask, logs: MaintenanceLog[]): string {
  const basis = lastLogFor(task.id, logs)?.completedOn ?? task.anchorDate;
  return addMonthsLocal(basis, task.recurrenceMonths);
}

// One marker per calendar day for the visible month. Overdue only ever
// marks *today's* cell (not the original due date in the past), since a
// task that's 3 months overdue shouldn't paint every day since it was due.
export function computeMarkers(
  tasks: UserTask[],
  logs: MaintenanceLog[],
  year: number,
  month: number
): Record<string, DayStatus> {
  const markers: Record<string, DayStatus> = {};
  const today = todayLocal();

  for (const log of logs) {
    const [ly, lm] = log.completedOn.split("-").map(Number);
    if (ly === year && lm - 1 === month) markers[log.completedOn] = "completed";
  }

  let anyOverdue = false;
  for (const task of tasks.filter((t) => t.active)) {
    const due = nextDueDate(task, logs);
    if (due < today) {
      anyOverdue = true;
      continue;
    }
    const [dy, dm] = due.split("-").map(Number);
    if (dy === year && dm - 1 === month && markers[due] !== "completed") {
      markers[due] = "due";
    }
  }

  if (anyOverdue) {
    const [ty, tm] = today.split("-").map(Number);
    if (ty === year && tm - 1 === month) markers[today] = "overdue";
  }

  return markers;
}

export interface DayEntry {
  task: UserTask;
  status: DayStatus;
  lastLog?: MaintenanceLog;
}

// Due-or-overdue count for today, e.g. for a dashboard badge.
export function countDueOrOverdue(tasks: UserTask[], logs: MaintenanceLog[]): number {
  return computeEntriesForDate(tasks, logs, todayLocal()).filter((e) => e.status !== "completed").length;
}

export function computeEntriesForDate(tasks: UserTask[], logs: MaintenanceLog[], date: string): DayEntry[] {
  const today = todayLocal();
  const entries: DayEntry[] = [];

  for (const task of tasks.filter((t) => t.active)) {
    const taskLogs = logs
      .filter((l) => l.userTaskId === task.id)
      .sort((a, b) => (a.completedOn < b.completedOn ? 1 : -1));
    const lastLog = taskLogs[0];

    const completedThisDay = taskLogs.find((l) => l.completedOn === date);
    if (completedThisDay) {
      entries.push({ task, status: "completed", lastLog: completedThisDay });
      continue;
    }

    const due = nextDueDate(task, logs);
    if (due === date) {
      entries.push({ task, status: due < today ? "overdue" : "due", lastLog });
    } else if (date === today && due < today) {
      entries.push({ task, status: "overdue", lastLog });
    }
  }

  return entries;
}

// ── G1: property-aware task suggestions ─────────────────────────────────
// Task names below are matched verbatim against the seed data in
// supabase/migrations/013_maintenance.sql — every name referenced here exists
// in that seed list exactly as written.
export function suggestedTaskNames(property: PropertyDetails | null, mergedIssues: Issue[]): Set<string> {
  const names = new Set<string>();

  if (property?.hvacType) {
    if (/forced.?air|furnace/i.test(property.hvacType)) {
      names.add("Replace HVAC filter");
    }
    names.add("Service HVAC system");
  }

  if (property?.roofType) {
    names.add("Inspect roof from ground");
    names.add("Clean gutters & downspouts");
  }

  if (property?.foundationType && /basement|crawl/i.test(property.foundationType)) {
    names.add("Check sump pump");
    names.add("Inspect foundation & grading");
  }

  const specStrings = [
    ...((property?.otherSpecs ?? []).map((s) => s.value)),
    ...mergedIssues.flatMap((i) => i.equipmentSpecs ?? []),
  ];
  if (specStrings.some((s) => /water softener/i.test(s))) {
    names.add("Check water softener salt");
  }
  if (specStrings.some((s) => /water heater/i.test(s))) {
    names.add("Flush water heater");
  }

  names.add("Test smoke & CO detectors");
  names.add("Test GFCI outlets");

  return names;
}

// ── G2: agenda view ──────────────────────────────────────────────────────
export function upcomingEntries(
  tasks: UserTask[],
  logs: MaintenanceLog[],
  days = 90
): Array<{ date: string; task: UserTask; overdue: boolean }> {
  const today = todayLocal();
  const horizon = addDaysLocal(today, days);
  const entries: Array<{ date: string; task: UserTask; overdue: boolean }> = [];

  for (const task of tasks.filter((t) => t.active)) {
    const due = nextDueDate(task, logs);
    if (due < today) {
      entries.push({ date: due, task, overdue: true });
    } else if (due <= horizon) {
      entries.push({ date: due, task, overdue: false });
    }
  }

  return entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
