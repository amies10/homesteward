import type { AgingInsight } from "@/lib/insights";
import { CalendarIcon } from "./icons";

export default function AgingCallout({ insights }: { insights: AgingInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-[18px]">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-amber-700">Worth planning for</p>
      <div className="mt-2.5 space-y-2.5">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <CalendarIcon size={16} color="#B45309" strokeWidth={1.8} className="mt-0.5 shrink-0" />
            <p className="text-[13.5px] leading-relaxed text-amber-700">{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
