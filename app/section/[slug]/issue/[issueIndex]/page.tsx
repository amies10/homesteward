"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownProse from "@/app/components/MarkdownProse";
import MicButton from "@/app/components/MicButton";
import {
  sections,
  normalize,
  SKILL_RANK,
  contractorsKey,
  type ParsedReport,
  type Issue,
  type IssueDetails,
  type CompletionRecord,
  type UserProfile,
  type ContractorResult,
} from "@/lib/sections";
import {
  loadLatestReport,
  loadCompletions,
  loadUserProfile,
  loadIssueDetails,
  saveIssueDetails,
  saveCompletion,
  updateReport,
} from "@/lib/data";

const SEVERITY: Record<Issue["severity"], { badge: string; label: string }> = {
  safety:      { badge: "bg-red-100 text-red-700",      label: "Safety" },
  repair:      { badge: "bg-orange-100 text-orange-700", label: "Repair" },
  maintenance: { badge: "bg-amber-100 text-amber-700",   label: "Maintenance" },
  improvement: { badge: "bg-blue-100 text-blue-700",     label: "Improvement" },
  fyi:         { badge: "bg-stone-100 text-stone-500",   label: "FYI" },
};

export default function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; issueIndex: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const router = useRouter();
  const { slug, issueIndex } = use(params);
  const { from } = use(searchParams);
  const index = parseInt(issueIndex, 10);
  const sectionConfig = sections.find((s) => s.slug === slug);

  const [report, setReport] = useState<ParsedReport | null>(null);
  const [userSkillLevel, setUserSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [issueDetails, setIssueDetails] = useState<IssueDetails | null>(null);
  const [contractors, setContractors] = useState<ContractorResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [diyUnlocked, setDiyUnlocked] = useState(false);
  const [generatingDiy, setGeneratingDiy] = useState(false);
  const [diyError, setDiyError] = useState<string | null>(null);
  const [generatingExpert, setGeneratingExpert] = useState(false);
  const [expertError, setExpertError] = useState<string | null>(null);
  const [contractorType, setContractorType] = useState<string | null>(null);

  const [showRefineBriefingModal, setShowRefineBriefingModal] = useState(false);
  const [refineBriefingFeedback, setRefineBriefingFeedback] = useState("");
  const [refiningBriefing, setRefiningBriefing] = useState(false);
  const [refineBriefingError, setRefineBriefingError] = useState<string | null>(null);

  const [observationExpanded, setObservationExpanded] = useState(false);
  const [observationDraft, setObservationDraft] = useState("");
  const [polishingObservation, setPolishingObservation] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);

  const [showRegenDiyModal, setShowRegenDiyModal] = useState(false);
  const [showRegenExpertModal, setShowRegenExpertModal] = useState(false);
  const [regenDiyLoading, setRegenDiyLoading] = useState(false);
  const [regenExpertLoading, setRegenExpertLoading] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [completedBy, setCompletedBy] = useState<"me" | "professional" | null>(null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  // Move to section
  const [moveTarget, setMoveTarget] = useState("");
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    Promise.all([
      loadLatestReport(),
      loadCompletions(),
      loadUserProfile(),
      loadIssueDetails(slug, index),
    ]).then(([r, completions, profile, details]) => {
      if (r) setReport(r);
      if (completions[`${slug}-${index}`]) setSaved(true);
      if (profile) {
        setUserSkillLevel(profile.skillLevel);
        if (profile.location) setUserLocation(profile.location);
      }
      if (details) setIssueDetails(details);
      setLoaded(true);
    });

    try {
      const stored = localStorage.getItem(contractorsKey(slug, index));
      if (stored) {
        const parsed = JSON.parse(stored) as { contractors: ContractorResult[]; contractorType: string };
        setContractors(parsed.contractors ?? []);
        setContractorType(parsed.contractorType ?? null);
      }
    } catch {}
  }, [slug, index]);

  // Derived section + issue
  const reportSection = report?.sections.find(
    (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
  );
  const sectionDisplayName = reportSection?.name ?? sectionConfig?.label ?? slug;
  const issue = reportSection?.issues[index];

  if (!sectionConfig && !loaded) return null;

  if (loaded && !reportSection && !sectionConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-500">Section not found.</p>
      </div>
    );
  }

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

  // All sections we can move to (exclude current)
  const moveTargetOptions: Array<{ slug: string; label: string }> = [
    ...sections
      .filter((s) => s.slug !== slug)
      .map((s) => ({ slug: s.slug, label: s.label })),
    ...(report?.sections
      .filter((s) => s.userAdded && s.slug && s.slug !== slug)
      .map((s) => ({ slug: s.slug!, label: s.name })) ?? []),
  ];

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
          userObservation: issueDetails?.userObservation,
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
      const expertFetch = fetch("/api/generate-expert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueTitle: issue.title,
          issueDescription: issue.description,
          severity: issue.severity,
          recommendedAction: issue.recommendedAction,
          equipmentSpecs: issue.equipmentSpecs,
          costEstimatePro: issue.costEstimatePro,
          userObservation: issueDetails?.userObservation,
        }),
      });

      const contractorFetch = userLocation
        ? fetch("/api/find-contractors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              issueTitle: issue.title,
              issueSectionSlug: slug,
              userLocation,
            }),
          })
        : null;

      const [expertRes, contractorRes] = await Promise.all([expertFetch, contractorFetch]);

      const expertData = await expertRes.json();
      if (!expertRes.ok) throw new Error(expertData.error || "Generation failed");

      const updated: IssueDetails = {
        ...issueDetails,
        contractorBriefing: expertData.contractorBriefing,
      };
      setIssueDetails(updated);
      await saveIssueDetails(slug, index, updated);

      if (contractorRes) {
        const contractorData = await contractorRes.json();
        if (contractorRes.ok && contractorData.contractors) {
          setContractors(contractorData.contractors);
          setContractorType(contractorData.contractorType ?? null);
          localStorage.setItem(
            contractorsKey(slug, index),
            JSON.stringify({ contractors: contractorData.contractors, contractorType: contractorData.contractorType })
          );
        }
      }
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

  async function handleRefineBriefing() {
    if (!refineBriefingFeedback.trim() || !issue || !issueDetails?.contractorBriefing) return;
    setRefiningBriefing(true);
    setRefineBriefingError(null);
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
          feedback: refineBriefingFeedback.trim(),
          existingBriefing: issueDetails.contractorBriefing,
          userObservation: issueDetails?.userObservation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refinement failed");
      const updated: IssueDetails = { ...issueDetails, contractorBriefing: data.contractorBriefing };
      setIssueDetails(updated);
      await saveIssueDetails(slug, index, updated);
      setShowRefineBriefingModal(false);
      setRefineBriefingFeedback("");
    } catch (err) {
      setRefineBriefingError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefiningBriefing(false);
    }
  }

  async function handlePolishObservation() {
    if (!observationDraft.trim() || !issue) return;
    setPolishingObservation(true);
    setPolishError(null);
    try {
      const res = await fetch("/api/refine-observation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawObservation: observationDraft.trim(),
          issueTitle: issue.title,
          issueDescription: issue.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Polish failed");
      const updated: IssueDetails = {
        ...issueDetails,
        userObservation: data.observation,
      };
      setIssueDetails(updated);
      await saveIssueDetails(slug, index, updated);
      setObservationExpanded(false);
      setObservationDraft("");

      const hasPlan = !!(issueDetails?.materialsList?.length || issueDetails?.stepByStepPlan?.length);
      const hasBriefing = !!issueDetails?.contractorBriefing;
      if (hasPlan) {
        setRegenError(null);
        setShowRegenDiyModal(true);
      } else if (hasBriefing) {
        setRegenError(null);
        setShowRegenExpertModal(true);
      }
    } catch (err) {
      setPolishError(err instanceof Error ? err.message : "Polish failed");
    } finally {
      setPolishingObservation(false);
    }
  }

  function advanceToExpertModal() {
    setShowRegenDiyModal(false);
    const hasBriefing = !!issueDetails?.contractorBriefing;
    if (hasBriefing) {
      setRegenError(null);
      setShowRegenExpertModal(true);
    }
  }

  async function handleRegenDiy() {
    if (!issue || !issueDetails) return;
    setRegenDiyLoading(true);
    setRegenError(null);
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
          userObservation: issueDetails.userObservation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");
      const updated: IssueDetails = {
        ...issueDetails,
        materialsList: data.materialsList,
        stepByStepPlan: data.stepByStepPlan,
      };
      setIssueDetails(updated);
      await saveIssueDetails(slug, index, updated);
      advanceToExpertModal();
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenDiyLoading(false);
    }
  }

  async function handleRegenExpert() {
    if (!issue || !issueDetails) return;
    setRegenExpertLoading(true);
    setRegenError(null);
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
          userObservation: issueDetails.userObservation,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");
      const updated: IssueDetails = { ...issueDetails, contractorBriefing: data.contractorBriefing };
      setIssueDetails(updated);
      await saveIssueDetails(slug, index, updated);
      setShowRegenExpertModal(false);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenExpertLoading(false);
    }
  }

  async function handleMoveIssue() {
    if (!moveTarget || !report || !issue) return;
    setMoving(true);
    const newReport: ParsedReport = JSON.parse(JSON.stringify(report));

    // Soft-delete source
    const srcIdx = newReport.sections.findIndex(
      (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
    );
    if (srcIdx !== -1) {
      newReport.sections[srcIdx].issues[index] = {
        ...newReport.sections[srcIdx].issues[index],
        deleted: true,
      };
    }

    // Push copy to target
    const targetConfig = sections.find((s) => s.slug === moveTarget);
    const dstIdx = newReport.sections.findIndex(
      (s) =>
        s.slug === moveTarget ||
        (targetConfig && normalize(s.name) === normalize(targetConfig.label))
    );
    const issueCopy: Issue = { ...issue, deleted: undefined };
    let newIssueIndex: number;
    if (dstIdx === -1) {
      newReport.sections.push({
        name: targetConfig?.label ?? moveTarget,
        slug: moveTarget,
        issues: [issueCopy],
      });
      newIssueIndex = 0;
    } else {
      newReport.sections[dstIdx].issues.push(issueCopy);
      newIssueIndex = newReport.sections[dstIdx].issues.length - 1;
    }

    await updateReport(newReport);
    router.push(`/section/${moveTarget}/issue/${newIssueIndex}`);
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
              ← {from === "completed" ? "Completed Fixes" : sectionDisplayName}
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
        {/* Inspection notes */}
        <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
            Inspection Notes
          </p>
          <p className="text-sm leading-relaxed text-stone-700">{issue.description}</p>
          {issue.notes && (
            <p className="mt-3 text-xs italic leading-relaxed text-stone-400">
              Note: {issue.notes}
            </p>
          )}
        </div>

        {/* Your observations */}
        <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
            Your Observations
          </p>
          <p className="mb-3 text-xs leading-relaxed text-stone-500">
            Describe what you&apos;re actually seeing in your own words. Mention any brands, models, or details not captured in the inspection notes. Don&apos;t worry about being precise — just say it all and we&apos;ll take care of the rest.
          </p>

          {issueDetails?.userObservation && !observationExpanded ? (
            <div>
              <p className="text-sm leading-relaxed text-stone-700">
                {issueDetails.userObservation}
              </p>
              <button
                onClick={() => {
                  setObservationDraft(issueDetails.userObservation ?? "");
                  setObservationExpanded(true);
                }}
                className="mt-2 text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600"
              >
                Edit
              </button>
            </div>
          ) : observationExpanded ? (
            <div className="space-y-3">
              <textarea
                value={observationDraft}
                onChange={(e) => setObservationDraft(e.target.value)}
                placeholder=""
                rows={4}
                autoFocus
                className="w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
              />
              <div className="flex items-center justify-between gap-2">
                <MicButton
                  onTranscript={(t) =>
                    setObservationDraft((prev) => (prev ? `${prev} ${t}` : t))
                  }
                  disabled={polishingObservation}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setObservationExpanded(false);
                      setObservationDraft("");
                      setPolishError(null);
                    }}
                    disabled={polishingObservation}
                    className="text-xs text-stone-400 hover:text-stone-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePolishObservation}
                    disabled={!observationDraft.trim() || polishingObservation}
                    className="rounded-md border border-stone-800 bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {polishingObservation ? "Saving…" : "Polish & Save"}
                  </button>
                </div>
              </div>
              {polishError && (
                <p className="text-xs text-red-600">{polishError}</p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setObservationExpanded(true)}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              + Add your observations
            </button>
          )}
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
                <MarkdownProse text={issueDetails!.contractorBriefing!} />
                <button
                  onClick={() => { setShowRefineBriefingModal(true); setRefineBriefingError(null); }}
                  className="mt-1 text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600"
                >
                  Refine This Briefing
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed text-stone-500">
                  Get a contractor briefing with questions to ask, red flags to watch for, and what a proper repair looks like.
                </p>
                {!userLocation && (
                  <p className="text-xs text-stone-400">
                    Add your location in{" "}
                    <a href="/settings" className="underline underline-offset-2 hover:text-stone-600">
                      Settings
                    </a>{" "}
                    to also find local contractors.
                  </p>
                )}
                {expertError && (
                  <p className="text-xs text-red-600">{expertError}</p>
                )}
                <button
                  onClick={handleGenerateExpert}
                  disabled={generatingExpert}
                  className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingExpert
                    ? "Generating…"
                    : userLocation
                    ? "Get Expert Guide & Find Contractors"
                    : "Get Expert Guide"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Local contractors */}
        {contractors.length > 0 && (
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <p className="text-sm font-semibold text-stone-900">Local Contractors</p>
              {contractorType && (
                <span className="text-xs text-stone-400 capitalize">{contractorType}</span>
              )}
            </div>
            <div className="space-y-3">
              {contractors.map((c, i) => (
                <div
                  key={i}
                  className="rounded-md border border-stone-100 bg-stone-50 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-900">{c.name}</p>
                      <p className="mt-0.5 text-xs text-stone-500">{c.address}</p>
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="mt-0.5 block text-xs text-stone-600 hover:text-stone-900"
                        >
                          {c.phone}
                        </a>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {c.rating !== undefined && (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-sm font-medium text-stone-800">
                            {c.rating.toFixed(1)}
                          </span>
                          <span className="text-amber-400">★</span>
                          {c.reviewCount !== undefined && (
                            <span className="text-xs text-stone-400">({c.reviewCount.toLocaleString()})</span>
                          )}
                        </div>
                      )}
                      <a
                        href={c.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 block text-xs text-stone-500 underline underline-offset-2 hover:text-stone-700"
                      >
                        View on Google Maps
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Move to section */}
        {!saved && moveTargetOptions.length > 0 && (
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-stone-400">
              Move to Section
            </p>
            <div className="flex items-center gap-3">
              <select
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
              >
                <option value="">Select a section…</option>
                {moveTargetOptions.map((opt) => (
                  <option key={opt.slug} value={opt.slug}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleMoveIssue}
                disabled={!moveTarget || moving}
                className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {moving ? "Moving…" : "Move"}
              </button>
            </div>
          </div>
        )}

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

      {showRefineBriefingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white shadow-lg">
            <div className="border-b border-stone-100 px-6 py-4">
              <p className="text-sm font-semibold text-stone-900">Refine This Briefing</p>
              <p className="mt-0.5 text-xs text-stone-400">
                Add more details about what you&apos;re seeing to get a more accurate briefing.
              </p>
            </div>
            <div className="px-6 py-5">
              <textarea
                value={refineBriefingFeedback}
                onChange={(e) => setRefineBriefingFeedback(e.target.value)}
                placeholder="e.g. The issue is more severe than described — there's visible water damage around the area. I'm in an older home built in 1965. The contractor mentioned it may involve asbestos."
                rows={5}
                autoFocus
                className="w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span />
                <MicButton
                  onTranscript={(t) => setRefineBriefingFeedback((prev) => prev ? `${prev} ${t}` : t)}
                  disabled={refiningBriefing}
                />
              </div>
              {refineBriefingError && (
                <p className="mt-1 text-xs text-red-600">{refineBriefingError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-4">
              <button
                onClick={() => { setShowRefineBriefingModal(false); setRefineBriefingFeedback(""); setRefineBriefingError(null); }}
                disabled={refiningBriefing}
                className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRefineBriefing}
                disabled={!refineBriefingFeedback.trim() || refiningBriefing}
                className="rounded-md border border-stone-800 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refiningBriefing ? "Regenerating…" : "Regenerate Briefing"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegenDiyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white shadow-lg">
            <div className="px-6 py-5">
              <p className="text-sm font-semibold text-stone-900">
                Regenerate DIY Plan?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                You already have a DIY plan for this issue. Would you like to regenerate it using your new observations?
              </p>
              {regenError && (
                <p className="mt-3 text-xs text-red-600">{regenError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-4">
              <button
                onClick={advanceToExpertModal}
                disabled={regenDiyLoading}
                className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
              >
                Keep Existing Plan
              </button>
              <button
                onClick={handleRegenDiy}
                disabled={regenDiyLoading}
                className="rounded-md border border-stone-800 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {regenDiyLoading ? "Regenerating…" : "Yes, Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRegenExpertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white shadow-lg">
            <div className="px-6 py-5">
              <p className="text-sm font-semibold text-stone-900">
                Regenerate Contractor Briefing?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">
                Would you like to regenerate your contractor briefing with these new observations?
              </p>
              {regenError && (
                <p className="mt-3 text-xs text-red-600">{regenError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-4">
              <button
                onClick={() => setShowRegenExpertModal(false)}
                disabled={regenExpertLoading}
                className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
              >
                Keep Existing
              </button>
              <button
                onClick={handleRegenExpert}
                disabled={regenExpertLoading}
                className="rounded-md border border-stone-800 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {regenExpertLoading ? "Regenerating…" : "Yes, Regenerate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
