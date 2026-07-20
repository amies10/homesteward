"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  mergeReports,
  issueKey,
  parseMidpoint,
  type StoredReport,
  type CompletionRecord,
  type Issue,
} from "@/lib/sections";
import { loadReports, loadCompletions, loadIgnored } from "@/lib/data";
import AppHeader from "@/app/components/AppHeader";
import { PageSkeleton } from "@/app/components/Skeleton";

// Duplicated from app/page.tsx (also exported there as SEVERITY_STYLE) — kept
// local so this route doesn't pull in the dashboard page's whole import graph.
const SEVERITY_ORDER: Record<Issue["severity"], number> = {
  safety: 0, repair: 1, maintenance: 2, improvement: 3, fyi: 4,
};

const SEVERITY_STYLE: Record<Issue["severity"], { badge: string; label: string }> = {
  safety: { badge: "bg-red-100 text-red-700", label: "Safety" },
  repair: { badge: "bg-orange-100 text-orange-700", label: "Repair" },
  maintenance: { badge: "bg-amber-100 text-amber-700", label: "Maintenance" },
  improvement: { badge: "bg-blue-100 text-blue-700", label: "Improvement" },
  fyi: { badge: "bg-stone-100 text-stone-500", label: "FYI" },
};

interface PlanItem {
  slug: string;
  sectionName: string;
  reportId: string;
  issueIndex: number;
  issue: Issue;
}

export default function ActionPlanPage() {
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [completions, setCompletions] = useState<Record<string, CompletionRecord>>({});
  const [ignored, setIgnored] = useState<Record<string, true>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadReports(), loadCompletions(), loadIgnored()]).then(([loadedReports, c, ig]) => {
      setReports(loadedReports);
      setCompletions(c);
      setIgnored(ig);
      setLoaded(true);
    });
  }, []);

  const mergedSections = mergeReports(reports);

  const items: PlanItem[] = mergedSections.flatMap((section) =>
    section.issues
      .filter((ref) => !ref.issue.deleted)
      .filter((ref) => {
        const key = issueKey(ref.reportId, section.slug, ref.issueIndex);
        return !completions[key] && !ignored[key];
      })
      .map((ref) => ({
        slug: section.slug,
        sectionName: section.name,
        reportId: ref.reportId,
        issueIndex: ref.issueIndex,
        issue: ref.issue,
      }))
  );

  const sortedItems = [...items].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.issue.severity] - SEVERITY_ORDER[b.issue.severity];
    if (sevDiff !== 0) return sevDiff;
    const proA = parseMidpoint(a.issue.costEstimatePro) ?? -1;
    const proB = parseMidpoint(b.issue.costEstimatePro) ?? -1;
    return proB - proA;
  });

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <AppHeader backHref="/" backLabel="Dashboard" />

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Action Plan</span>
        <p className="mt-1 text-[13.5px] leading-relaxed text-porch-text-secondary">
          Everything open across your home, ordered by what&apos;s worth tackling first.
        </p>
      </div>

      {!loaded ? (
        <PageSkeleton />
      ) : sortedItems.length === 0 ? (
        <div className="mx-5 mt-4 rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-porch-success-bg">
            <span className="text-2xl text-porch-success">✓</span>
          </div>
          <p className="font-display text-[17px] font-semibold text-porch-text">All clear</p>
          <p className="mt-1 text-sm text-porch-text-secondary">Nothing on your plate right now.</p>
        </div>
      ) : (
        <div className="px-5 pb-1 pt-3">
          <div className="space-y-2.5">
            {sortedItems.map((item, i) => {
              const style = SEVERITY_STYLE[item.issue.severity];
              return (
                <Link
                  key={`${item.reportId}-${item.slug}-${item.issueIndex}`}
                  href={`/section/${item.slug}/issue/${item.issueIndex}?r=${item.reportId}`}
                  className="btn-press flex items-start gap-3 rounded-2xl border border-porch-border bg-porch-surface px-[18px] py-4 text-inherit no-underline shadow-[0_1px_2px_rgba(38,34,32,0.03)]"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-porch-accent-tint text-[12.5px] font-semibold text-porch-accent">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[15px] font-semibold leading-snug text-porch-text">{item.issue.title}</span>
                      <span
                        className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium ${style.badge}`}
                      >
                        {style.label}
                      </span>
                    </div>
                    <div className="mt-1 text-[12.5px] text-porch-text-tertiary">{item.sectionName}</div>
                    <div className="mt-2 flex flex-wrap gap-x-[18px] gap-y-1 text-[13px] text-porch-text-secondary">
                      <span>
                        DIY <strong className="font-semibold text-porch-text">{item.issue.costEstimateDIY ?? "—"}</strong>
                      </span>
                      <span>
                        Pro <strong className="font-semibold text-porch-text">{item.issue.costEstimatePro ?? "—"}</strong>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
