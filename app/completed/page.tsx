"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  sections,
  normalize,
  type Issue,
  type CompletionRecord,
  type SectionConfig,
} from "@/lib/sections";
import { loadLatestReport, loadCompletions } from "@/lib/data";
import Modal from "@/app/components/Modal";
import { ChevronLeftIcon } from "@/app/components/icons";
import HomeButton from "@/app/components/HomeButton";
import CalendarButton from "@/app/components/CalendarButton";

const TYPE_LABEL: Record<Issue["severity"], string> = {
  safety: "Safety",
  repair: "Repair",
  maintenance: "Maintenance",
  improvement: "Improvement",
  fyi: "FYI",
};

interface CompletedItem {
  issue: Issue;
  section: SectionConfig;
  record: CompletionRecord;
  issueIndex: number;
}

function parseMidpoint(cost?: string | null): number | null {
  if (!cost) return null;
  const nums = [...cost.matchAll(/[\d,]+/g)].map((m) => parseInt(m[0].replace(/,/g, ""), 10));
  if (nums.length < 2 || nums.some(isNaN)) return null;
  return Math.round((nums[0] + nums[1]) / 2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDollars(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

function savingsFor(item: CompletedItem): number | null {
  if (item.record.completedBy !== "me") return null;
  const pro = parseMidpoint(item.issue.costEstimatePro);
  const diy = parseMidpoint(item.issue.costEstimateDIY);
  return pro !== null && diy !== null ? pro - diy : null;
}

type Filter = "all" | "me" | "pro";

export default function CompletedPage() {
  const [items, setItems] = useState<CompletedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [showSavings, setShowSavings] = useState(false);

  useEffect(() => {
    Promise.all([loadLatestReport(), loadCompletions()]).then(([report, completions]) => {
      const result: CompletedItem[] = [];

      for (const [, record] of Object.entries(completions)) {
        if (!report) continue;

        // Find the section in the actual report data (slug-or-name match) —
        // covers both standard sections and user-added custom sections.
        const reportSection = report.sections.find(
          (s) => s.slug === record.slug || normalize(s.name) === normalize(record.slug)
        );
        if (!reportSection) continue;

        const issue = reportSection.issues[record.issueIndex];
        if (!issue) continue;

        // Prefer the hardcoded label/description if it's a standard section;
        // otherwise build a display config from the report's own custom section.
        const standardSection = sections.find((s) => s.slug === record.slug);
        const sectionDisplay: SectionConfig = standardSection ?? {
          slug: reportSection.slug ?? record.slug,
          label: reportSection.name,
          description: reportSection.description ?? "",
        };

        result.push({ issue, section: sectionDisplay, record, issueIndex: record.issueIndex });
      }

      result.sort((a, b) => new Date(b.record.completedAt).getTime() - new Date(a.record.completedAt).getTime());
      setItems(result);
      setLoaded(true);
    });
  }, []);

  const total = items.length;
  const byMe = items.filter((x) => x.record.completedBy === "me").length;
  const byPro = items.filter((x) => x.record.completedBy === "professional").length;

  let totalSavings: number | null = null;
  for (const item of items) {
    const s = savingsFor(item);
    if (s !== null) totalSavings = (totalSavings ?? 0) + s;
  }

  const usedSections = Array.from(new Map(items.map((x) => [x.section.slug, x.section])).values());
  const sectionChips = [
    { slug: "all", label: "All" },
    ...usedSections.map((s) => ({ slug: s.slug, label: s.label })),
  ];

  const q = search.trim().toLowerCase();
  const filtered = items.filter((x) => {
    if (filter === "me" && x.record.completedBy !== "me") return false;
    if (filter === "pro" && x.record.completedBy !== "professional") return false;
    if (sectionFilter !== "all" && x.section.slug !== sectionFilter) return false;
    if (q && !x.issue.title.toLowerCase().includes(q)) return false;
    return true;
  });

  const allSectionSlugs = Array.from(new Set(filtered.map((x) => x.section.slug)));
  const groupedBySection = allSectionSlugs
    .map((slug) => ({
      section: items.find((x) => x.section.slug === slug)!.section,
      items: filtered.filter((x) => x.section.slug === slug),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2.5 border-b border-porch-border bg-porch-surface px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/" className="flex items-center gap-1.5 text-[13.5px] text-porch-text-secondary no-underline">
            <ChevronLeftIcon size={15} />
            Dashboard
          </Link>
          <span className="h-4 w-px bg-porch-border" />
          <span className="truncate text-[15px] font-semibold text-porch-text">Completed Fixes</span>
        </div>
        <CalendarButton size={18} />
        <HomeButton size={18} />
      </header>

      {!loaded ? null : total === 0 ? (
        <div className="mx-5 mt-6 rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
          <p className="text-sm text-porch-text-secondary">
            No completed fixes yet.{" "}
            <Link href="/" className="text-porch-accent underline underline-offset-2">
              Go to the dashboard
            </Link>{" "}
            to start tracking repairs.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 px-5 pb-1 pt-[18px]">
            {(
              [
                { key: "all" as const, value: String(total), label: "Issues Fixed" },
                { key: "me" as const, value: String(byMe), label: "Fixed by Me" },
                { key: "pro" as const, value: String(byPro), label: "Fixed by a Pro" },
              ]
            ).map(({ key, value, label }) => {
              const active = filter === key;
              return (
                <button
                  key={key}
                  onClick={() => setFilter((f) => (f === key ? "all" : key))}
                  className={`btn-press rounded-2xl border-[1.5px] p-4 text-left ${
                    active ? "border-porch-accent bg-porch-accent-tint" : "border-porch-border bg-porch-surface"
                  }`}
                >
                  <div className={`font-display text-2xl font-semibold ${active ? "text-porch-accent" : "text-porch-text"}`}>
                    {value}
                  </div>
                  <div className={`mt-0.5 text-[12.5px] ${active ? "text-porch-accent-tint-text" : "text-porch-text-secondary"}`}>
                    {label}
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => setShowSavings(true)}
              className="btn-press rounded-2xl border-[1.5px] border-porch-border bg-porch-surface p-4 text-left"
            >
              <div className="font-display text-2xl font-semibold text-porch-accent">
                {totalSavings !== null ? `~${formatDollars(totalSavings)}` : "—"}
              </div>
              <div className="mt-0.5 text-[12.5px] text-porch-text-secondary">Est. Savings</div>
            </button>
          </div>

          <div className="px-5 pb-0 pt-[18px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search completed fixes..."
              className="w-full rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
            />
            <div className="flex gap-2 overflow-x-auto pb-0.5 pt-3">
              {sectionChips.map((chip) => {
                const active = sectionFilter === chip.slug;
                return (
                  <button
                    key={chip.slug}
                    onClick={() => setSectionFilter(chip.slug)}
                    className={`btn-press shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-[7px] text-[13px] font-semibold ${
                      active ? "border-porch-accent bg-porch-accent text-white" : "border-porch-border-input bg-porch-surface text-[#6B5F55]"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {groupedBySection.length === 0 ? (
            <div className="px-5 pt-12 text-center text-sm text-porch-text-tertiary">
              No completed fixes match that search or filter.
            </div>
          ) : (
            groupedBySection.map(({ section, items: sectionItems }) => (
              <div key={section.slug} className="px-5 pb-1 pt-4">
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="text-[15.5px] font-semibold text-porch-text">{section.label}</span>
                  <span className="text-[12.5px] text-porch-text-tertiary">
                    {sectionItems.length} fix{sectionItems.length !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {sectionItems.map((item) => {
                    const savings = savingsFor(item);
                    return (
                      <Link
                        key={`${item.section.slug}-${item.issueIndex}`}
                        href={`/section/${item.section.slug}/issue/${item.issueIndex}?from=completed`}
                        className="block rounded-2xl border border-porch-border bg-porch-surface px-[18px] py-4 no-underline"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="text-[15px] font-semibold leading-snug text-porch-text">{item.issue.title}</span>
                          <span className="shrink-0 whitespace-nowrap rounded-full bg-porch-accent-tint px-2.5 py-[3px] text-[11.5px] font-semibold text-[#6B5F55]">
                            {TYPE_LABEL[item.issue.severity]}
                          </span>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1 text-[13px] text-porch-text-secondary">
                          <span>
                            Fixed by{" "}
                            <strong className="font-semibold text-porch-text">
                              {item.record.completedBy === "me" ? "Me" : "A Professional"}
                            </strong>
                          </span>
                          <span>
                            Completed <strong className="font-semibold text-porch-text">{formatDate(item.record.completedAt)}</strong>
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-[18px] gap-y-1 text-[13px] text-porch-text-secondary">
                          <span>
                            DIY <strong className="font-semibold text-porch-text">{item.issue.costEstimateDIY ?? "—"}</strong>
                          </span>
                          <span>
                            Pro <strong className="font-semibold text-porch-text">{item.issue.costEstimatePro ?? "—"}</strong>
                          </span>
                          {savings !== null && (
                            <span>
                              Saved <strong className="font-semibold text-porch-accent">~{formatDollars(savings)}</strong>
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {showSavings && (
        <Modal onClose={() => setShowSavings(false)} maxWidth={420} maxHeight="75vh">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-display text-lg font-semibold text-porch-text">Estimated Savings</span>
          </div>
          <p className="mb-3.5 text-[13px] text-porch-text-secondary">What doing it yourself saved you, fix by fix.</p>
          {items.map((item) => {
            const savings = savingsFor(item);
            return (
              <div key={`${item.section.slug}-${item.issueIndex}`} className="flex items-center justify-between gap-3 border-t border-[#ECE0D8] py-3">
                <span className="text-sm leading-snug text-porch-text">{item.issue.title}</span>
                <span className="shrink-0 text-[14.5px] font-semibold text-porch-accent">
                  {savings !== null ? `~${formatDollars(savings)}` : "—"}
                </span>
              </div>
            );
          })}
        </Modal>
      )}
    </div>
  );
}
