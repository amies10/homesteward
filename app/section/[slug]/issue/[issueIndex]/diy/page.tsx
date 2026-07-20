"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  sections,
  normalize,
  diyKey,
  savingsFor,
  SKILL_RANK,
  type StoredReport,
  type IssueDetails,
  type StoredChatMessage,
  type CompletionRecord,
  type UserProfile,
  type SkillLevel,
  type Issue,
} from "@/lib/sections";
import {
  loadReports,
  loadIssueDetails,
  saveIssueDetails,
  saveCompletion,
  loadUserProfile,
  loadAllMyCompletions,
} from "@/lib/data";
import { computeEffectiveSkill } from "@/lib/skill";
import { loadToolbox, addTools, isToolHeuristic } from "@/lib/toolbox";
import { isOwned } from "@/lib/toolbox-match";
import { signPaths } from "@/lib/storage";
import { loadPropertyDetails } from "@/lib/property";
import { propertyContextLines } from "@/lib/ai-context";
import { streamChat } from "@/lib/chat-stream";
import ToolSuggestSheet from "@/app/components/ToolSuggestSheet";
import LevelUpModal from "@/app/components/LevelUpModal";
import MicButton from "@/app/components/MicButton";
import Modal from "@/app/components/Modal";
import BottomSheet from "@/app/components/BottomSheet";
import AssistantAvatar from "@/app/components/AssistantAvatar";
import ShareFixCard from "@/app/components/ShareFixCard";
import { renderInlineMarkdown } from "@/app/components/inlineMarkdown";
import { CameraIcon, CartIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, PlayIcon, SendIcon, SettingsIcon, XIcon } from "@/app/components/icons";
import HomeButton from "@/app/components/HomeButton";
import CalendarButton from "@/app/components/CalendarButton";

