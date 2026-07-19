"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  sections,
  normalize,
  diyKey,
  type ParsedReport,
  type IssueDetails,
  type StoredChatMessage,
  type CompletionRecord,
} from "@/lib/sections";
import { loadLatestReport, loadIssueDetails, saveIssueDetails, saveCompletion } from "@/lib/data";
import { loadToolbox, addTools, isToolHeuristic } from "@/lib/toolbox";
import { signPaths } from "@/lib/storage";
import ToolSuggestSheet from "@/app/components/ToolSuggestSheet";
import MicButton from "@/app/components/MicButton";
import Modal from "@/app/components/Modal";
import BottomSheet from "@/app/components/BottomSheet";
import AssistantAvatar from "@/app/components/AssistantAvatar";
import { renderInlineMarkdown } from "@/app/components/inlineMarkdown";
import { CameraIcon, CheckIcon, ChevronDownIcon, ChevronLeftIcon, PlayIcon, SendIcon, SettingsIcon, XIcon } from "@/app/components/icons";
import HomeButton from "@/app/components/HomeButton";

export default function DIYPage({
  params,
}: {
  params: Promise<{ slug: string; issueIndex: string }>;
}) {
  const router = useRouter();
  const { slug, issueIndex } = use(params);
  const index = parseInt(issueIndex, 10);
  const sectionConfig = sections.find((s) => s.slug === slug);

  const [issue, setIssue] = useState<ParsedReport["sections"][0]["issues"][0] | null>(null);
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
  const [suggestedTools, setSuggestedTools] = useState<string[]>([]);
  const [ownedTools, setOwnedTools] = useState<string[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [finishPressed, setFinishPressed] = useState(false);
  const [cardDragDx, setCardDragDx] = useState(0);
  const [cardDragging, setCardDragging] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(375);

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
    setViewportWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);

  useEffect(() => {
    loadLatestReport().then((report) => {
      if (!report) return;
      const reportSection = report.sections.find(
        (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
      );
      setIssue(reportSection?.issues[index] ?? null);
    });

    loadIssueDetails(slug, index).then((details) => {
      if (details) setIssueDetails(details);
    });

    loadToolbox().then((tools) => setOwnedTools(tools.map((t) => t.toolName)));

    const sKey = diyKey(slug, index, "steps");
    const cKey = diyKey(slug, index, "chat");

    try {
      const s = localStorage.getItem(sKey);
      if (s) setCheckedSteps(JSON.parse(s));
      const c = localStorage.getItem(cKey);
      if (c) setChatMessages(JSON.parse(c));
    } catch {}
  }, [slug, index, sectionConfig]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  function toggleStep(i: number) {
    const next = { ...checkedSteps, [i]: !checkedSteps[i] };
    setCheckedSteps(next);
    localStorage.setItem(diyKey(slug, index, "steps"), JSON.stringify(next));
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

  async function sendMessage() {
    if (!inputText.trim() && !pendingImage) return;
    if (!issue) return;

    const userMsg: StoredChatMessage = {
      role: "user",
      text: inputText.trim(),
      imageBase64: pendingImage?.base64,
      imageMimeType: pendingImage?.mimeType,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    localStorage.setItem(diyKey(slug, index, "chat"), JSON.stringify(updatedMessages));
    setInputText("");
    setPendingImage(null);
    setChatLoading(true);
    setChatError(null);

    try {
      const res = await fetch("/api/diy-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          issueTitle: issue.title,
          issueDescription: issue.description,
          severity: issue.severity,
          photoUrls: issueDetails?.photoPaths?.length
            ? Object.values(await signPaths(issueDetails.photoPaths))
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      const assistantMsg: StoredChatMessage = {
        role: "assistant",
        text: data.text,
        timestamp: new Date().toISOString(),
      };

      const withReply = [...updatedMessages, assistantMsg];
      setChatMessages(withReply);
      localStorage.setItem(diyKey(slug, index, "chat"), JSON.stringify(withReply));
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setChatLoading(false);
    }
  }

  async function handleRefine() {
    if (!refineFeedback.trim() || !issue || !issueDetails) return;
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refinement failed");
      const updated: IssueDetails = {
        ...issueDetails,
        materialsList: data.materialsList,
        stepByStepPlan: data.stepByStepPlan,
      };
      setIssueDetails(updated);
      await saveIssueDetails(slug, index, updated);
      setCheckedSteps({});
      setStepExpanded({});
      setStepDetail({});
      localStorage.removeItem(diyKey(slug, index, "steps"));
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
      setStepDetail((prev) => ({ ...prev, [i]: res.ok ? data.detail : "Couldn't load more detail right now." }));
      setStepExpanded((prev) => ({ ...prev, [i]: true }));
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

  // Same completion flow as "Mark as Complete" on the issue detail page
  // (lib/data.ts saveCompletion — always resolves, falling back to
  // localStorage-only if Supabase is unreachable, so no try/catch needed
  // here either, matching that page). Work Mode's finish doesn't collect a
  // difficulty rating, so completedBy is always "me" with no difficulty
  // (both optional on CompletionRecord).
  async function handleFinishRepair() {
    if (finishing) return;
    setFinishing(true);
    const record: CompletionRecord = {
      slug,
      issueIndex: index,
      completedBy: "me",
      completedAt: new Date().toISOString(),
    };
    await saveCompletion(record);
    setFinishing(false);

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
  const steps = issueDetails?.stepByStepPlan ?? [];
  const stepsCheckedCount = steps.filter((_, i) => checkedSteps[i]).length;

  useEffect(() => {
    stepsLengthRef.current = steps.length;
  }, [steps.length]);

  const chatBody = (
    <>
      {chatMessages.length === 0 && !chatLoading && (
        <p className="pt-6 text-center text-[13.5px] text-porch-text-faint">
          No messages yet — ask below and I&apos;ll walk through it with you.
        </p>
      )}
      <div className="space-y-3">
        {chatMessages.map((msg, i) => (
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
        ))}
        {chatLoading && (
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
          <button onClick={() => setPendingImage(null)} className="text-xs text-porch-text-tertiary">
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
          onClick={sendMessage}
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
        <Link href={`/section/${slug}/issue/${index}`} className="flex min-w-0 items-center gap-1.5 text-[13.5px] text-porch-text-secondary no-underline">
          <ChevronLeftIcon size={15} />
          <span className="truncate">{issue?.title ?? "Issue"}</span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          {!workModeOpen && <HomeButton size={18} />}
          <Link href="/settings" aria-label="Settings" className="flex items-center p-1">
            <SettingsIcon size={18} />
          </Link>
        </div>
      </header>

      <div className="sticky top-[42px] z-[9] flex items-center justify-between gap-3 border-b border-porch-border bg-porch-bg px-5 py-3.5">
        <span className="font-display text-[21px] font-semibold text-porch-text">DIY Walkthrough</span>
        <button
          onClick={() => { setWorkModeOpen(true); setStepIndex(0); setShowCongrats(false); }}
          disabled={steps.length === 0}
          className="btn-press flex shrink-0 items-center gap-1.5 rounded-full border-none bg-porch-accent px-4 py-2.5 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlayIcon />
          Enter Work Mode
        </button>
      </div>

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
                {materials.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 border-t border-[#F2EBE1] py-2.5">
                    <span className="flex-1 text-sm leading-relaxed text-porch-text">{m.item}</span>
                    <span className="shrink-0 text-[13px] text-porch-text-tertiary">{m.estimatedCost}</span>
                  </div>
                ))}
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
                    className="border-none bg-transparent p-0 text-[12.5px] font-semibold text-porch-accent underline"
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
              <Link href={`/section/${slug}/issue/${index}`} className="text-porch-accent underline underline-offset-2">
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
            className="mt-3.5 w-full resize-y rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
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
                transition: cardDragging ? "none" : "transform 0.32s cubic-bezier(0.2,0.8,0.2,1)",
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
                            className="mt-4 border-none bg-transparent p-0 text-sm font-semibold text-porch-accent underline"
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
                    onClick={handleFinishRepair}
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
                  onClick={() => router.push(`/section/${slug}/issue/${index}`)}
                  className="btn-press w-full rounded-full border-[1.5px] border-porch-accent bg-transparent px-7 py-3 text-[14.5px] font-semibold text-porch-accent"
                >
                  Back to Repair
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
