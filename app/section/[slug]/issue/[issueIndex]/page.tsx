"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarkdownProse from "@/app/components/MarkdownProse";
import MicButton from "@/app/components/MicButton";
import Modal from "@/app/components/Modal";
import { PageSkeleton } from "@/app/components/Skeleton";
import { useProgressiveStatus } from "@/app/components/useProgressiveStatus";
import EstimateDisclaimer from "@/app/components/EstimateDisclaimer";
import ChatFAB from "@/app/components/ChatFAB";
import LevelUpModal from "@/app/components/LevelUpModal";
import ContractorContactModal from "@/app/components/ContractorContactModal";
import ShareFixCard from "@/app/components/ShareFixCard";
import { ChevronDownIcon, ChevronLeftIcon, SettingsIcon, ShareIcon } from "@/app/components/icons";
import HomeButton from "@/app/components/HomeButton";
import CalendarButton from "@/app/components/CalendarButton";
import { shareText } from "@/lib/share";
import {
  sections,
  normalize,
  mergeReports,
  issueKey,
  savingsFor,
  SKILL_RANK,
  contractorsKey,
  type StoredReport,
  type Issue,
  type IssueDetails,
  type CompletionRecord,
  type UserProfile,
  type ContractorResult,
  type SkillLevel,
} from "@/lib/sections";
import {
  loadReports,
  loadCompletions,
  loadUserProfile,
  loadAllMyCompletions,
  loadIssueDetails,
  saveIssueDetails,
  saveCompletion,
  removeCompletion,
  updateCompletionContractor,
  updateReportSections,
  moveIssueDetails,
} from "@/lib/data";
import { computeEffectiveSkill } from "@/lib/skill";
import { loadToolbox, addTools, isToolHeuristic } from "@/lib/toolbox";
import { loadPropertyDetails } from "@/lib/property";
import { propertyContextLines } from "@/lib/ai-context";
import ToolSuggestSheet from "@/app/components/ToolSuggestSheet";
import PhotoGallery from "@/app/components/PhotoGallery";
import { uploadIssuePhoto, removePaths, signPaths } from "@/lib/storage";
import { supabase } from "@/lib/supabase-client";

const TYPE_LABEL: Record<Issue["severity"], string> = {
  safety: "Safety",
  repair: "Repair",
  maintenance: "Maintenance",
  improvement: "Improvement",
  fyi: "FYI",
};