export default function DIYPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; issueIndex: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const router = useRouter();
  const { slug, issueIndex } = use(params);
  const { r } = use(searchParams);
  const index = parseInt(issueIndex, 10);
  const sectionConfig = sections.find((s) => s.slug === slug);

  const [issue, setIssue] = useState<StoredReport["sections"][0]["issues"][0] | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myCompletions, setMyCompletions] = useState<CompletionRecord[]>([]);
  const [issueDetails, setIssueDetails] = useState<IssueDetails | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [chatMessages, setChatMessages] = useState<StoredChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [showRefineModal, setShowRefineModal] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  const [materialsOpen, setMaterialsOpen] = useState(true);
  const [stepsOpen, setStepsOpen] = useState(true);

  const [workModeOpen, setWorkModeOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepExpanded, setStepExpanded] = useState<Record<number, boolean>>({});
  const [stepGenerating, setStepGenerating] = useState<Record<number, boolean>>({});
  const [stepDetail, setStepDetail] = useState<Record<number, string>>({});
  const [showCongrats, setShowCongrats] = useState(false);
  const [finishedRecord, setFinishedRecord] = useState<CompletionRecord | null>(null);
  const [showShareFix, setShowShareFix] = useState(false);
  const [suggestedTools, setSuggestedTools] = useState<string[]>([]);
  const [ownedTools, setOwnedTools] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [finishPressed, setFinishPressed] = useState(false);
  const [showFinishForm, setShowFinishForm] = useState(false);
  const [finishDifficulty, setFinishDifficulty] = useState<number | null>(null);
  const [finishActualCost, setFinishActualCost] = useState("");
  const [showLevelUp, setShowLevelUp] = useState<SkillLevel | null>(null);
  const [cardDragDx, setCardDragDx] = useState(0);
  const [cardDragging, setCardDragging] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(375);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [propertyContext, setPropertyContext] = useState("");

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const cardDragActive = useRef(false);
  const cardStartX = useRef(0);
  const cardStartY = useRef(0);
  const cardAxis = useRef<"none" | "x" | "y">("none");
  const cardMoved = useRef(false);
  const cardDragDxRef = useRef(0);
  const stepIndexRef = useRef(0);
  const stepsLengthRef = useRef(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-API reads (window size, matchMedia), must run client-side post-hydration
    setViewportWidth(window.innerWidth);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handleChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  useEffect(() => {
    Promise.all([loadReports(), loadUserProfile(), loadAllMyCompletions()]).then(
      ([loadedReports, loadedProfile, allMyCompletions]) => {
        setReports(loadedReports);
        setProfile(loadedProfile);
        setMyCompletions(allMyCompletions);

        const resolvedReportId = r ?? loadedReports[0]?.id ?? null;
        setReportId(resolvedReportId);
        if (!resolvedReportId) return;

        const reportForIssue = loadedReports.find((rp) => rp.id === resolvedReportId);
        const reportSection = reportForIssue?.sections.find(
          (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
        );
        setIssue(reportSection?.issues[index] ?? null);

        loadIssueDetails(resolvedReportId, slug, index).then((details) => {
          if (details) {
            setIssueDetails(details);
            if (details.stepElaborations) {
              setStepDetail(details.stepElaborations);
              setStepExpanded(
                Object.keys(details.stepElaborations).reduce<Record<number, boolean>>((acc, k) => {
                  acc[Number(k)] = true;
                  return acc;
                }, {})
              );
            }
          }
        });

        const sKey = diyKey(resolvedReportId, slug, index, "steps");
        const cKey = diyKey(resolvedReportId, slug, index, "chat");

        try {
          const s = localStorage.getItem(sKey);
          if (s) setCheckedSteps(JSON.parse(s));
          const c = localStorage.getItem(cKey);
          if (c) setChatMessages(JSON.parse(c));
        } catch {}
      }
    );

    loadToolbox().then((tools) => setOwnedTools(tools.map((t) => t.toolName)));
    loadPropertyDetails().then((property) => setPropertyContext(propertyContextLines(property)));
  }, [slug, index, r, sectionConfig]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  function toggleStep(i: number) {
    const next = { ...checkedSteps, [i]: !checkedSteps[i] };
    setCheckedSteps(next);
    if (reportId) localStorage.setItem(diyKey(reportId, slug, index, "steps"), JSON.stringify(next));
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingImage({ base64: dataUrl.split(",")[1], mimeType: file.type, previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? inputText).trim();
    if (!text && !pendingImage) return;
    if (!issue) return;

    const userMsg: StoredChatMessage = {
      role: "user",
      text,
      imageBase64: pendingImage?.base64,
      imageMimeType: pendingImage?.mimeType,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    if (reportId) localStorage.setItem(diyKey(reportId, slug, index, "chat"), JSON.stringify(updatedMessages));
    setInputText("");
    setPendingImage(null);
    setChatLoading(true);
    setChatError(null);

    const placeholder: StoredChatMessage = { role: "assistant", text: "", timestamp: new Date().toISOString() };
    setChatMessages([...updatedMessages, placeholder]);

    try {
      const photoUrls = issueDetails?.photoPaths?.length
        ? Object.values(await signPaths(issueDetails.photoPaths))
        : undefined;

      const finalText = await streamChat(
        "/api/diy-chat",
        {
          messages: updatedMessages,
          issueTitle: issue.title,
          issueDescription: issue.description,
          severity: issue.severity,
          photoUrls,
          location: profile?.location ?? undefined,
          skillLevel: profile?.skillLevel ?? undefined,
          propertyContext: propertyContext || undefined,
        },
        (accumulated) => {
          setChatMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, text: accumulated } : m)));
        }
      );

      const withReply = [...updatedMessages, { ...placeholder, text: finalText }];
      setChatMessages(withReply);
      if (reportId) localStorage.setItem(diyKey(reportId, slug, index, "chat"), JSON.stringify(withReply));
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Failed to get response");
      setChatMessages(updatedMessages);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleRefine() {
    if (!refineFeedback.trim() || !issue || !issueDetails || !reportId) return;
    setRefining(true);
    setRefineError(null);
    try {
      const res = await fetch("/api/generate-diy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueTitle: issue.title,
          issueDescription: issue.description,
          severity: issue.severity,
          recommendedAction: issue.recommendedAction,
          feedback: refineFeedback.trim(),
          existingMaterialsList: issueDetails.materialsList,
          existingStepByStepPlan: issueDetails.stepByStepPlan,
          userObservation: issueDetails.userObservation,
          ownedTools: ownedTools.length ? ownedTools : undefined,
          photoUrls: issueDetails.photoPaths?.length
            ? Object.values(await signPaths(issueDetails.photoPaths))
            : undefined,
          location: profile?.location ?? undefined,
          propertyContext: propertyContext || undefined,
          sectionSlug: slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refinement failed");
      const updated: IssueDetails = {
        ...issueDetails,
        materialsList: data.materialsList,
        stepByStepPlan: data.stepByStepPlan,
        safetyWarning: data.safetyWarning ?? null,
        stepElaborations: {},
      };
      setIssueDetails(updated);
      await saveIssueDetails(reportId, slug, index, updated);
      setCheckedSteps({});
      setStepExpanded({});
      setStepDetail({});
      localStorage.removeItem(diyKey(reportId, slug, index, "steps"));
      setShowRefineModal(false);
      setRefineFeedback("");
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefining(false);
    }
  }

  async function requestStepDetail(i: number, stepText: string) {
    if (stepExpanded[i] || !issue) return;
    setStepGenerating((prev) => ({ ...prev, [i]: true }));
    try {
      const res = await fetch("/api/elaborate-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueTitle: issue.title,
          issueDescription: issue.description,
          stepText,
          stepNumber: i + 1,
          totalSteps: steps.length,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStepDetail((prev) => ({ ...prev, [i]: data.detail }));
        setStepExpanded((prev) => ({ ...prev, [i]: true }));
        if (reportId) {
          const updatedDetails: IssueDetails = {
            ...issueDetails,
            stepElaborations: { ...issueDetails?.stepElaborations, [String(i)]: data.detail },
          };
          setIssueDetails(updatedDetails);
          await saveIssueDetails(reportId, slug, index, updatedDetails);
        }
      } else {
        setStepDetail((prev) => ({ ...prev, [i]: "Couldn't load more detail right now." }));
        setStepExpanded((prev) => ({ ...prev, [i]: true }));
      }
    } catch {
      setStepDetail((prev) => ({ ...prev, [i]: "Couldn't load more detail right now." }));
      setStepExpanded((prev) => ({ ...prev, [i]: true }));
    } finally {
      setStepGenerating((prev) => ({ ...prev, [i]: false }));
    }
  }

  function goToStep(i: number) {
    const total = steps.length + 1;
    setStepIndex(Math.max(0, Math.min(total - 1, i)));
  }

  function lookupIssueInReports(repId: string, issueSlug: string, idx: number): Issue | undefined {
    const rpt = reports.find((rp) => rp.id === repId);
    const cfg = sections.find((sc) => sc.slug === issueSlug);
    const sec = rpt?.sections.find(
      (s) => s.slug === issueSlug || (cfg && normalize(s.name) === normalize(cfg.label))
    );
    return sec?.issues[idx];
  }

  // Shared tail once the completion is saved (and any level-up modal has been
  // seen) — shows the tool-suggestion sheet if there are unowned tools in the
  // materials list, otherwise goes straight to the congrats screen.
  async function proceedAfterSave() {
    if (issueDetails?.materialsList?.length) {
      const owned = new Set((await loadToolbox()).map((t) => t.toolName.toLowerCase()));
      const suggestions = issueDetails.materialsList
        .filter((m) => (m.isTool ?? isToolHeuristic(m.item)) && !owned.has(m.item.toLowerCase()))
        .map((m) => m.item);
      if (suggestions.length) {
        setSuggestedTools(suggestions);
        return; // congrats shows once the suggestion sheet resolves
      }
    }
    setShowCongrats(true);
  }

  // Same completion flow as "Mark as Complete" on the issue detail page
  // (lib/data.ts saveCompletion — always resolves, falling back to
  // localStorage-only if Supabase is unreachable, so no try/catch needed
  // here either, matching that page). Unlike before, Work Mode's finish now
  // collects a difficulty rating (required) and an optional actual cost via
  // the showFinishForm overlay before this runs.
  async function handleFinishRepair() {
    if (finishing || !reportId || finishDifficulty === null) return;
    setFinishing(true);

    const parsedCost = finishActualCost.trim() ? parseFloat(finishActualCost) : NaN;
    const record: CompletionRecord = {
      slug,
      issueIndex: index,
      reportId,
      completedBy: "me",
      difficulty: finishDifficulty,
      completedAt: new Date().toISOString(),
      ...(finishActualCost.trim() && !isNaN(parsedCost) ? { actualCost: parsedCost } : {}),
    };

    const before = profile
      ? computeEffectiveSkill(profile.skillLevel, myCompletions, lookupIssueInReports)
      : null;

    await saveCompletion(record);
    setFinishing(false);
    setShowFinishForm(false);
    setFinishedRecord(record);

    let leveledUpTo: SkillLevel | null = null;
    if (before && profile) {
      const updatedCompletions = [...myCompletions, record];
      const after = computeEffectiveSkill(profile.skillLevel, updatedCompletions, lookupIssueInReports);
      setMyCompletions(updatedCompletions);
      if (SKILL_RANK[after.effective] > SKILL_RANK[before.effective]) leveledUpTo = after.effective;
    }

    if (leveledUpTo) {
      setShowLevelUp(leveledUpTo);
    } else {
      await proceedAfterSave();
    }
  }

  function setCardDx(dx: number) {
    cardDragDxRef.current = dx;
    setCardDragDx(dx);
  }

  function updateCardDrag(clientX: number) {
    const dx = clientX - cardStartX.current;
    if (Math.abs(dx) > 6) cardMoved.current = true;
    setCardDx(dx);
  }

  function endCardDrag() {
    const wasHorizontal = cardDragActive.current && cardAxis.current === "x";
    cardDragActive.current = false;
    cardAxis.current = "none";
    if (!wasHorizontal) {
      setCardDragging(false);
      setCardDx(0);
      return;
    }
    const dx = cardDragDxRef.current;
    // Navigate once the drag passes ~30% of the visible card width. Read the
    // width live from the DOM so it stays correct after an orientation change.
    const cardWidth = cardContainerRef.current?.offsetWidth || viewportWidth;
    const threshold = cardWidth * 0.3;
    const total = stepsLengthRef.current + 1;
    let next = stepIndexRef.current;
    if (dx <= -threshold && next < total - 1) next += 1;
    else if (dx >= threshold && next > 0) next -= 1;
    setCardDragging(false);
    setCardDx(0);
    setStepIndex(next);
  }

  // Pointer events handle mouse/pen only. Touch is handled exclusively by the
  // native listeners in the effect below — running both for a single finger
  // gesture would double-process it on browsers that fire both. Mouse has no
  // vertical-scroll competition, so it locks to the horizontal axis immediately.
  function onCardPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    const target = e.target as Element;
    try {
      target.setPointerCapture?.(e.pointerId);
    } catch {}
    cardDragActive.current = true;
    cardAxis.current = "x";
    cardStartX.current = e.clientX;
    cardMoved.current = false;
    setCardDragging(true);
    setCardDx(0);
  }

  function onCardPointerMove(e: React.PointerEvent) {
    if (e.pointerType === "touch" || !cardDragActive.current) return;
    e.preventDefault();
    updateCardDrag(e.clientX);
  }

  function onCardPointerEnd(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    endCardDrag();
  }

  // Native, non-passive touch listeners for the swipe. Bound when Work Mode
  // opens (the carousel lives inside {workModeOpen && …}, so it isn't in the DOM
  // at the page's initial mount). All drag state is read from refs, so the
  // mount-time closure never goes stale.
  //
  // Directional lock: the first ~8px of movement decides the axis. A horizontal
  // gesture becomes a step swipe (we preventDefault to own it). A vertical
  // gesture is released — we abandon the drag and don't preventDefault, so the
  // browser scrolls the step card behind the chat sheet natively. This is why
  // the container uses touch-action: pan-y rather than none.
  useEffect(() => {
    if (!workModeOpen) return;
    const el = cardContainerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      cardDragActive.current = true;
      cardAxis.current = "none";
      cardStartX.current = e.touches[0].clientX;
      cardStartY.current = e.touches[0].clientY;
      cardMoved.current = false;
    }
    function onTouchMove(e: TouchEvent) {
      if (!cardDragActive.current) return;
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;
      if (cardAxis.current === "none") {
        const dx = x - cardStartX.current;
        const dy = y - cardStartY.current;
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy)) {
          cardAxis.current = "x";
          setCardDragging(true);
        } else {
          // Vertical: release so the card behind scrolls natively.
          cardAxis.current = "y";
          cardDragActive.current = false;
          return;
        }
      }
      if (cardAxis.current === "x") {
        e.preventDefault();
        updateCardDrag(x);
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", endCardDrag, { passive: true });
    el.addEventListener("touchcancel", endCardDrag, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", endCardDrag);
      el.removeEventListener("touchcancel", endCardDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workModeOpen]);

  const materials = issueDetails?.materialsList ?? [];
  const ownedMaterialItems = materials.filter((m) => isOwned(m.item, ownedTools)).map((m) => m.item);
  const missingMaterialsCount = materials.filter((m) => !isOwned(m.item, ownedTools)).length;
  const steps = issueDetails?.stepByStepPlan ?? [];
  const stepsCheckedCount = steps.filter((_, i) => checkedSteps[i]).length;

  useEffect(() => {
    stepsLengthRef.current = steps.length;
  }, [steps.length]);

  const lastChatMessage = chatMessages[chatMessages.length - 1];
  const lastAssistantChatText = lastChatMessage?.role === "assistant" ? lastChatMessage.text : "";
  const DIY_CHAT_SUGGESTED_PROMPTS = [
    "What tools do I actually need?",
    "How do I know when it's done right?",
    "What's the most common mistake here?",
  ];

  const chatBody = (
    <>
      {chatMessages.length === 0 && !chatLoading && (
        <div className="pt-6 text-center">
          <p className="text-[13.5px] text-porch-text-faint">
            No messages yet — ask below and I&apos;ll walk through it with you.
          </p>
          <div className="mt-3.5 flex flex-wrap justify-center gap-2 px-2">
            {DIY_CHAT_SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => sendMessage(prompt)}
                className="btn-press rounded-full border border-porch-accent/40 bg-porch-accent-tint px-3.5 py-2.5 text-[13px] text-porch-accent"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-3">
        {chatMessages.map((msg, i) => {
          if (!msg.text && !msg.imageBase64) return null;
          return (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.role === "user"
                    ? "border border-porch-border bg-porch-surface text-porch-text"
                    : "border border-[#ECE0E6] bg-porch-accent-tint text-porch-text"
                }`}
              >
                {msg.imageBase64 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`data:${msg.imageMimeType};base64,${msg.imageBase64}`} alt="Uploaded" className="mb-2 max-h-48 rounded-lg object-contain" />
                )}
                {msg.text && (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{renderInlineMarkdown(msg.text)}</p>
                )}
              </div>
            </div>
          );
        })}
        {chatLoading && lastAssistantChatText === "" && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-porch-border bg-porch-surface px-4 py-2.5">
              <p className="text-sm text-porch-text-tertiary">Thinking…</p>
            </div>
          </div>
        )}
        {chatError && <p className="text-center text-xs text-red-500">{chatError}</p>}
        <div ref={chatBottomRef} />
      </div>
    </>
  );

  const chatInputRow = (
    <div className="mt-2 flex-shrink-0 border-t border-[#F2EBE1] px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">
      {pendingImage && (
        <div className="mb-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pendingImage.previewUrl} alt="Pending" className="h-12 w-12 rounded-lg object-cover" />
          <button
            onClick={() => setPendingImage(null)}
            className="btn-press rounded-[8px] px-3 py-2.5 text-xs font-semibold text-porch-text-tertiary"
          >
            Remove
          </button>
        </div>
      )}
      <div className="flex items-center gap-1.5 rounded-full border border-porch-border bg-porch-bg py-1.5 pl-4 pr-1.5">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask about this repair..."
          disabled={chatLoading}
          className="flex-1 border-none bg-transparent text-[14.5px] text-porch-text outline-none placeholder:text-porch-text-tertiary disabled:opacity-50"
        />
        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />
        <MicButton
          onTranscript={(t) => setInputText((prev) => (prev ? `${prev} ${t}` : t))}
          disabled={chatLoading}
          className="!h-[34px] !w-[34px] !rounded-full !border-none !bg-porch-accent-tint !p-0"
        />
        <button
          onClick={() => imageInputRef.current?.click()}
          disabled={chatLoading}
          aria-label="Attach photo"
          className="btn-press flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-none bg-porch-accent-tint disabled:opacity-50"
        >
          <CameraIcon />
        </button>
        <button
          onClick={() => sendMessage()}
          disabled={chatLoading || (!inputText.trim() && !pendingImage)}
          aria-label="Send"
          className="btn-press flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-none bg-porch-accent disabled:opacity-50"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );

  const baseTranslate = -(stepIndex * viewportWidth);
  const liveTranslate = baseTranslate + (cardDragging ? cardDragDx : 0);

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-porch-border bg-porch-surface px-5 py-2.5">
        <Link href={`/section/${slug}/issue/${index}?r=${reportId}`} className="flex min-w-0 items-center gap-1.5 text-[13.5px] text-porch-text-secondary no-underline">
          <ChevronLeftIcon size={15} />
          <span className="truncate">{issue?.title ?? "Issue"}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {!workModeOpen && (
            <>
              <CalendarButton size={18} />
              <HomeButton size={18} />
            </>
          )}
          <Link href="/settings" aria-label="Settings" className="flex items-center p-1">
            <SettingsIcon size={18} />
          </Link>
        </div>
      </header>

      <div className="sticky top-[42px] z-[9] flex items-center justify-between gap-3 border-b border-porch-border bg-porch-bg px-5 py-3.5">
        <span className="font-display text-[21px] font-semibold text-porch-text">DIY Walkthrough</span>
        <button
          onClick={() => {
            setWorkModeOpen(true);
            setStepIndex(0);
            setShowCongrats(false);
            setShowFinishForm(false);
            setFinishDifficulty(null);
            setFinishActualCost("");
          }}
          disabled={steps.length === 0}
          className="btn-press flex shrink-0 items-center gap-1.5 rounded-full border-none bg-porch-accent px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlayIcon />
          Enter Work Mode
        </button>
      </div>

      {issueDetails?.safetyWarning && (
        <div className="px-5 pb-1 pt-2.5">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-[18px] text-red-800">
            <div className="flex items-start gap-2.5">
              <span aria-hidden="true" className="text-lg leading-none">⚠</span>
              <div className="space-y-2">
                <p className="text-sm leading-relaxed">{issueDetails.safetyWarning}</p>
                <p className="text-xs font-semibold leading-relaxed">
                  Stop and call a pro if anything looks different from these instructions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pb-1 pt-2.5">
        {materials.length > 0 && (
          <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <button onClick={() => setMaterialsOpen((v) => !v)} className="flex w-full items-center justify-between gap-2.5 border-none bg-transparent p-0">
              <span className="text-[15.5px] font-semibold text-porch-text">Materials &amp; Tools</span>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="text-[13px] text-porch-text-tertiary">{materials.length} items</span>
                <ChevronDownIcon style={{ transform: materialsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
              </div>
            </button>
            {materialsOpen && (
              <div>
                {/* TODO(affiliate): populate purchaseUrl and make this row a real link list once shopping links exist */}
                <button
                  disabled
                  title="Shopping links coming soon"
                  className="flex min-h-[44px] w-full cursor-not-allowed items-center gap-2 border-t border-[#F2EBE1] py-2.5 text-left opacity-60"
                >
                  <CartIcon size={15} />
                  <span className="flex-1 text-[13px] font-medium text-porch-text-secondary">Buy what you&apos;re missing</span>
                  {missingMaterialsCount > 0 && (
                    <span className="shrink-0 rounded-full bg-porch-bg px-2 py-0.5 text-[11px] font-medium text-porch-text-tertiary">
                      {missingMaterialsCount}
                    </span>
                  )}
                </button>
                {ownedMaterialItems.length > 0 && (
                  <p className="border-t border-[#F2EBE1] pt-2.5 text-[12.5px] leading-relaxed text-porch-text-secondary">
                    You already own {ownedMaterialItems.length === materials.length ? "everything on this list." : (
                      <>
                        {ownedMaterialItems.join(", ")} — you&apos;ll need to pick up the rest.
                      </>
                    )}
                  </p>
                )}
                {materials.map((m, i) => {
                  const owned = isOwned(m.item, ownedTools);
                  return (
                    <div key={i} className="flex items-center gap-3 border-t border-[#F2EBE1] py-2.5">
                      {m.purchaseUrl ? (
                        <a
                          href={m.purchaseUrl}
                          target="_blank"
                          rel="noopener noreferrer sponsored"
                          className="flex-1 text-sm leading-relaxed text-porch-accent underline underline-offset-2"
                        >
                          {m.item}
                        </a>
                      ) : (
                        <span className="flex-1 text-sm leading-relaxed text-porch-text">{m.item}</span>
                      )}
                      {owned && (
                        <span className="shrink-0 rounded-full bg-porch-success-bg px-2 py-0.5 text-[11px] font-medium text-porch-success">
                          ✓ owned
                        </span>
                      )}
                      <span className="shrink-0 text-[13px] text-porch-text-tertiary">{m.estimatedCost}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 pb-1 pt-2.5">
        {steps.length > 0 && (
          <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <button onClick={() => setStepsOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 border-none bg-transparent p-0">
              <span className="text-[15.5px] font-semibold text-porch-text">Step-by-Step Plan</span>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="text-[13px] text-porch-text-tertiary">{stepsCheckedCount}/{steps.length} done</span>
                <ChevronDownIcon style={{ transform: stepsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
              </div>
            </button>
            {stepsOpen && (
              <>
                <div className="mt-2.5 text-right">
                  <button
                    onClick={() => { setShowRefineModal(true); setRefineError(null); }}
                    className="btn-press rounded-[8px] px-3 py-2.5 text-[12.5px] font-semibold text-porch-accent underline"
                  >
                    Refine This Plan
                  </button>
                </div>
                {steps.map((step, i) => {
                  const done = !!checkedSteps[i];
                  return (
                    <button
                      key={i}
                      onClick={() => toggleStep(i)}
                      className="flex w-full items-start gap-3 border-t border-[#F2EBE1] py-3 text-left"
                    >
                      <span
                        className={`mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] ${
                          done ? "border-porch-accent bg-porch-accent" : "border-porch-border-input bg-porch-surface"
                        }`}
                      >
                        {done && <CheckIcon size={12} strokeWidth={3} />}
                      </span>
                      <span className={`flex-1 text-sm leading-relaxed ${done ? "text-porch-text-tertiary line-through" : "text-[#3A3532]"}`}>
                        <strong>Step {i + 1}:</strong> {step}
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        )}

        {materials.length === 0 && steps.length === 0 && (
          <div className="rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
            <p className="text-sm text-porch-text-secondary">
              No DIY plan generated yet.{" "}
              <Link href={`/section/${slug}/issue/${index}?r=${reportId}`} className="text-porch-accent underline underline-offset-2">
                Go back and click &quot;Generate DIY Plan&quot;
              </Link>{" "}
              to create one.
            </p>
          </div>
        )}
      </div>

      <div className="px-5 pb-[120px] pt-2.5">
        <div className="flex items-center gap-3 rounded-2xl border border-[#ECE0D8] bg-gradient-to-br from-[#FBF3E9] to-[#F4EBEF] p-[18px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-porch-accent">
            <AssistantAvatar size={30} variant="bust" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14.5px] font-semibold text-porch-text">Got a question about this fix?</div>
            <div className="mt-0.5 text-[13px] text-porch-text-secondary">
              I know your report, your skill level, and this exact repair. Ask me anything, any time.
            </div>
          </div>
        </div>
      </div>

      <BottomSheet
        collapsedHeight={34}
        handleLabel={<div className="px-5 pb-0 pt-1 text-[13px] font-semibold text-[#6B5F55]">What&apos;s the issue?</div>}
        footer={chatInputRow}
      >
        {chatBody}
      </BottomSheet>

      {showRefineModal && (
        <Modal onClose={() => { setShowRefineModal(false); setRefineFeedback(""); setRefineError(null); }} maxWidth={420}>
          <p className="text-[15px] font-semibold text-porch-text">Refine This Plan</p>
          <p className="mt-1 text-xs text-porch-text-tertiary">
            Describe what you found or what isn&apos;t working with the current plan.
          </p>
          <textarea
            value={refineFeedback}
            onChange={(e) => setRefineFeedback(e.target.value)}
            placeholder="e.g. the shutoff valve isn't where the plan says, I don't have a tile saw..."
            rows={5}
            autoFocus
            className="mt-3.5 w-full resize-y rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
          />
          <div className="mt-1.5 flex items-center justify-end">
            <MicButton onTranscript={(t) => setRefineFeedback((prev) => (prev ? `${prev} ${t}` : t))} disabled={refining} />
          </div>
          {refineError && <p className="mt-1 text-xs text-red-600">{refineError}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => { setShowRefineModal(false); setRefineFeedback(""); setRefineError(null); }}
              disabled={refining}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleRefine}
              disabled={!refineFeedback.trim() || refining}
              className="btn-press rounded-[10px] border-none bg-porch-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refining ? "Regenerating…" : "Regenerate Plan"}
            </button>
          </div>
        </Modal>
      )}

      {workModeOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-porch-bg">
          <div className="flex shrink-0 items-center justify-between px-5 pb-1.5 pt-4">
            <button
              onClick={() => setWorkModeOpen(false)}
              aria-label="Exit work mode"
              className="btn-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-none bg-[#F1EAE1]"
            >
              <XIcon size={16} color="#6B5F55" />
            </button>
            <div className="text-center text-[14.5px] font-semibold text-porch-text">{issue?.title}</div>
            <span className="w-9 shrink-0" />
          </div>

          <div className="flex shrink-0 flex-wrap justify-center gap-1.5 px-5 pb-1 pt-2.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: i === stepIndex ? "#7D234A" : checkedSteps[i] ? "#D9BFCB" : "#E3DACD" }}
              />
            ))}
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: stepIndex === steps.length ? "#7D234A" : "#E3DACD" }} />
          </div>

          <div
            ref={cardContainerRef}
            onPointerDown={onCardPointerDown}
            onPointerMove={onCardPointerMove}
            onPointerUp={onCardPointerEnd}
            onPointerCancel={onCardPointerEnd}
            style={{ touchAction: "pan-y" }}
            className="relative flex-1 overflow-hidden"
          >
            <div
              style={{
                transform: `translateX(${liveTranslate}px)`,
                transition: cardDragging || prefersReducedMotion ? "none" : "transform 0.32s cubic-bezier(0.2,0.8,0.2,1)",
              }}
              className="flex h-full"
            >
              {steps.map((stepText, i) => {
                const done = !!checkedSteps[i];
                const expanded = !!stepExpanded[i];
                const generating = !!stepGenerating[i];
                return (
                  <div key={i} style={{ width: viewportWidth }} className="flex h-full shrink-0 flex-col px-4 pb-3.5 pt-2">
                    <div className="flex flex-1 flex-col overflow-y-auto rounded-3xl border border-porch-border bg-porch-surface p-6 shadow-[0_2px_10px_rgba(38,34,32,0.05)]">
                      {i === 0 && issueDetails?.safetyWarning && (
                        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-red-800">
                          <div className="flex items-start gap-2">
                            <span aria-hidden="true" className="text-base leading-none">⚠</span>
                            <div className="space-y-1.5">
                              <p className="text-[13px] leading-relaxed">{issueDetails.safetyWarning}</p>
                              <p className="text-[11.5px] font-semibold leading-relaxed">
                                Stop and call a pro if anything looks different from these instructions.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex shrink-0 items-start justify-between gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-porch-accent-tint font-display text-[17px] font-bold text-porch-accent">
                          {i + 1}
                        </div>
                        <button
                          onClick={() => toggleStep(i)}
                          className={`btn-press flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-2.5 text-[13px] font-semibold ${
                            done ? "border-porch-accent bg-porch-accent text-white" : "border-porch-border-input bg-porch-surface text-[#6B5F55]"
                          }`}
                        >
                          {done && <CheckIcon size={13} strokeWidth={3} />}
                          {done ? "Marked done" : "Mark step done"}
                        </button>
                      </div>
                      <div className="mt-5">
                        <div className="text-[19px] leading-[1.7] text-porch-text">{stepText}</div>
                        {!expanded && !generating && (
                          <button
                            onClick={() => requestStepDetail(i, stepText)}
                            className="btn-press mt-4 rounded-[8px] px-3 py-2.5 text-sm font-semibold text-porch-accent underline"
                          >
                            Give me more detail
                          </button>
                        )}
                        {generating && (
                          <div className="mt-4 border-t border-[#F2EBE1] pt-4 text-sm italic text-porch-text-tertiary">
                            Working on it…
                          </div>
                        )}
                        {expanded && (
                          <div className="mt-4 border-t border-[#F2EBE1] pt-4 text-[15px] leading-[1.7] text-[#6B5F55]">
                            {stepDetail[i]}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div style={{ width: viewportWidth }} className="flex h-full shrink-0 flex-col px-4 pb-3.5 pt-2">
                <div className="flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl border border-porch-border bg-porch-surface p-6 text-center shadow-[0_2px_10px_rgba(38,34,32,0.05)]">
                  <div className="font-display text-xl font-semibold text-porch-text">All steps done?</div>
                  <div className="max-w-[280px] text-[14.5px] leading-relaxed text-porch-text-secondary">
                    Tap the circle once you&apos;ve finished the repair.
                  </div>
                  <button
                    onClick={() => setShowFinishForm(true)}
                    onPointerDown={() => setFinishPressed(true)}
                    onPointerUp={() => setFinishPressed(false)}
                    onPointerLeave={() => setFinishPressed(false)}
                    onPointerCancel={() => setFinishPressed(false)}
                    onTouchStart={() => setFinishPressed(true)}
                    onTouchEnd={() => setFinishPressed(false)}
                    onTouchCancel={() => setFinishPressed(false)}
                    disabled={finishing}
                    aria-label="Mark repair complete"
                    style={{
                      transform: finishPressed ? "scale(0.96)" : "scale(1)",
                      filter: finishPressed ? "brightness(0.94)" : "brightness(1)",
                      transition: "transform 0.12s ease, filter 0.12s ease",
                    }}
                    className="flex h-[88px] w-[88px] items-center justify-center rounded-full border-none bg-porch-accent shadow-[0_6px_18px_rgba(125,35,74,0.35)] disabled:opacity-70"
                  >
                    {finishing ? (
                      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/40 border-t-white" />
                    ) : (
                      <CheckIcon size={40} strokeWidth={2.6} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* mb-[34px] keeps this row above the collapsed chat pill (also 34px) */}
          <div className="mb-[34px] flex shrink-0 items-center justify-center gap-4.5 px-5 py-1">
            <button onClick={() => goToStep(stepIndex - 1)} style={{ opacity: stepIndex === 0 ? 0.35 : 1 }} className="border-none bg-transparent p-2 text-[13px] font-medium text-porch-text-tertiary">
              ← Previous
            </button>
            <button onClick={() => goToStep(stepIndex + 1)} style={{ opacity: stepIndex === steps.length ? 0.35 : 1 }} className="border-none bg-transparent p-2 text-[13px] font-medium text-porch-text-tertiary">
              Next →
            </button>
          </div>

          <BottomSheet
            position="absolute"
            zIndex={55}
            collapsedHeight={34}
            handleLabel={
              <div className="flex w-full items-center gap-2.5 px-4 pb-2 pt-0.5">
                <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-porch-accent">
                  <AssistantAvatar size={22} variant="bust" />
                </div>
                <span className="flex-1 text-sm text-porch-text-secondary">Ask about this step…</span>
              </div>
            }
            footer={chatInputRow}
          >
            {chatBody}
          </BottomSheet>

          {suggestedTools.length > 0 && (
            <ToolSuggestSheet
              tools={suggestedTools}
              onConfirm={async (selected) => {
                await addTools(selected, "suggested", `${slug}-${index}`);
                setSuggestedTools([]);
                setShowCongrats(true);
              }}
              onDismiss={() => {
                setSuggestedTools([]);
                setShowCongrats(true);
              }}
            />
          )}

          {showFinishForm && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-porch-bg p-8 text-center"
            >
              <div className="w-full max-w-[320px] space-y-5 text-left">
                <div className="space-y-2">
                  <p className="text-center font-display text-xl font-semibold text-porch-text">How difficult was it?</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setFinishDifficulty(n)}
                        className={`btn-press h-11 w-11 rounded-[10px] border text-sm font-semibold ${
                          finishDifficulty === n
                            ? "border-porch-accent bg-porch-accent text-white"
                            : "border-porch-border-input bg-porch-surface text-porch-text"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="text-center text-xs text-porch-text-tertiary">1 = Easy, 5 = Very Difficult</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-porch-text">What did you actually pay? (optional)</p>
                  <div className="flex items-center gap-2 rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-2.5">
                    <span className="text-sm text-porch-text-tertiary">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={finishActualCost}
                      onChange={(e) => setFinishActualCost(e.target.value)}
                      placeholder="0"
                      className="flex-1 border-none bg-transparent text-sm text-porch-text outline-none placeholder:text-porch-text-tertiary"
                    />
                  </div>
                  <p className="text-xs text-porch-text-tertiary">Materials, parts — whatever it cost you.</p>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={handleFinishRepair}
                    disabled={finishDifficulty === null || finishing}
                    className="btn-press w-full rounded-full border-none bg-porch-accent px-7 py-3 text-[14.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {finishing ? "Saving…" : "Save & finish"}
                  </button>
                  <button
                    onClick={() => setShowFinishForm(false)}
                    disabled={finishing}
                    className="btn-press w-full rounded-full border-[1.5px] border-porch-border-input bg-transparent px-7 py-3 text-[14.5px] font-semibold text-porch-text-secondary disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {showLevelUp && (
            <LevelUpModal
              skillLevel={showLevelUp}
              onClose={async () => {
                setShowLevelUp(null);
                await proceedAfterSave();
              }}
            />
          )}

          {showCongrats && (
            <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4.5 bg-porch-bg p-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-porch-accent shadow-[0_6px_18px_rgba(125,35,74,0.35)]">
                <CheckIcon size={36} strokeWidth={2.8} />
              </div>
              <div className="font-display text-[26px] font-semibold text-porch-text">Nice work.</div>
              <div className="max-w-[300px] text-[15px] leading-relaxed text-porch-text-secondary">
                That&apos;s one more thing taken care of. Your home&apos;s a little better off because of it.
              </div>
              <div className="mt-2 flex w-full max-w-[300px] flex-col gap-2.5">
                <button
                  onClick={() => router.push("/")}
                  className="btn-press w-full rounded-full border-none bg-porch-accent px-7 py-3 text-[14.5px] font-semibold text-white"
                >
                  Back to Home
                </button>
                <button
                  onClick={() => router.push(`/section/${slug}/issue/${index}?r=${reportId}`)}
                  className="btn-press w-full rounded-full border-[1.5px] border-porch-accent bg-transparent px-7 py-3 text-[14.5px] font-semibold text-porch-accent"
                >
                  Back to Repair
                </button>
                <button
                  onClick={() => setShowShareFix(true)}
                  className="btn-press w-full rounded-full border-none bg-transparent px-7 py-3 text-[14.5px] font-semibold text-porch-text-secondary underline underline-offset-2"
                >
                  Share this win
                </button>
              </div>
            </div>
          )}

          {showShareFix && issue && (
            <ShareFixCard
              issueTitle={issue.title}
              savings={finishedRecord ? savingsFor(issue, finishedRecord) : null}
              onClose={() => setShowShareFix(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
