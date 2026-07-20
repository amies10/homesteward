"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  sections,
  normalize,
  mergeReports,
  issueKey,
  slugify,
  parseMidpoint,
  type Issue,
  type ReportSection,
  type StoredReport,
  type CompletionRecord,
  type MergedIssueRef,
  type PropertyDetails,
} from "@/lib/sections";
import {
  loadReports,
  loadCompletions,
  loadIgnored,
  loadUserProfile,
  loadAllMyCompletions,
  loadAllIssueDetailsForUser,
  updateReportSections,
  markReportLocationUsed,
  ensureBaseReport,
} from "@/lib/data";
import { supabase } from "@/lib/supabase-client";
import { loadUserTasks, loadAllLogs, countDueOrOverdue } from "@/lib/maintenance";
import { loadPropertyDetails } from "@/lib/property";
import { loadToolbox } from "@/lib/toolbox";
import { findReadyFixes } from "@/lib/toolbox-match";
import { propertyContextLines } from "@/lib/ai-context";
import { computeAgingInsights, type AgingInsight } from "@/lib/insights";
import Logo from "@/app/components/Logo";
import Modal from "@/app/components/Modal";
import { PageSkeleton } from "@/app/components/Skeleton";
import EstimateDisclaimer from "@/app/components/EstimateDisclaimer";
import ChatFAB from "@/app/components/ChatFAB";
import AgingCallout from "@/app/components/AgingCallout";
import SectionIcon from "@/app/components/SectionIcon";
import RefreshEstimatesBanner from "@/app/components/RefreshEstimatesBanner";
import { shareText } from "@/lib/share";
import { CalendarIcon, ChevronRightIcon, PlusIcon, SearchIcon, SettingsIcon, ShareIcon, UploadIcon, XIcon } from "@/app/components/icons";

const SEVERITY_ORDER: Record<Issue["severity"], number> = {
  safety: 0, repair: 1, maintenance: 2, improvement: 3, fyi: 4,
};

