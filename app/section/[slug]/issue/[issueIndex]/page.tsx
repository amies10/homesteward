"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  sections,
  normalize,
  SKILL_RANK,
  type ParsedReport,
  type Issue,
  type IssueDetails,
  type CompletionRecord,
  type UserProfile,
} from "@/lib/sections";
import {
  loadLatestReport,
  loadCompletions,
  loadUserProfile,
  loadIssueDetails,
  saveIssueDetails,
  saveCompletion,
} from "@/lib/data";

const SEVERITY: Record<Issue["severity"], { badge: string; label: string }> = {
  safety: { badge: "bg-red-100 text-red-700", label: "Safety" },
  repair: { badge: "bg-orange-100 text-orange-700", label: "Repair" },
  maintenance: { badge: "bg-amber-100 text-amber-700", label: "Maintenance" },
  improvement: { badge: "bg-blue-100 text-blue-700", label: "Improvement" },
  fyi: { badge: "bg-stone-100 text-stone-500", label: "FYI" },
};

export default function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; issueIndex: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { slug, issueIndex } = use(params);
  const { from } = use(searchParams);
  const index = parseInt(issueIndex, 10);
  const section = sections.find((s) => s.slug === slug);

  const [report, setReport] = useState<ParsedReport | null>(null);
  const [userSkillLevel, setUserSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [issueDetails, setIssueDetails] = useState<IssueDetails | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [diyUnlocked, setDiyUnlocked] = useState(false);
  const [generatingDiy, setGeneratingDiy] = useState(false);
  const [diyError, setDiyError] = useState<string | null>(null);
  const [generatingExpert, setGeneratingExpert] = useState(false);
  const [expertError, setExpertError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [completedBy, setCompletedBy] = useState<"me" | "professional" | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      loadLatestReport(),
      loadCompletions(),
      loadUserProfile(),
      loadIssueDetails(slug, index),
    ]).then(([report, completions, profile, details]) => {
      if (report) setReport(report);
      if (completions[`${slug}-${index}`]) setSaved(true);
      if (profile) setUserSkillLevel(profile.skillLevel);
      if (details) setIssueDetails(details);
      setLoaded(true);
    });
  }, [slug, index]);

  if (!section) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-500">Section not found.</p>
      </div>
    );
  }

  const reportSection = report?.sections.find(
    (s) => normalize(s.name) === normalize(section.label)
  );
  const issue = reportSection?.issues[index];

  if (loaded && !issue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-500">Issue not found.</p>
      </div>
    );
  }

  if (!issue) return null;

  const style = SEVERITY[issue.severity] ?? SEVERITY.fyi;

  const isProOnly = !issue.costEstimateDIY;
  const hasSkillMismatch =
    !isProOnly &&
    !!userSkillLevel &&
    !!issue.minimumSkillLevel &&
    SKILL_RANK[userSkillLevel] < SKILL_RANK[issue.minimumSkillLevel];
  const withinSkill =
    !isProOnly &&
    !!userSkillLevel &&
    !!issue.minimumSkillLevel &&
    SKILL_RANK[userSkillLevel] >= SKILL_RANK[issue.minimumSkillLevel];
  const showDiyWarning = (isProOnly || hasSkillMismatch) && !diyUnlocked;

  const hasDiyPlan = !!(issueDetails?.materialsList?.length || issueDetails?.stepByStepPlan?.length);
  const hasExpertGuide = !!issueDetails?.contractorBriefing;

  async function handleGenerateDiy() {
    if (!issue) return;
    setGeneratingDiy(true);
    setDiyError(null);
    try {
      const res = await fetch("/api/generate-diy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueTitle: issue.title,
          issueDescription: issue.description,
          severity: issue.severity,
          recommendedAction: issue.recommendedAction,
          equipmentSpecs: issue.equipmentSpecs,
          costEstimateDIY: issue.costEstimateDIY,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const updated: IssueDetails = {
        ...issueDetails,
        materialsList: data.materialsList,
        stepByStepPlan: data.stepByStepPlan,
      };
      setIssueDetails(updated);
      await saveIssueDetails(slug, index, updated);
    } catch (err) {
      setDiyError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setGeneratingDiy(false);
    }
  }

  async function handleGenerateExpert() {
    if (!issue) return;
    setGeneratingExpert(true);
    setExpertError(null);
    try {
      const res = await fetch("/api/generate-expert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueTitle: issue.title,
          issueDescription: issue.description,
          severity: issue.severity,
          recommendedAction: issue.recommendedAction,
          equipmentSpecs: issue.equipmentSpecs,
          costEstimatePro: issue.costEstimatePro,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const updated: IssueDetails = {
        ...issueDetails,
        contractorBriefing: data.contractorBriefing,
      };
      setIssueDetails(updated);
      await saveIssueDetails(slug, index, updated);
    } catch (err) {
      setExpertError(err instanceof Error ? err.message : "Failed to generate guide");
    } finally {
      setGeneratingExpert(false);
    }
  }

  async function handleSave() {
    if (!completedBy) return;
    const record: CompletionRecord = {
      slug,
      issueIndex: index,
      completedBy,
      ...(completedBy === "me" && difficulty ? { difficulty } : {}),
      completedAt: new Date().toISOString(),
    };
    await saveCompletion(record);
    setSaved(true);
    setShowForm(false);
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center gap-4">
            <Link
              href={from === "completed" ? "/completed" : `/section/${slug}`}
              className="shrink-0 text-sm text-stone-400 transition-colors hover:text-stone-600"
            >
              ← {from === "completed" ? "Completed Fixes" : section.label}
            </Link>
            <div className="h-4 w-px bg-stone-200" />
            <div className="flex min-w-0 items-center gap-3">
              <h1 className="truncate text-xl font-semibold tracking-tight text-stone-900">
                {issue.title}
              </h1>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                {style.label}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-6 py-10">
        {/* Description */}
        <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
            Description
          </p>
          <p className="text-sm leading-relaxed text-stone-700">{issue.description}</p>
        </div>

        {/* Cost option cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* DIY card */}
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Fix It Yourself
              </p>
              {withinSkill && (
                <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  Within your skill level
                </span>
              )}
            </div>
            <p className="mb-3 text-2xl font-semibold tracking-tight text-stone-900">
              {issue.costEstimateDIY ?? "—"}
            </p>

            {showDiyWarning ? (
              <div className="space-y-3">
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
                  {isProOnly
                    ? "This repair is typically recommended for a licensed professional. Proceeding yourself carries risk."
                    : "This repair typically requires more experience than your current level. We recommend calling a professional."}
                </p>
                <button
                  onClick={() => setDiyUnlocked(true)}
                  className="text-xs text-stone-500 underline underline-offset-2 hover:text-stone-700"
                >
                  I understand, show me anyway
                </button>
              </div>
            ) : hasDiyPlan ? (
              <div className="space-y-2">
                <p className="text-xs text-stone-500">
                  ✓ DIY plan ready —{" "}
                  {issueDetails?.materialsList?.length ?? 0} materials,{" "}
                  {issueDetails?.stepByStepPlan?.length ?? 0} steps
                </p>
                <Link
                  href={`/section/${slug}/issue/${index}/diy`}
                  className="inline-block rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
                >
                  View Full Walkthrough →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-stone-500">
                  Generate a detailed materials list and step-by-step repair plan.
                </p>
                {diyError && (
                  <p className="text-xs text-red-600">{diyError}</p>
                )}
                <button
                  onClick={handleGenerateDiy}
                  disabled={generatingDiy}
                  className="rounded-md border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingDiy ? "Generating…" : "Generate DIY Plan"}
                </button>
              </div>
            )}
          </div>

          {/* Expert card */}
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-400">
              Call an Expert
            </p>
            <p className="mb-3 text-2xl font-semibold tracking-tight text-stone-900">
              {issue.costEstimatePro ?? "—"}
            </p>

            {hasExpertGuide ? (
              <div className="space-y-3">
                <p className="text-xs font-medium text-stone-700">Contractor Briefing</p>
                <p className="text-xs leading-relaxed text-stone-600 whitespace-pre-line">
                  {issueDetails!.contractorBriefing}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-stone-500">
                  Get a contractor briefing with questions to ask, red flags to watch for, and what a proper repair looks like.
                </p>
                {expertError && (
                  <p className="text-xs text-red-600">{expertError}</p>
                )}
                <button
                  onClick={handleGenerateExpert}
                  disabled={generatingExpert}
                  className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingExpert ? "Generating…" : "Get Expert Guide"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mark as complete */}
        <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
          {saved ? (
            <p className="text-sm text-stone-500">✓ Marked as complete.</p>
          ) : !showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              Mark as Complete
            </button>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-900">Who fixed this?</p>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "me", label: "Me" },
                      { value: "professional", label: "A Professional" },
                    ] as const
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => {
                        setCompletedBy(value);
                        setDifficulty(null);
                      }}
                      className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                        completedBy === value
                          ? "border-stone-800 bg-stone-900 text-white"
                          : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {completedBy === "me" && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-stone-900">How difficult was it?</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setDifficulty(n)}
                        className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                          difficulty === n
                            ? "border-stone-800 bg-stone-900 text-white"
                            : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-stone-400">1 = Easy, 5 = Very Difficult</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!completedBy || (completedBy === "me" && difficulty === null)}
                  className="rounded-md border border-stone-800 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setCompletedBy(null);
                    setDifficulty(null);
                  }}
                  className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
