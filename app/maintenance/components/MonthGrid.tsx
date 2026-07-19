import { ChevronLeftIcon, ChevronRightIcon } from "@/app/components/icons";
import type { DayStatus } from "@/lib/maintenance";
import { todayLocal } from "@/lib/maintenance";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DOT_COLOR: Record<DayStatus, string> = {
  due: "#B45309",
  overdue: "#B5432E",
  completed: "#3E7A4F",
};

interface Props {
  year: number;
  month: number; // 0-indexed
  markers: Record<string, DayStatus>;
  selectedDate: string | null;
  onSelectDay: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}

export default function MonthGrid({ year, month, markers, selectedDate, onSelectDay, onPrevMonth, onNextMonth }: Props) {
  const today = todayLocal();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const cells: Array<{ day: number; date: string } | null> = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      return { day, date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
    }),
  ];

  return (
    <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
      <div className="mb-3.5 flex items-center justify-between">
        <button onClick={onPrevMonth} aria-label="Previous month" className="btn-press p-1.5">
          <ChevronLeftIcon />
        </button>
        <span className="font-display text-[16px] font-semibold text-porch-text">{monthLabel}</span>
        <button onClick={onNextMonth} aria-label="Next month" className="btn-press p-1.5">
          <ChevronRightIcon color="#857A6D" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-[11px] font-semibold text-porch-text-tertiary">
            {w}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} />;
          const status = markers[cell.date];
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          return (
            <button
              key={cell.date}
              onClick={() => onSelectDay(cell.date)}
              className={`btn-press flex flex-col items-center gap-0.5 rounded-[8px] py-1.5 ${
                isSelected ? "bg-porch-accent-tint" : ""
              }`}
            >
              <span
                className={`text-[13px] ${isToday ? "font-bold text-porch-accent" : "text-porch-text"}`}
              >
                {cell.day}
              </span>
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: status ? DOT_COLOR[status] : "transparent" }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-4 border-t border-porch-border pt-3.5 text-[11.5px] text-porch-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: DOT_COLOR.due }} /> Due
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: DOT_COLOR.overdue }} /> Overdue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: DOT_COLOR.completed }} /> Done
        </span>
      </div>
    </div>
  );
}