export const SEVERITY_STYLE: Record<Issue["severity"], { badge: string; label: string }> = {
  safety: { badge: "bg-red-100 text-red-700", label: "Safety" },
  repair: { badge: "bg-orange-100 text-orange-700", label: "Repair" },
  maintenance: { badge: "bg-amber-100 text-amber-700", label: "Maintenance" },
  improvement: { badge: "bg-blue-100 text-blue-700", label: "Improvement" },
  fyi: { badge: "bg-stone-100 text-stone-500", label: "FYI" },
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

// "104 Evergreen Ct, Frederick, MD 21701" -> "104 Evergreen Ct"
function streetAddress(fullAddress: string): string {
  return fullAddress.split(",")[0].trim();
}

function formatDollars(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

export default function Dashboard() {
  const router = useRouter();
  const [profileChecked, setProfileChecked] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [skillLevel, setSkillLevel] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<"owner" | "renter" | "prebuy">("owner");
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [completions, setCompletions] = useState<Record<string, CompletionRecord>>({});
  const [ignored, setIgnored] = useState<Record<string, true>>({});
  const [error, setError] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [addingSectionLoading, setAddingSectionLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [refreshingEstimates, setRefreshingEstimates] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<string | null>(null);
  const [maintenanceDueCount, setMaintenanceDueCount] = useState(0);
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails | null>(null);
  const [toolboxNames, setToolboxNames] = useState<string[]>([]);
  const [myCompletions, setMyCompletions] = useState<CompletionRecord[]>([]);
  const [issueDetailsRows, setIssueDetailsRows] = useState<
    Awaited<ReturnType<typeof loadAllIssueDetailsForUser>>
  >([]);

  useEffect(() => {
    loadUserProfile().then((profile) => {
      if (!profile?.onboardingCompleted) {
        router.replace("/onboarding");
        return;
      }
      setProfileChecked(true);
      setLocation(profile.location ?? null);
      setAddress(profile.address ?? null);
      setSkillLevel(profile.skillLevel ?? null);
      setAccountType(profile.accountType ?? "owner");
      Promise.all([
        loadReports(),
        loadCompletions(),
        loadIgnored(),
        loadPropertyDetails(),
        loadToolbox(),
        loadAllMyCompletions(),
        loadAllIssueDetailsForUser(),
      ]).then(([loadedReports, completions, ignored, property, toolboxItems, allMyCompletions, detailsRows]) => {
        setReports(loadedReports);
        setReportsLoaded(true);
        setCompletions(completions);
        setIgnored(ignored);
        setPropertyDetails(property);
        setToolboxNames(toolboxItems.map((t) => t.toolName));
        setMyCompletions(allMyCompletions);
        setIssueDetailsRows(detailsRows);
      });
      Promise.all([loadUserTasks(), loadAllLogs()])
        .then(([tasks, logs]) => setMaintenanceDueCount(countDueOrOverdue(tasks, logs)))
        .catch(() => {});
    });
  }, [router]);

  const mergedSections = mergeReports(reports);

  // All non-deleted merged issues, paired with the section slug they live in
  // (needed alongside reportId/issueIndex to build a stable issueKey/link).
  const allTrackedEntries: Array<{ ref: MergedIssueRef; slug: string }> = mergedSections.flatMap((s) =>
    s.issues.filter((ref) => !ref.issue.deleted).map((ref) => ({ ref, slug: s.slug }))
  );
  // Open = not deleted, not completed, not ignored.
  const openIssueEntries = allTrackedEntries.filter(({ ref, slug }) => {
    const key = issueKey(ref.reportId, slug, ref.issueIndex);
    return !completions[key] && !ignored[key];
  });
  const totalTrackedIssues = allTrackedEntries.length;
  const handledIssuesCount = totalTrackedIssues - openIssueEntries.length;

  const readyFixCount = findReadyFixes(
    toolboxNames,
    issueDetailsRows,
    openIssueEntries.map(({ ref, slug }) => ({ ...ref, slug }))
  ).length;

  // Open issues grouped by their (display) section name, for the global
  // assistant chat's home-overview context.
  const openIssuesForChat = openIssueEntries.map(({ ref, slug }) => ({
    section: mergedSections.find((s) => s.slug === slug)?.name ?? slug,
    title: ref.issue.title,
    severity: ref.issue.severity,
  }));

  function lookupIssueInReports(repId: string, issueSlug: string, idx: number): Issue | undefined {
    const rpt = reports.find((rp) => rp.id === repId);
    const cfg = sections.find((sc) => sc.slug === issueSlug);
    const sec = rpt?.sections.find(
      (s) => s.slug === issueSlug || (cfg && normalize(s.name) === normalize(cfg.label))
    );
    return sec?.issues[idx];
  }

  const completedSummary = myCompletions.length
    ? {
        total: myCompletions.length,
        byMe: myCompletions.filter((c) => c.completedBy === "me").length,
        recent: [...myCompletions]
          .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
          .slice(0, 3)
          .map((c) => lookupIssueInReports(c.reportId, c.slug, c.issueIndex)?.title)
          .filter((t): t is string => !!t),
      }
    : undefined;

  const propertyContext = propertyContextLines(propertyDetails);

  const agingInsights: AgingInsight[] = computeAgingInsights(
    propertyDetails,
    mergedSections.flatMap((s) => s.issues.filter((ref) => !ref.issue.deleted).map((ref) => ref.issue))
  );

  function activeIssuesFor(slug: string): Issue[] {
    const section = mergedSections.find((s) => s.slug === slug);
    if (!section) return [];
    return section.issues
      .filter((ref) => !ref.issue.deleted)
      .filter((ref) => {
        const key = issueKey(ref.reportId, slug, ref.issueIndex);
        return !completions[key] && !ignored[key];
      })
      .map((ref) => ref.issue);
  }

  function matchingIssueCount(slug: string, query: string): number {
    const section = mergedSections.find((s) => s.slug === slug);
    if (!section) return 0;
    const q = query.toLowerCase();
    return section.issues.filter(
      (ref) =>
        !ref.issue.deleted &&
        (ref.issue.title.toLowerCase().includes(q) || ref.issue.description.toLowerCase().includes(q))
    ).length;
  }

  function navigateToSection(slug: string) {
    if (selectedSlug) return;
    setSelectedSlug(slug);
    const href = `/section/${slug}${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`;
    setTimeout(() => router.push(href), 150);
  }

  async function handleAddSection() {
    if (!newSectionName.trim()) return;
    setAddingSectionLoading(true);
    try {
      const base = await ensureBaseReport();
      const name = newSectionName.trim();
      const slugBase = slugify(name);
      const taken = new Set([...sections.map((s) => s.slug), ...mergedSections.map((s) => s.slug)]);
      let slug = slugBase;
      let n = 2;
      while (taken.has(slug)) { slug = `${slugBase}-${n}`; n++; }

      const newSection: ReportSection = {
        name,
        description: newSectionDesc.trim() || undefined,
        slug,
        userAdded: true,
        issues: [],
      };
      const targetReport = reports.find((r) => r.id === base.id) ?? base;
      await updateReportSections(base.id, [...targetReport.sections, newSection]);
      setReports(await loadReports());
    } finally {
      setShowAddSection(false);
      setNewSectionName("");
      setNewSectionDesc("");
      setAddingSectionLoading(false);
    }
  }

  async function handleRefreshEstimates() {
    if (!reports.length || !location) return;
    setRefreshingEstimates(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const reportsNeedingRefresh = reports.filter(
        (r) => r.locationUsed !== location && r.sections.some((s) => s.issues.length > 0)
      );

      for (let ri = 0; ri < reportsNeedingRefresh.length; ri++) {
        const rpt = reportsNeedingRefresh[ri];
        const workingSections = rpt.sections.map((s) => ({ ...s, issues: [...s.issues] }));

        for (let si = 0; si < workingSections.length; si++) {
          const section = workingSections[si];
          if (!section.issues.length) continue;
          setRefreshProgress(
            reportsNeedingRefresh.length > 1
              ? `Report ${ri + 1} of ${reportsNeedingRefresh.length}, section ${si + 1} of ${workingSections.length}…`
              : `Section ${si + 1} of ${workingSections.length}…`
          );

          const res = await fetch("/api/refresh-estimates", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              issues: section.issues.map((issue) => ({
                title: issue.title,
                description: issue.description,
                severity: issue.severity,
                recommendedAction: issue.recommendedAction,
                costEstimateDIY: issue.costEstimateDIY,
                costEstimatePro: issue.costEstimatePro,
              })),
              location,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || "Failed to refresh estimates");

          const estimates = json.estimates as Array<{
            costEstimateDIY: string | null;
            costEstimatePro: string | null;
          }>;
          section.issues = section.issues.map((issue, i) => ({
            ...issue,
            costEstimateDIY: estimates[i]?.costEstimateDIY ?? issue.costEstimateDIY,
            costEstimatePro: estimates[i]?.costEstimatePro ?? issue.costEstimatePro,
          }));
        }

        await updateReportSections(rpt.id, workingSections);
        await markReportLocationUsed(rpt.id, location);
      }

      setReports(await loadReports());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh estimates");
    } finally {
      setRefreshingEstimates(false);
      setRefreshProgress(null);
    }
  }

  const allSectionRows = [
    ...sections.map((section) => ({
      slug: section.slug,
      name: mergedSections.find((s) => s.slug === section.slug)?.name ?? section.label,
      desc: section.description,
      custom: false,
    })),
    ...mergedSections
      .filter((s) => !sections.some((std) => std.slug === s.slug))
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        desc: s.description ?? "Custom section",
        custom: true,
      })),
  ];

  const searchQuery = search.trim();
  const visibleSectionRows = searchQuery
    ? allSectionRows
        .map((row) => ({ ...row, matchCount: matchingIssueCount(row.slug, searchQuery) }))
        .filter((row) => row.matchCount > 0)
    : allSectionRows.map((row) => ({ ...row, matchCount: 0 }));

  const needsLocationRefresh = reports.some(
    (r) => !r.locationUsed && r.sections.some((s) => s.issues.length > 0)
  );

  if (!profileChecked || !reportsLoaded) return <PageSkeleton />;

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-[90px] text-porch-text">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-porch-border bg-porch-surface px-5 py-4">
        <Logo size={34} wordmarkSize={20} />
        <div className="flex items-center gap-2.5">
          <Link
            href="/completed"
            className="btn-press rounded-[8px] py-2.5 px-2 text-[13px] font-semibold text-porch-text-secondary no-underline"
          >
            Completed Fixes
          </Link>
          <Link href="/settings" aria-label="Settings" className="flex items-center justify-center p-1.5">
            <SettingsIcon size={22} />
          </Link>
        </div>
      </header>

      {error && (
        <div className="px-5 pt-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {reports.length === 0 ? (
        <div className="mx-5 mt-10 rounded-2xl border border-porch-border bg-porch-surface px-6 py-14 text-center shadow-[0_1px_2px_rgba(38,34,32,0.03)]">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-porch-accent-tint">
            <UploadIcon size={26} color="#7D234A" />
          </div>
          <p className="font-display text-[20px] font-semibold text-porch-text">Upload your first report</p>
          <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-porch-text-secondary">
            Inspection reports, contractor estimates, or punch lists — upload one to start tracking your home.
          </p>
          <Link
            href="/report"
            className="btn-press mt-6 inline-flex items-center justify-center gap-2 rounded-[10px] bg-porch-accent px-6 py-3 text-sm font-semibold text-white no-underline"
          >
            <UploadIcon size={16} color="#FFFFFF" />
            Upload a Report
          </Link>
        </div>
      ) : (
        <>
          <div className="px-5 pb-1 pt-6">
            <div className="rounded-2xl border border-porch-border bg-porch-surface p-5 shadow-[0_1px_2px_rgba(38,34,32,0.03)]">
              <div className="mb-0.5 text-[15px] text-[#6B5F55]">
                {accountType === "prebuy" ? "Evaluating this home" : greeting()}
              </div>
              <div className="font-display text-[22px] font-semibold text-porch-text">
                {address ? streetAddress(address) : "Your Home"}
              </div>
              {totalTrackedIssues > 0 && (
                <div className="mt-3.5">
                  <div className="mb-1.5 text-[12.5px] font-medium text-porch-text-secondary">
                    {handledIssuesCount} of {totalTrackedIssues} issue{totalTrackedIssues !== 1 ? "s" : ""}{" "}
                    {accountType === "prebuy" ? "reviewed" : "handled"}
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-porch-border">
                    <div
                      className="h-full rounded-full bg-porch-accent"
                      style={{ width: `${Math.round((handledIssuesCount / totalTrackedIssues) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="mt-4 flex gap-2.5">
                <button
                  onClick={() => setShowSummaryModal(true)}
                  className="btn-press flex-1 rounded-[10px] border border-porch-border-input bg-porch-surface py-[11px] text-sm font-medium text-porch-text"
                >
                  View summary
                </button>
                <Link
                  href="/add-issue"
                  className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border-none bg-porch-accent py-[11px] text-sm font-medium text-white no-underline"
                >
                  <PlusIcon size={15} color="#FFFFFF" strokeWidth={2} />
                  Log a fix or upgrade
                </Link>
              </div>
            </div>
          </div>

          {accountType === "prebuy" && (
            <div className="px-5 pb-1 pt-3.5">
              <Link
                href="/credit-request"
                className="btn-press flex items-center justify-between gap-2.5 rounded-2xl border border-porch-accent bg-porch-accent-tint px-4 py-4 text-inherit no-underline"
              >
                <span className="text-[14.5px] font-semibold text-porch-accent">
                  Generate Seller Credit Request →
                </span>
                <ChevronRightIcon size={16} color="#7D234A" />
              </Link>
            </div>
          )}

          <div className="px-5 pb-1 pt-3.5">
            <Link
              href="/maintenance"
              className="btn-press flex w-full items-center gap-3.5 rounded-2xl border border-porch-border bg-porch-surface px-4 py-4 text-inherit no-underline shadow-[0_1px_2px_rgba(38,34,32,0.03)]"
            >
              <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-porch-accent-tint">
                <CalendarIcon />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15.5px] font-semibold text-porch-text">Maintenance Calendar</div>
                <div className="mt-0.5 text-[13px] text-porch-text-secondary">Routine upkeep, on schedule</div>
              </div>
              {maintenanceDueCount > 0 && (
                <span className="shrink-0 rounded-full bg-porch-urgent px-2.5 py-1 text-xs font-semibold text-white">
                  {maintenanceDueCount}
                </span>
              )}
              <ChevronRightIcon size={16} />
            </Link>
          </div>

          {agingInsights.length > 0 && (
            <div className="px-5 pb-1 pt-3.5">
              <AgingCallout insights={agingInsights} />
            </div>
          )}

          {readyFixCount > 0 && (
            <div className="px-5 pb-1 pt-3.5">
              <Link
                href="/toolbox"
                className="btn-press flex items-center gap-2.5 rounded-2xl border border-porch-success-border bg-porch-success-bg px-4 py-3.5 text-inherit no-underline"
              >
                <span aria-hidden="true" className="text-base leading-none">🧰</span>
                <span className="min-w-0 flex-1 text-[13.5px] font-medium text-porch-success">
                  You own the tools for {readyFixCount} open fix{readyFixCount !== 1 ? "es" : ""} — view them
                </span>
                <ChevronRightIcon size={15} />
              </Link>
            </div>
          )}

          <div className="flex items-center justify-between gap-2.5 px-5 pb-2.5 pt-7">
            <div className="font-display text-xl font-semibold text-porch-text">What are we working on?</div>
            <div className="flex shrink-0 items-center gap-3.5">
              <Link
                href="/plan"
                className="btn-press flex items-center gap-1 rounded-[6px] py-1 text-[13.5px] font-semibold text-porch-accent no-underline"
              >
                View action plan →
              </Link>
              <button
                onClick={() => setShowAddSection(true)}
                className="btn-press flex items-center gap-1.5 border-none bg-transparent p-0 text-[13.5px] font-semibold text-porch-accent"
              >
                <PlusIcon />
                Add Section
              </button>
            </div>
          </div>

          <div className="px-5 pb-1">
            <div className="flex items-center gap-2 rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-2.5">
              <SearchIcon size={15} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search issues..."
                className="flex-1 border-none bg-transparent text-sm text-porch-text outline-none placeholder:text-porch-text-tertiary"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="flex items-center p-0.5 text-porch-text-tertiary"
                >
                  <XIcon size={14} color="#A99C8B" />
                </button>
              )}
            </div>
          </div>

          {needsLocationRefresh && location && (
            <RefreshEstimatesBanner
              onRefresh={handleRefreshEstimates}
              refreshing={refreshingEstimates}
              progress={refreshProgress}
            />
          )}

          {searchQuery && visibleSectionRows.length === 0 ? (
            <div className="mx-5 mt-2 rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
              <p className="text-sm text-porch-text-secondary">No issues match &quot;{searchQuery}&quot;.</p>
            </div>
          ) : (
            visibleSectionRows.map((row) => {
              const activeIssues = activeIssuesFor(row.slug);
              const urgent = activeIssues.some((i) => i.severity === "safety");
              const selected = selectedSlug === row.slug;
              return (
                <div key={row.slug} className="px-5 py-1.5">
                  <a
                    href={`/section/${row.slug}${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateToSection(row.slug);
                    }}
                    className="relative flex w-full items-center gap-3.5 rounded-2xl border border-porch-border bg-porch-surface px-4 py-4 text-inherit no-underline shadow-[0_1px_2px_rgba(38,34,32,0.03)]"
                  >
                    {selected && <div className="comet-ring" />}
                    <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[11px] bg-porch-accent-tint">
                      <SectionIcon slug={row.slug} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[15.5px] font-semibold text-porch-text">{row.name}</span>
                        {urgent && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-porch-urgent">
                            <span className="sr-only">has a safety issue</span>
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-porch-text-secondary">
                        {row.desc}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {searchQuery && (
                        <span className="whitespace-nowrap rounded-full bg-porch-accent-tint px-2.5 py-1 text-xs font-semibold text-porch-accent">
                          {row.matchCount} match{row.matchCount !== 1 ? "es" : ""}
                        </span>
                      )}
                      {activeIssues.length > 0 ? (
                        <span className="whitespace-nowrap text-[12.5px] font-semibold text-porch-text-secondary">
                          {activeIssues.length} open
                        </span>
                      ) : (
                        <span className="whitespace-nowrap text-[12.5px] font-semibold text-porch-success">
                          All clear ✓
                        </span>
                      )}
                      <ChevronRightIcon size={16} />
                    </div>
                  </a>
                </div>
              );
            })
          )}
        </>
      )}

      {showAddSection && (
        <Modal onClose={() => setShowAddSection(false)}>
          <div className="mb-4 font-display text-lg font-semibold text-porch-text">New Section of the House</div>
          <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Section of House</label>
          <input
            type="text"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddSection(); }}
            placeholder="e.g. Detached Garage"
            autoFocus
            className="mb-3.5 w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
          />
          <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Description</label>
          <input
            type="text"
            value={newSectionDesc}
            onChange={(e) => setNewSectionDesc(e.target.value)}
            placeholder="What's covered here?"
            className="mb-[18px] w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAddSection(false); setNewSectionName(""); setNewSectionDesc(""); }}
              className="btn-press flex-1 rounded-[10px] border border-porch-border-input bg-porch-surface py-2.5 text-sm font-semibold text-porch-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSection}
              disabled={!newSectionName.trim() || addingSectionLoading}
              className="btn-press flex-1 rounded-[10px] border-none bg-porch-accent py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addingSectionLoading ? "Adding…" : "Add Section"}
            </button>
          </div>
        </Modal>
      )}

      {showSummaryModal && reports.length > 0 && (() => {
        const allIssues = mergedSections.flatMap((s) => s.issues.map((ref) => ref.issue));
        const severityCounts = { safety: 0, repair: 0, maintenance: 0, improvement: 0, fyi: 0 } as Record<Issue["severity"], number>;
        for (const issue of allIssues) severityCounts[issue.severity]++;

        let diyTotal = 0;
        let proTotal = 0;
        for (const { ref } of openIssueEntries) {
          const diy = parseMidpoint(ref.issue.costEstimateDIY);
          const pro = parseMidpoint(ref.issue.costEstimatePro);
          if (diy !== null) diyTotal += diy;
          if (pro !== null) proTotal += pro;
        }

        const top3 = [...openIssueEntries]
          .sort((a, b) => SEVERITY_ORDER[a.ref.issue.severity] - SEVERITY_ORDER[b.ref.issue.severity])
          .slice(0, 3);

        async function handleShareSummary() {
          const addr = reports[0]?.propertyAddress ? streetAddress(reports[0].propertyAddress) : "Your Home";
          const sevLine = (["safety", "repair", "maintenance", "improvement", "fyi"] as const)
            .map((sev) => `${severityCounts[sev]} ${sev === "fyi" ? "FYI" : sev}`)
            .join(", ");
          const topLines = top3
            .map(({ ref }, i) => `${i + 1}. ${ref.issue.title} (${SEVERITY_STYLE[ref.issue.severity].label})`)
            .join("\n");
          const text = [
            `${addr} — Home report summary (Porchlight)`,
            `${allIssues.length} issues across ${mergedSections.length} sections: ${sevLine}`,
            ...(topLines ? ["", "Top priorities:", topLines] : []),
            "",
            `Estimated open repair costs: DIY ${diyTotal > 0 ? `~${formatDollars(diyTotal)}` : "—"} / Professional ${
              proTotal > 0 ? `~${formatDollars(proTotal)}` : "—"
            } (estimates vary)`,
          ].join("\n");
          try {
            const result = await shareText("Home report summary", text);
            if (result === "copied") {
              setSummaryCopied(true);
              setTimeout(() => setSummaryCopied(false), 2200);
            }
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") return;
          }
        }

        return (
          <Modal onClose={() => setShowSummaryModal(false)} maxWidth={400} maxHeight="75vh">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="font-display text-lg font-semibold text-porch-text">Inspection Summary</span>
            </div>
            {reports[0]?.propertyAddress && (
              <p className="mb-3 text-sm text-porch-text-secondary">{reports[0].propertyAddress}</p>
            )}
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-[10px] bg-porch-bg px-4 py-3">
                <p className="font-display text-2xl font-semibold text-porch-text">{allIssues.length}</p>
                <p className="mt-0.5 text-xs text-porch-text-secondary">Total issues</p>
              </div>
              <div className="rounded-[10px] bg-porch-bg px-4 py-3">
                <p className="font-display text-2xl font-semibold text-porch-text">{mergedSections.length}</p>
                <p className="mt-0.5 text-xs text-porch-text-secondary">Sections affected</p>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["safety", "repair", "maintenance", "improvement", "fyi"] as const).map((sev) => {
                const count = severityCounts[sev];
                if (!count) return null;
                const style = SEVERITY_STYLE[sev];
                return (
                  <span key={sev} className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}>
                    {count} {style.label}
                  </span>
                );
              })}
            </div>
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-[10px] bg-porch-bg px-4 py-3">
                <p className="font-display text-xl font-semibold text-porch-text">
                  {diyTotal > 0 ? `~${formatDollars(diyTotal)}` : "—"}
                </p>
                <p className="mt-0.5 text-xs text-porch-text-secondary">DIY total</p>
              </div>
              <div className="rounded-[10px] bg-porch-bg px-4 py-3">
                <p className="font-display text-xl font-semibold text-porch-text">
                  {proTotal > 0 ? `~${formatDollars(proTotal)}` : "—"}
                </p>
                <p className="mt-0.5 text-xs text-porch-text-secondary">Pro total</p>
              </div>
            </div>
            <EstimateDisclaimer />
            {top3.length > 0 && (
              <div className="mb-5 mt-4 border-t border-[#ECE0D8] pt-4">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-porch-text-tertiary">
                  Top Priority Issues
                </p>
                <ul className="space-y-2.5">
                  {top3.map(({ ref, slug }, i) => {
                    const style = SEVERITY_STYLE[ref.issue.severity];
                    return (
                      <li key={i}>
                        <Link
                          href={`/section/${slug}/issue/${ref.issueIndex}?r=${ref.reportId}`}
                          onClick={() => setShowSummaryModal(false)}
                          className="btn-press flex items-start justify-between gap-3 rounded-[8px] py-1 text-inherit no-underline"
                        >
                          <span className="text-sm leading-snug text-porch-text">{ref.issue.title}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                            {style.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <Link
              href="/plan"
              onClick={() => setShowSummaryModal(false)}
              className="btn-press mb-2.5 flex w-full items-center justify-center rounded-[10px] border border-porch-border-input bg-porch-surface py-3 text-sm font-semibold text-porch-text no-underline"
            >
              View action plan →
            </Link>
            {accountType === "owner" && (
              <Link
                href="/credit-request"
                onClick={() => setShowSummaryModal(false)}
                className="btn-press mb-3.5 block text-center text-[13px] font-medium text-porch-accent underline underline-offset-2"
              >
                Preparing a repair addendum? Generate a seller credit request
              </Link>
            )}
            <button
              onClick={handleShareSummary}
              className="btn-press mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-porch-border-input bg-porch-surface py-3 text-sm font-semibold text-porch-text"
            >
              <ShareIcon size={14} />
              {summaryCopied ? "Copied ✓" : "Share summary"}
            </button>
            <button
              onClick={() => setShowSummaryModal(false)}
              className="btn-press w-full rounded-[10px] border-none bg-porch-accent py-3 text-sm font-semibold text-white"
            >
              View My Home
            </button>
          </Modal>
        );
      })()}

      <ChatFAB
        scope="global"
        storageKey="global"
        title="Ask Porchlight"
        placeholder="Ask about your home..."
        emptyStateText="Ask about anything in your home — your report, a past fix, or what to tackle next."
        context={{
          skillLevel: skillLevel ?? undefined,
          location: location ?? undefined,
          sections: allSectionRows.map((row) => ({
            name: row.name,
            issueCount: activeIssuesFor(row.slug).length,
          })),
          propertyContext: propertyContext || undefined,
          toolbox: toolboxNames,
          openIssues: openIssuesForChat,
          completedSummary,
        }}
        suggestedPrompts={[
          "What should I tackle first?",
          "What's my biggest safety risk?",
          "What can I DIY with my skill level?",
          "How's my home doing overall?",
        ]}
      />
    </div>
  );
}
