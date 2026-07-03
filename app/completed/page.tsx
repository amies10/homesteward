"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  sections,
  normalize,
  type Issue,
  type ParsedReport,
  type CompletionRecord,
  type SectionConfig,
} from "@/lib/sections";
import { loadLatestReport, loadCompletions } from "@/lib/data";

const SEVERITY: Record<
  Issue["severity"],
  { badge: string; label: string }
> = {
  safety: { badge: "bg-red-100 text-red-700", label: "Safety" },
  repair: { badge: "bg-orange-100 text-orange-700", label: "Repair" },
  maintenance: { badge: "bg-amber-100 text-amber-700", label: "Maintenance" },
  improvement: { badge: "bg-blue-100 text-blue-700", label: "Improvement" },
  fyi: { badge: "bg-stone-100 text-stone-500", label: "FYI" },
};

interface CompletedItem {
  issue: Issue;
  section: SectionConfig;
  record: CompletionRecord;
  issueIndex: number;
}

function parseMidpoint(cost?: string | null): number | null {
  if (!cost) return null;
  const nums = [...cost.matchAll(/[\d,]+/g)].map((m) =>
    parseInt(m[0].replace(/,/g, ""), 10)
  );
  if (nums.length < 2 || nums.some(isNaN)) return null;
  return Math.round((nums[0] + nums[1]) / 2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDollars(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

export default function CompletedPage() {
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadLatestReport(), loadCompletions()]).then(
      ([report, completions]) => {
        const result: CompletedItem[] = [];

        for (const [, record] of Object.entries(completions)) {
          const section = sections.find((s) => s.slug === record.slug);
          if (!section) continue;

          let issue: Issue | undefined;
          if (report) {
            const reportSection = report.sections.find(
              (s) => normalize(s.name) === normalize(section.label)
            );
            issue = reportSection?.issues[record.issueIndex];
          }

          if (!issue) continue;
          result.push({ issue, section, record, issueIndex: record.issueIndex });
        }

        result.sort(
          (a, b) =>
            new Date(b.record.completedAt).getTime() -
            new Date(a.record.completedAt).getTime()
        );

        setItems(result);
        setLoaded(true);
      }
    );
  }, []);

  const total = items.length;
  const byMe = items.filter((x) => x.record.completedBy === "me").length;
  const byPro = items.filter(
    (x) => x.record.completedBy === "professional"
  ).length;

  let totalSavings: number | null = null;
  for (const item of items) {
    if (item.record.completedBy !== "me") continue;
    const pro = parseMidpoint(item.issue.costEstimatePro);
    const diy = parseMidpoint(item.issue.costEstimateDIY);
    if (pro !== null && diy !== null) {
      totalSavings = (totalSavings ?? 0) + (pro - diy);
    }
  }

  const groupedBySection = sections
    .map((section) => ({
      section,
      items: items.filter((x) => x.section.slug === section.slug),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-stone-400 transition-colors hover:text-stone-600"
            >
              ← Dashboard
            </Link>
            <div className="h-4 w-px bg-stone-200" />
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Completed Fixes
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        {!loaded ? null : total === 0 ? (
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-stone-500">
              No completed fixes yet.{" "}
              <Link
                href="/"
                className="text-stone-700 underline underline-offset-2"
              >
                Go to the dashboard
              </Link>{" "}
              to start tracking repairs.
            </p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { value: String(total), label: "Issues Fixed" },
                { value: String(byMe), label: "Fixed by Me" },
                { value: String(byPro), label: "Fixed by Professional" },
                {
                  value:
                    totalSavings !== null
                      ? `~${formatDollars(totalSavings)}`
                      : "—",
                  label: "Est. Savings",
                },
              ].map(({ value, label }) => (
                <div
                  key={label}
                  className="rounded-lg border border-stone-200 bg-white px-5 py-4"
                >
                  <p className="text-2xl font-semibold tracking-tight text-stone-900">
                    {value}
                  </p>
                  <p className="mt-1 text-xs text-stone-400">{label}</p>
                </div>
              ))}
            </div>

            {/* Sections */}
            {groupedBySection.map(({ section, items: sectionItems }) => (
              <div key={section.slug}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-stone-900">
                    {section.label}
                  </h2>
                  <span className="text-xs text-stone-400">
                    {sectionItems.length} fix
                    {sectionItems.length !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="space-y-3">
                  {sectionItems.map((item) => {
                    const style =
                      SEVERITY[item.issue.severity] ?? SEVERITY.fyi;
                    const savings =
                      item.record.completedBy === "me"
                        ? (() => {
                            const pro = parseMidpoint(
                              item.issue.costEstimatePro
                            );
                            const diy = parseMidpoint(
                              item.issue.costEstimateDIY
                            );
                            return pro !== null && diy !== null
                              ? pro - diy
                              : null;
                          })()
                        : null;

                    return (
                      <Link
                        key={`${item.section.slug}-${item.issueIndex}`}
                        href={`/section/${item.section.slug}/issue/${item.issueIndex}?from=completed`}
                        className="block rounded-lg border border-stone-200 bg-white px-5 py-4 transition-opacity hover:opacity-75"
                      >
                        <div className="mb-3 flex items-start justify-between gap-4">
                          <span className="text-sm font-medium text-stone-900">
                            {item.issue.title}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}
                          >
                            {style.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                          <div className="flex gap-2">
                            <span className="text-stone-400">Fixed by</span>
                            <span className="text-stone-700">
                              {item.record.completedBy === "me"
                                ? "Me"
                                : "A Professional"}
                            </span>
                          </div>

                          {item.record.completedBy === "me" &&
                            item.record.difficulty != null && (
                              <div className="flex gap-2">
                                <span className="text-stone-400">
                                  Difficulty
                                </span>
                                <span className="text-stone-700">
                                  {item.record.difficulty}/5
                                </span>
                              </div>
                            )}

                          <div className="flex gap-2">
                            <span className="text-stone-400">Completed</span>
                            <span className="text-stone-700">
                              {formatDate(item.record.completedAt)}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <span className="text-stone-400">DIY</span>
                            <span className="text-stone-700">
                              {item.issue.costEstimateDIY ?? "—"}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <span className="text-stone-400">Pro</span>
                            <span className="text-stone-700">
                              {item.issue.costEstimatePro ?? "—"}
                            </span>
                          </div>

                          {savings !== null && (
                            <div className="flex gap-2">
                              <span className="text-stone-400">Est. saved</span>
                              <span className="font-medium text-stone-700">
                                ~{formatDollars(savings)}
                              </span>
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