export default function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; issueIndex: string }>;
  searchParams: Promise<{ from?: string; r?: string }>;
}) {
  const router = useRouter();
  const { slug, issueIndex } = use(params);
  const { from, r } = use(searchParams);
  const index = parseInt(issueIndex, 10);
  const sectionConfig = sections.find((s) => s.slug === slug);

  const [reports, setReports] = useState<StoredReport[]>([]);
  const [reportId, setReportId] = useState<string | null>(null);
  const [userSkillLevel, setUserSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [userAccountType, setUserAccountType] = useState<UserProfile["accountType"] | null>(null);
  const [effectiveSkillLevel, setEffectiveSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [issueDetails, setIssueDetails] = useState<IssueDetails | null>(null);
  const [contractors, setContractors] = useState<ContractorResult[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [myCompletions, setMyCompletions] = useState<CompletionRecord[]>([]);
  const [showLevelUp, setShowLevelUp] = useState<SkillLevel | null>(null);

  const [diyUnlocked, setDiyUnlocked] = useState(false);
  const [generatingDiy, setGeneratingDiy] = useState(false);
  const [diyError, setDiyError] = useState<string | null>(null);
  const [generatingExpert, setGeneratingExpert] = useState(false);
  const [expertError, setExpertError] = useState<string | null>(null);
  const [contractorType, setContractorType] = useState<string | null>(null);
  const [contactModalContractor, setContactModalContractor] = useState<ContractorResult | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(true);

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
  const [actualCost, setActualCost] = useState("");
  const [saved, setSaved] = useState(false);
  const [completionRecord, setCompletionRecord] = useState<CompletionRecord | null>(null);
  const [showShareFix, setShowShareFix] = useState(false);
  const [briefingCopied, setBriefingCopied] = useState(false);

  const [moveTarget, setMoveTarget] = useState("");
  const [moving, setMoving] = useState(false);

  const [suggestedTools, setSuggestedTools] = useState<string[]>([]);
  const [ownedTools, setOwnedTools] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [propertyContext, setPropertyContext] = useState("");

  const diyStatus = useProgressiveStatus(generatingDiy, [
    ["Generating…", 0],
    ["Sizing steps to your skill level…", 4000],
    ["Pricing materials…", 9000],
  ]);
  const expertStatus = useProgressiveStatus(generatingExpert, [
    ["Generating…", 0],
    ["Writing your contractor briefing…", 4000],
    ["Finding local pros…", 9000],
  ]);

  useEffect(() => {
    loadReports().then((loadedReports) => {
      setReports(loadedReports);
      const resolvedReportId = r ?? loadedReports[0]?.id ?? null;
      setReportId(resolvedReportId);

      if (!resolvedReportId) {
        setLoaded(true);
        return;
      }

      Promise.all([
        loadCompletions(),
        loadUserProfile(),
        loadIssueDetails(resolvedReportId, slug, index),
        loadAllMyCompletions(),
      ]).then(([completions, profile, details, myCompletions]) => {
        const existingCompletion = completions[issueKey(resolvedReportId, slug, index)];
        if (existingCompletion) {
          setSaved(true);
          setCompletedBy(existingCompletion.completedBy);
          setCompletionRecord(existingCompletion);
        }
        setMyCompletions(myCompletions);
        if (profile) {
          setUserSkillLevel(profile.skillLevel);
          setUserAccountType(profile.accountType ?? "owner");
          if (profile.location) setUserLocation(profile.location);
          const lookupIssue = (repId: string, issueSlug: string, idx: number) => {
            const rpt = loadedReports.find((rp) => rp.id === repId);
            const cfg = sections.find((sc) => sc.slug === issueSlug);
            const sec = rpt?.sections.find(
              (s) => s.slug === issueSlug || (cfg && normalize(s.name) === normalize(cfg.label))
            );
            return sec?.issues[idx];
          };
          setEffectiveSkillLevel(computeEffectiveSkill(profile.skillLevel, myCompletions, lookupIssue).effective);
        }
        if (details) setIssueDetails(details);
        setLoaded(true);
      });

      try {
        const stored = localStorage.getItem(contractorsKey(resolvedReportId, slug, index));
        if (stored) {
          const parsed = JSON.parse(stored) as { contractors: ContractorResult[]; contractorType: string };
          setContractors(parsed.contractors ?? []);
          setContractorType(parsed.contractorType ?? null);
        }
      } catch {}
    });

    loadToolbox().then((tools) => setOwnedTools(tools.map((t) => t.toolName)));
    loadPropertyDetails().then((property) => setPropertyContext(propertyContextLines(property)));
  }, [slug, index, r]);

  const reportForIssue = reports.find((rp) => rp.id === reportId);
  const reportSection = reportForIssue?.sections.find(
    (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
  );
  const sectionDisplayName = reportSection?.name ?? sectionConfig?.label ?? slug;
  const issue = reportSection?.issues[index];

  if (!sectionConfig && !loaded) return <PageSkeleton />;

  if (loaded && !reportSection && !sectionConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-porch-bg">
        <p className="text-sm text-porch-text-secondary">Section not found.</p>
      </div>
    );
  }

  if (loaded && !issue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-porch-bg">
        <p className="text-sm text-porch-text-secondary">Issue not found.</p>
      </div>
    );
  }

  if (!issue) return <PageSkeleton />;

  const isProOnly = !issue.costEstimateDIY;
  const hasSkillMismatch =
    !isProOnly &&
    !!effectiveSkillLevel &&
    !!issue.minimumSkillLevel &&
    SKILL_RANK[effectiveSkillLevel] < SKILL_RANK[issue.minimumSkillLevel];
  const withinSkill =
    !isProOnly &&
    !!effectiveSkillLevel &&
    !!issue.minimumSkillLevel &&
    SKILL_RANK[effectiveSkillLevel] >= SKILL_RANK[issue.minimumSkillLevel];
  const showDiyWarning = (isProOnly || hasSkillMismatch) && !diyUnlocked;
  const bypassedDiyWarning = (isProOnly || hasSkillMismatch) && diyUnlocked;

  const hasDiyPlan = !!(issueDetails?.materialsList?.length || issueDetails?.stepByStepPlan?.length);
  const hasExpertGuide = !!issueDetails?.contractorBriefing;

  const mergedSections = mergeReports(reports);
  const moveTargetOptions: Array<{ slug: string; label: string }> = [
    ...sections.filter((s) => s.slug !== slug).map((s) => ({ slug: s.slug, label: s.label })),
    ...mergedSections
      .filter((s) => !sections.some((std) => std.slug === s.slug) && s.slug !== slug)
      .map((s) => ({ slug: s.slug, label: s.name })),
  ];

  async function handleAddPhoto(file: File) {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user.id;
    if (!reportId || !userId) return;

    setUploadingPhoto(true);
    const path = await uploadIssuePhoto(userId, reportId, slug, index, file);
    if (path) {
      const updated: IssueDetails = {
        ...issueDetails,
        photoPaths: [...(issueDetails?.photoPaths ?? []), path],
      };
      setIssueDetails(updated);
      await saveIssueDetails(reportId, slug, index, updated);
    }
    setUploadingPhoto(false);
  }

  async function handleRemovePhoto(path: string) {
    if (!reportId) return;
    const updated: IssueDetails = {
      ...issueDetails,
      photoPaths: (issueDetails?.photoPaths ?? []).filter((p) => p !== path),
    };
    setIssueDetails(updated);
    await saveIssueDetails(reportId, slug, index, updated);
    await removePaths([path]);
  }

  async function handleGenerateDiy() {
    if (!issue || !reportId) return;
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
          skillLevel: effectiveSkillLevel ?? undefined,
          ownedTools: ownedTools.length ? ownedTools : undefined,
          photoUrls: issueDetails?.photoPaths?.length
            ? Object.values(await signPaths(issueDetails.photoPaths))
            : undefined,
          location: userLocation ?? undefined,
          propertyContext: propertyContext || undefined,
          sectionSlug: slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      const updated: IssueDetails = {
        ...issueDetails,
        materialsList: data.materialsList,
        stepByStepPlan: data.stepByStepPlan,
        safetyWarning: data.safetyWarning ?? null,
      };
      setIssueDetails(updated);
      await saveIssueDetails(reportId, slug, index, updated);
    } catch (err) {
      setDiyError(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setGeneratingDiy(false);
    }
  }

  async function handleGenerateExpert() {
    if (!issue || !reportId) return;
    setGeneratingExpert(true);
    setExpertError(null);
    try {
      const expertPhotoUrls = issueDetails?.photoPaths?.length
        ? Object.values(await signPaths(issueDetails.photoPaths))
        : undefined;

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
          photoUrls: expertPhotoUrls,
          location: userLocation ?? undefined,
          propertyContext: propertyContext || undefined,
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
      await saveIssueDetails(reportId, slug, index, updated);

      if (contractorRes) {
        const contractorData = await contractorRes.json();
        if (contractorRes.ok && contractorData.contractors) {
          setContractors(contractorData.contractors);
          setContractorType(contractorData.contractorType ?? null);
          localStorage.setItem(
            contractorsKey(reportId, slug, index),
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

  function lookupIssueInReports(repId: string, issueSlug: string, idx: number): Issue | undefined {
    const rpt = reports.find((rp) => rp.id === repId);
    const cfg = sections.find((sc) => sc.slug === issueSlug);
    const sec = rpt?.sections.find(
      (s) => s.slug === issueSlug || (cfg && normalize(s.name) === normalize(cfg.label))
    );
    return sec?.issues[idx];
  }

  async function handleSave() {
    if (!completedBy || !reportId) return;
    const parsedCost = actualCost.trim() ? parseFloat(actualCost) : NaN;
    const record: CompletionRecord = {
      slug,
      issueIndex: index,
      reportId,
      completedBy,
      ...(completedBy === "me" && difficulty ? { difficulty } : {}),
      completedAt: new Date().toISOString(),
      ...(actualCost.trim() && !isNaN(parsedCost) ? { actualCost: parsedCost } : {}),
    };

    const before = userSkillLevel
      ? computeEffectiveSkill(userSkillLevel, myCompletions, lookupIssueInReports)
      : null;

    await saveCompletion(record);
    setSaved(true);
    setCompletionRecord(record);
    setShowForm(false);

    if (before && userSkillLevel) {
      const updatedCompletions = completedBy === "me" ? [...myCompletions, record] : myCompletions;
      const after = computeEffectiveSkill(userSkillLevel, updatedCompletions, lookupIssueInReports);
      if (completedBy === "me") setMyCompletions(updatedCompletions);
      if (SKILL_RANK[after.effective] > SKILL_RANK[before.effective]) setShowLevelUp(after.effective);
    }

    if (completedBy === "me" && issueDetails?.materialsList?.length) {
      const owned = new Set((await loadToolbox()).map((t) => t.toolName.toLowerCase()));
      const suggestions = issueDetails.materialsList
        .filter((m) => (m.isTool ?? isToolHeuristic(m.item)) && !owned.has(m.item.toLowerCase()))
        .map((m) => m.item);
      if (suggestions.length) setSuggestedTools(suggestions);
    }
  }

  async function handleMarkOpen() {
    if (!reportId) return;
    await removeCompletion(reportId, slug, index);
    setSaved(false);
    setCompletedBy(null);
    setDifficulty(null);
    setActualCost("");
    setCompletionRecord(null);
  }

  async function handleShareBriefing() {
    if (!issue || !issueDetails?.contractorBriefing) return;
    const briefingLines = issueDetails.contractorBriefing.split("\n").map((line) => {
      const heading = line.match(/^###\s+(.*)$/);
      return heading ? heading[1].toUpperCase() : line;
    });
    const text = [
      issue.title,
      sectionDisplayName,
      "",
      briefingLines.join("\n"),
      "",
      "— Prepared with Porchlight (homesteward-tau.vercel.app)",
    ].join("\n");
    try {
      const result = await shareText("Contractor Briefing", text);
      if (result === "copied") {
        setBriefingCopied(true);
        setTimeout(() => setBriefingCopied(false), 2200);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  async function handleRefineBriefing() {
    if (!refineBriefingFeedback.trim() || !issue || !issueDetails?.contractorBriefing || !reportId) return;
    setRefiningBriefing(true);
    setRefineBriefingError(null);
    try {
      const photoUrls = issueDetails?.photoPaths?.length
        ? Object.values(await signPaths(issueDetails.photoPaths))
        : undefined;
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
          photoUrls,
          location: userLocation ?? undefined,
          propertyContext: propertyContext || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refinement failed");
      const updated: IssueDetails = { ...issueDetails, contractorBriefing: data.contractorBriefing };
      setIssueDetails(updated);
      await saveIssueDetails(reportId, slug, index, updated);
      setShowRefineBriefingModal(false);
      setRefineBriefingFeedback("");
    } catch (err) {
      setRefineBriefingError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefiningBriefing(false);
    }
  }

  // Shared tail for both "Polish & save" and "Save as-is" — closes the editor
  // and, if a DIY plan and/or expert briefing already exist, chains into the
  // regenerate-with-new-observations modal flow.
  function afterObservationSaved() {
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
  }

  async function handlePolishObservation() {
    if (!observationDraft.trim() || !issue || !reportId) return;
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
      await saveIssueDetails(reportId, slug, index, updated);
      afterObservationSaved();
    } catch (err) {
      setPolishError(err instanceof Error ? err.message : "Polish failed");
    } finally {
      setPolishingObservation(false);
    }
  }

  async function handleSaveObservationAsIs() {
    if (!observationDraft.trim() || !reportId) return;
    const updated: IssueDetails = {
      ...issueDetails,
      userObservation: observationDraft.trim(),
    };
    setIssueDetails(updated);
    await saveIssueDetails(reportId, slug, index, updated);
    afterObservationSaved();
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
    if (!issue || !issueDetails || !reportId) return;
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
          skillLevel: effectiveSkillLevel ?? undefined,
          ownedTools: ownedTools.length ? ownedTools : undefined,
          photoUrls: issueDetails?.photoPaths?.length
            ? Object.values(await signPaths(issueDetails.photoPaths))
            : undefined,
          location: userLocation ?? undefined,
          propertyContext: propertyContext || undefined,
          sectionSlug: slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");
      const updated: IssueDetails = {
        ...issueDetails,
        materialsList: data.materialsList,
        stepByStepPlan: data.stepByStepPlan,
        safetyWarning: data.safetyWarning ?? null,
      };
      setIssueDetails(updated);
      await saveIssueDetails(reportId, slug, index, updated);
      advanceToExpertModal();
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenDiyLoading(false);
    }
  }

  async function handleRegenExpert() {
    if (!issue || !issueDetails || !reportId) return;
    setRegenExpertLoading(true);
    setRegenError(null);
    try {
      const photoUrls = issueDetails?.photoPaths?.length
        ? Object.values(await signPaths(issueDetails.photoPaths))
        : undefined;
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
          photoUrls,
          location: userLocation ?? undefined,
          propertyContext: propertyContext || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Regeneration failed");
      const updated: IssueDetails = { ...issueDetails, contractorBriefing: data.contractorBriefing };
      setIssueDetails(updated);
      await saveIssueDetails(reportId, slug, index, updated);
      setShowRegenExpertModal(false);
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenExpertLoading(false);
    }
  }

  async function handleMoveIssue() {
    if (!moveTarget || !reportForIssue || !issue || !reportId) return;
    setMoving(true);
    const newSections = reportForIssue.sections.map((s) => ({ ...s, issues: [...s.issues] }));

    const srcIdx = newSections.findIndex(
      (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
    );
    if (srcIdx !== -1) {
      newSections[srcIdx].issues[index] = {
        ...newSections[srcIdx].issues[index],
        deleted: true,
      };
    }

    const targetConfig = sections.find((s) => s.slug === moveTarget);
    const dstIdx = newSections.findIndex(
      (s) =>
        s.slug === moveTarget ||
        (targetConfig && normalize(s.name) === normalize(targetConfig.label))
    );
    const issueCopy: Issue = { ...issue, deleted: undefined };
    let newIssueIndex: number;
    if (dstIdx === -1) {
      newSections.push({
        name: targetConfig?.label ?? moveTarget,
        slug: moveTarget,
        issues: [issueCopy],
      });
      newIssueIndex = 0;
    } else {
      newSections[dstIdx].issues.push(issueCopy);
      newIssueIndex = newSections[dstIdx].issues.length - 1;
    }

    await updateReportSections(reportId, newSections);
    await moveIssueDetails(reportId, slug, index, moveTarget, newIssueIndex);
    router.push(`/section/${moveTarget}/issue/${newIssueIndex}?r=${reportId}`);
  }

  // D4: records a hired pro either against an existing completion, or (if the
  // issue isn't marked complete yet) stashes it in localStorage for
  // saveCompletion to pick up once it is — see lib/data.ts's hiredStashKey.
  async function handleRecordHire(contractor: ContractorResult) {
    if (!reportId) return;
    const hired: CompletionRecord["hiredContractor"] = {
      name: contractor.name,
      phone: contractor.phone,
      website: contractor.website,
      mapsUrl: contractor.mapsUrl,
    };
    if (saved) {
      await updateCompletionContractor(reportId, slug, index, hired);
    } else {
      try {
        localStorage.setItem(`homesteward_hired_${issueKey(reportId, slug, index)}`, JSON.stringify(hired));
      } catch {}
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-[90px] text-porch-text">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-porch-border bg-porch-surface px-5 py-[18px]">
        <Link
          href={from === "completed" ? "/completed" : `/section/${slug}`}
          className="flex min-w-0 items-center gap-1.5 text-[14px] text-porch-text-secondary no-underline"
        >
          <ChevronLeftIcon />
          <span className="truncate">{from === "completed" ? "Completed Fixes" : sectionDisplayName}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <CalendarButton />
          <HomeButton />
          <Link href="/settings" aria-label="Settings" className="flex items-center justify-center p-1">
            <SettingsIcon />
          </Link>
        </div>
      </header>

      <div className="px-5 pb-1.5 pt-[22px]">
        <div className="flex flex-wrap items-start gap-2.5">
          <span className="font-display text-[23px] font-semibold leading-tight text-porch-text">{issue.title}</span>
          <span className="shrink-0 rounded-full border border-porch-border bg-porch-surface px-2.5 py-[3px] text-xs font-medium text-[#6B5F55]">
            {TYPE_LABEL[issue.severity]}
          </span>
        </div>
      </div>

      <main className="space-y-2.5 px-5 pt-2.5">
        {/* Inspection notes */}
        <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">Inspection notes</p>
          {issue.photoBase64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={issue.photoBase64} alt="" className="mt-2.5 max-h-48 rounded-xl object-cover" />
          )}
          <p className="mt-2 text-[14px] leading-relaxed text-[#3A3532]">{issue.description}</p>
          {issue.notes && (
            <p className="mt-3 text-xs italic leading-relaxed text-porch-text-tertiary">Note: {issue.notes}</p>
          )}
        </div>

        {/* Photos */}
        <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">Photos</p>
          <div className="mt-2.5">
            <PhotoGallery
              paths={issueDetails?.photoPaths ?? []}
              onAdd={handleAddPhoto}
              onRemove={handleRemovePhoto}
              uploading={uploadingPhoto}
            />
          </div>
        </div>

        {/* Your observations */}
        <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">Your observations</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-porch-text-secondary">
            Tell us what you&apos;re actually seeing, in your own words — brand, model, anything the report missed.
            No need to be precise, we&apos;ll sort it out.
          </p>

          {issueDetails?.userObservation && !observationExpanded ? (
            <div className="mt-3 border-t border-[#F2EBE1] pt-3">
              <p className="text-[14px] leading-relaxed text-[#3A3532]">{issueDetails.userObservation}</p>
              <button
                onClick={() => {
                  setObservationDraft(issueDetails.userObservation ?? "");
                  setObservationExpanded(true);
                }}
                className="btn-press mt-2 rounded-[8px] px-3 py-2.5 text-[12.5px] font-semibold text-porch-text-tertiary underline underline-offset-2"
              >
                Edit
              </button>
            </div>
          ) : observationExpanded ? (
            <div className="mt-2.5">
              <textarea
                value={observationDraft}
                onChange={(e) => setObservationDraft(e.target.value)}
                placeholder="e.g. it's the mechanical kind, not a push-button..."
                rows={4}
                autoFocus
                className="w-full resize-y rounded-[10px] border border-porch-border-input bg-porch-bg px-3 py-2.5 text-sm leading-relaxed text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
              />
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <MicButton
                  onTranscript={(t) => setObservationDraft((prev) => (prev ? `${prev} ${t}` : t))}
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
                    className="btn-press rounded-[8px] px-3 py-2.5 text-[12.5px] font-semibold text-porch-text-tertiary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveObservationAsIs}
                    disabled={!observationDraft.trim() || polishingObservation}
                    className="btn-press rounded-[8px] border border-porch-border-input bg-transparent px-4 py-2 text-[13.5px] font-semibold text-porch-text disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save as-is
                  </button>
                  <button
                    onClick={handlePolishObservation}
                    disabled={!observationDraft.trim() || polishingObservation}
                    className="btn-press rounded-[8px] border-none bg-porch-accent px-4 py-2 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {polishingObservation ? "Saving…" : "Polish & save"}
                  </button>
                </div>
              </div>
              {polishError && <p className="mt-1.5 text-xs text-red-600">{polishError}</p>}
            </div>
          ) : (
            <button
              onClick={() => setObservationExpanded(true)}
              className="btn-press mt-2.5 flex items-center gap-1.5 border-none bg-transparent p-0 text-[13.5px] font-semibold text-porch-accent"
            >
              + Add your observations
            </button>
          )}
        </div>

        {/* Fix It Yourself */}
        <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
          <div className="flex items-center justify-between gap-2.5">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">Fix it yourself</p>
            {withinSkill && (
              <span className="rounded-full bg-porch-success-bg px-2.5 py-[3px] text-[11.5px] font-semibold text-porch-success">
                Within your skill level
              </span>
            )}
          </div>
          {userAccountType === "renter" && (
            <p className="mt-2 text-[12px] leading-relaxed text-porch-text-tertiary">
              Check your lease before modifying anything permanent — cosmetic and maintenance fixes are usually fine.
            </p>
          )}
          <p className="mt-2.5 font-display text-[26px] font-semibold text-porch-text">{issue.costEstimateDIY ?? "—"}</p>
          <EstimateDisclaimer />

          {bypassedDiyWarning && (
            <p className="mt-2.5 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
              You&apos;ve chosen to proceed on a repair we&apos;d normally route to a pro.
            </p>
          )}

          {showDiyWarning ? (
            <div className="mt-2.5 space-y-2.5">
              <p className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
                {isProOnly
                  ? "This repair is typically recommended for a licensed professional. Proceeding yourself carries risk."
                  : "This repair typically requires more experience than your current level. We recommend calling a professional."}
              </p>
              <button
                onClick={() => setDiyUnlocked(true)}
                className="btn-press rounded-[8px] px-3 py-2.5 text-[12.5px] font-semibold text-porch-text-secondary underline underline-offset-2"
              >
                I understand, show me anyway
              </button>
            </div>
          ) : hasDiyPlan ? (
            <div className="mt-1.5 space-y-2">
              <p className="text-[13.5px] text-porch-text-secondary">
                ✓ DIY plan ready — {issueDetails?.materialsList?.length ?? 0} materials, {issueDetails?.stepByStepPlan?.length ?? 0} steps
              </p>
              <Link
                href={`/section/${slug}/issue/${index}/diy?r=${reportId}`}
                className="btn-press inline-block rounded-[10px] border-none bg-porch-accent px-4 py-2 text-[13.5px] font-semibold text-white no-underline"
              >
                View Full Walkthrough →
              </Link>
            </div>
          ) : (
            <div className="mt-2.5 space-y-2.5">
              <p className="text-[13.5px] leading-relaxed text-porch-text-secondary">
                We&apos;ll put together a materials list and a step-by-step plan, sized to your skill level.
              </p>
              {diyError && <p className="text-xs text-red-600">{diyError}</p>}
              <button
                onClick={handleGenerateDiy}
                disabled={generatingDiy}
                className="btn-press w-full rounded-[10px] border-none bg-porch-accent py-3 text-[14.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingDiy ? diyStatus ?? "Generating…" : "Generate DIY Plan"}
              </button>
            </div>
          )}
        </div>

        {/* Call an Expert */}
        <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">Call an expert</p>
          <p className="mt-2.5 font-display text-[26px] font-semibold text-porch-text">{issue.costEstimatePro ?? "—"}</p>
          <EstimateDisclaimer />

          {hasExpertGuide ? (
            <div className="mt-2.5">
              <p className="mb-2.5 text-[13.5px] leading-relaxed text-porch-text-secondary">
                Get a briefing on what a proper fix looks like, questions to ask, and red flags to watch for.
              </p>
              <button
                onClick={() => { setShowRefineBriefingModal(true); setRefineBriefingError(null); }}
                className="btn-press mb-3 w-full rounded-[10px] border-[1.5px] border-porch-accent bg-porch-surface py-2.5 text-[13.5px] font-semibold text-porch-accent"
              >
                Refine This Briefing
              </button>
              <div className="flex w-full items-center justify-between gap-1.5">
                <button
                  onClick={() => setBriefingOpen((v) => !v)}
                  className="flex flex-1 items-center justify-between gap-2.5 border-none bg-transparent p-0 text-left"
                >
                  <span className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">
                    Contractor Briefing
                  </span>
                  <ChevronDownIcon style={{ transform: briefingOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
                </button>
                <button
                  onClick={handleShareBriefing}
                  className="btn-press flex min-h-[44px] shrink-0 items-center gap-1 rounded-[8px] px-2.5 text-[11.5px] font-semibold text-porch-accent focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
                >
                  <ShareIcon size={13} />
                  {briefingCopied ? "Copied ✓" : "Share"}
                </button>
              </div>
              {briefingOpen && (
                <div className="mt-3.5">
                  <MarkdownProse text={issueDetails!.contractorBriefing!} />
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2.5 space-y-2.5">
              <p className="text-[13.5px] leading-relaxed text-porch-text-secondary">
                Get a contractor briefing with questions to ask, red flags to watch for, and what a proper repair
                looks like — plus help finding someone nearby.
              </p>
              {!userLocation && (
                <p className="text-xs text-porch-text-tertiary">
                  Add your location in{" "}
                  <a href="/settings" className="text-porch-accent underline underline-offset-2">
                    Settings
                  </a>{" "}
                  to also find local contractors.
                </p>
              )}
              {expertError && <p className="text-xs text-red-600">{expertError}</p>}
              <button
                onClick={handleGenerateExpert}
                disabled={generatingExpert}
                className="btn-press w-full rounded-[10px] border-[1.5px] border-porch-accent bg-porch-surface py-3 text-[14.5px] font-semibold text-porch-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingExpert
                  ? expertStatus ?? "Generating…"
                  : userLocation
                    ? "Get Expert Guide & Find Pros"
                    : "Get Expert Guide"}
              </button>
            </div>
          )}
        </div>

        {/* Local contractors */}
        {contractors.length > 0 && (
          <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <div className="mb-3.5 flex items-baseline justify-between gap-4">
              <p className="text-[15.5px] font-semibold text-porch-text">Find Contractors Near You</p>
              {contractorType && <span className="text-xs capitalize text-porch-text-tertiary">{contractorType}</span>}
            </div>
            <div className="space-y-2.5">
              {contractors.map((c, i) => {
                const initial = c.name.trim().charAt(0).toUpperCase();
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3.5 rounded-2xl border border-porch-border bg-porch-surface px-[18px] py-4"
                  >
                    <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-porch-accent-tint font-display text-[15px] font-bold text-porch-accent">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-semibold text-porch-text">{c.name}</p>
                      {c.rating !== undefined && (
                        <p className="mt-0.5 text-[12.5px] text-porch-text-secondary">
                          ★ {c.rating.toFixed(1)}
                          {c.reviewCount !== undefined && ` (${c.reviewCount.toLocaleString()})`}
                        </p>
                      )}
                      <p className="mt-0.5 truncate text-[12.5px] text-porch-text-secondary">{c.address}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="text-xs text-porch-accent underline underline-offset-2"
                          >
                            {c.phone}
                          </a>
                        )}
                        <a
                          href={c.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-porch-text-secondary underline underline-offset-2"
                        >
                          View on Google Maps
                        </a>
                      </div>
                    </div>
                    <button
                      onClick={() => setContactModalContractor(c)}
                      className="btn-press shrink-0 rounded-full border border-porch-border-input bg-porch-surface px-3.5 py-2 text-[13px] font-semibold text-porch-text"
                    >
                      Contact
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="mt-2.5 text-[11px] text-porch-text-tertiary">
              Results sourced from Google Maps. Not vetted by Porchlight.
            </p>
          </div>
        )}

        {/* Move to section */}
        {!saved && moveTargetOptions.length > 0 && (
          <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">
              Move to Section
            </p>
            <div className="flex items-center gap-2.5">
              <select
                value={moveTarget}
                onChange={(e) => setMoveTarget(e.target.value)}
                className="flex-1 rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
              >
                <option value="">Select a section…</option>
                {moveTargetOptions.map((opt) => (
                  <option key={opt.slug} value={opt.slug}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={handleMoveIssue}
                disabled={!moveTarget || moving}
                className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2.5 text-sm font-semibold text-porch-text disabled:cursor-not-allowed disabled:opacity-50"
              >
                {moving ? "Moving…" : "Move"}
              </button>
            </div>
          </div>
        )}

        {/* Mark as complete */}
        {saved ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-porch-success-border bg-porch-success-bg p-[14px] text-sm font-semibold text-porch-success">
              {userAccountType === "renter" ? "✓ Marked as handled" : "✓ Marked as complete"}
            </div>
            {completedBy === "me" && (
              <button
                onClick={() => setShowShareFix(true)}
                className="btn-press flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-2xl border border-porch-accent/40 bg-porch-accent-tint px-[14px] py-3 text-sm font-semibold text-porch-accent"
              >
                <ShareIcon size={14} />
                Share this fix
              </button>
            )}
            <button
              onClick={handleMarkOpen}
              className="btn-press flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-porch-border-input bg-transparent px-[14px] py-3 text-sm font-medium text-porch-text-secondary"
            >
              Mark as open
            </button>
          </div>
        ) : !showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="btn-press flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-porch-border-input bg-transparent p-[14px] text-sm font-medium text-[#6B5F55]"
          >
            {userAccountType === "renter" ? "✓ Mark as handled" : "✓ Mark as complete"}
          </button>
        ) : (
          <div className="space-y-5 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-porch-text">Who fixed this?</p>
              <div className="flex gap-2">
                {(
                  userAccountType === "renter"
                    ? ([
                        { value: "me", label: "I fixed it" },
                        { value: "professional", label: "Landlord handled it" },
                      ] as const)
                    : ([
                        { value: "me", label: "Me" },
                        { value: "professional", label: "A Professional" },
                      ] as const)
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => { setCompletedBy(value); setDifficulty(null); }}
                    className={`btn-press rounded-[10px] border px-4 py-2 text-sm font-semibold ${
                      completedBy === value
                        ? "border-porch-accent bg-porch-accent text-white"
                        : "border-porch-border-input bg-porch-surface text-porch-text"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {completedBy === "me" && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-porch-text">How difficult was it?</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setDifficulty(n)}
                      className={`btn-press h-9 w-9 rounded-[10px] border text-sm font-semibold ${
                        difficulty === n
                          ? "border-porch-accent bg-porch-accent text-white"
                          : "border-porch-border-input bg-porch-surface text-porch-text"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-porch-text-tertiary">1 = Easy, 5 = Very Difficult</p>
              </div>
            )}

            {completedBy && (
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-porch-text">What did you actually pay? (optional)</p>
                <div className="flex items-center gap-2 rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5">
                  <span className="text-sm text-porch-text-tertiary">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                    placeholder="0"
                    className="flex-1 border-none bg-transparent text-sm text-porch-text outline-none placeholder:text-porch-text-tertiary"
                  />
                </div>
                <p className="text-xs text-porch-text-tertiary">Materials, parts — whatever it cost you.</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!completedBy || (completedBy === "me" && difficulty === null)}
                className="btn-press rounded-[10px] border-none bg-porch-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => { setShowForm(false); setCompletedBy(null); setDifficulty(null); setActualCost(""); }}
                className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>

      {showRefineBriefingModal && (
        <Modal onClose={() => { setShowRefineBriefingModal(false); setRefineBriefingFeedback(""); setRefineBriefingError(null); }} maxWidth={420}>
          <p className="text-[15px] font-semibold text-porch-text">Refine This Briefing</p>
          <p className="mt-1 text-xs text-porch-text-tertiary">
            Add more details about what you&apos;re seeing to get a more accurate briefing.
          </p>
          <textarea
            value={refineBriefingFeedback}
            onChange={(e) => setRefineBriefingFeedback(e.target.value)}
            placeholder="e.g. it's worse after long showers, and I'm in an older home built in 1965..."
            rows={5}
            autoFocus
            className="mt-3.5 w-full resize-y rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
          />
          <div className="mt-1.5 flex items-center justify-end">
            <MicButton
              onTranscript={(t) => setRefineBriefingFeedback((prev) => (prev ? `${prev} ${t}` : t))}
              disabled={refiningBriefing}
            />
          </div>
          {refineBriefingError && <p className="mt-1 text-xs text-red-600">{refineBriefingError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => { setShowRefineBriefingModal(false); setRefineBriefingFeedback(""); setRefineBriefingError(null); }}
              disabled={refiningBriefing}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRefineBriefing}
              disabled={!refineBriefingFeedback.trim() || refiningBriefing}
              className="btn-press rounded-[10px] border-none bg-porch-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refiningBriefing ? "Regenerating…" : "Regenerate Briefing"}
            </button>
          </div>
        </Modal>
      )}

      {showRegenDiyModal && (
        <Modal onClose={regenDiyLoading ? undefined : advanceToExpertModal} maxWidth={420}>
          <p className="text-sm font-semibold text-porch-text">Regenerate DIY Plan?</p>
          <p className="mt-2 text-sm leading-relaxed text-porch-text-secondary">
            You already have a DIY plan for this issue. Would you like to regenerate it using your new observations?
          </p>
          {regenError && <p className="mt-3 text-xs text-red-600">{regenError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={advanceToExpertModal}
              disabled={regenDiyLoading}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary disabled:opacity-50"
            >
              Keep Existing Plan
            </button>
            <button
              onClick={handleRegenDiy}
              disabled={regenDiyLoading}
              className="btn-press rounded-[10px] border-none bg-porch-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {regenDiyLoading ? "Regenerating…" : "Yes, Regenerate"}
            </button>
          </div>
        </Modal>
      )}

      {showRegenExpertModal && (
        <Modal onClose={regenExpertLoading ? undefined : () => setShowRegenExpertModal(false)} maxWidth={420}>
          <p className="text-sm font-semibold text-porch-text">Regenerate Contractor Briefing?</p>
          <p className="mt-2 text-sm leading-relaxed text-porch-text-secondary">
            Would you like to regenerate your contractor briefing with these new observations?
          </p>
          {regenError && <p className="mt-3 text-xs text-red-600">{regenError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setShowRegenExpertModal(false)}
              disabled={regenExpertLoading}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary disabled:opacity-50"
            >
              Keep Existing
            </button>
            <button
              onClick={handleRegenExpert}
              disabled={regenExpertLoading}
              className="btn-press rounded-[10px] border-none bg-porch-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {regenExpertLoading ? "Regenerating…" : "Yes, Regenerate"}
            </button>
          </div>
        </Modal>
      )}

      {suggestedTools.length > 0 && (
        <ToolSuggestSheet
          tools={suggestedTools}
          onConfirm={async (selected) => {
            await addTools(selected, "suggested", `${slug}-${index}`);
            setSuggestedTools([]);
          }}
          onDismiss={() => setSuggestedTools([])}
        />
      )}

      {showLevelUp && <LevelUpModal skillLevel={showLevelUp} onClose={() => setShowLevelUp(null)} />}

      {showShareFix && issue && (
        <ShareFixCard
          issueTitle={issue.title}
          savings={completionRecord ? savingsFor(issue, completionRecord) : null}
          onClose={() => setShowShareFix(false)}
        />
      )}

      {contactModalContractor && (
        <ContractorContactModal
          contractor={contactModalContractor}
          onClose={() => setContactModalContractor(null)}
          onRecordHire={handleRecordHire}
        />
      )}

      <ChatFAB
        scope="issue"
        storageKey={`issue_${slug}_${index}`}
        title="Ask About This Issue"
        placeholder="Ask about this issue..."
        emptyStateText="Ask anything about this repair — I know the report and your skill level."
        context={{
          issueTitle: issue.title,
          issueDescription: issue.description,
          issueSeverity: issue.severity,
          skillLevel: userSkillLevel ?? undefined,
          effectiveSkillLevel: effectiveSkillLevel ?? undefined,
          location: userLocation ?? undefined,
          propertyContext: propertyContext || undefined,
          toolbox: ownedTools,
        }}
        suggestedPrompts={[
          "Can I do this myself?",
          "What will this cost me?",
          "What happens if I ignore it?",
          "How long will this take?",
        ]}
      />
    </div>
  );
}
