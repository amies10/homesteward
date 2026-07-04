"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  sections,
  normalize,
  diyKey,
  type ParsedReport,
  type IssueDetails,
  type StoredChatMessage,
} from "@/lib/sections";
import { loadLatestReport, loadIssueDetails, saveIssueDetails } from "@/lib/data";
import MicButton from "@/app/components/MicButton";

export default function DIYPage({
  params,
}: {
  params: Promise<{ slug: string; issueIndex: string }>;
}) {
  const { slug, issueIndex } = use(params);
  const index = parseInt(issueIndex, 10);
  const sectionConfig = sections.find((s) => s.slug === slug);

  const [issue, setIssue] = useState<
    ParsedReport["sections"][0]["issues"][0] | null
  >(null);
  const [issueDetails, setIssueDetails] = useState<IssueDetails | null>(null);
  const [checkedMaterials, setCheckedMaterials] = useState<
    Record<number, boolean>
  >({});
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({});
  const [chatMessages, setChatMessages] = useState<StoredChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    previewUrl: string;
  } | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [showRefineModal, setShowRefineModal] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLatestReport().then((report) => {
      if (!report) return;
      const reportSection = report.sections.find(
        (s) =>
          s.slug === slug ||
          (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
      );
      setIssue(reportSection?.issues[index] ?? null);
    });

    loadIssueDetails(slug, index).then((details) => {
      if (details) setIssueDetails(details);
    });

    const mKey = diyKey(slug, index, "materials");
    const sKey = diyKey(slug, index, "steps");
    const cKey = diyKey(slug, index, "chat");

    try {
      const m = localStorage.getItem(mKey);
      if (m) setCheckedMaterials(JSON.parse(m));
      const s = localStorage.getItem(sKey);
      if (s) setCheckedSteps(JSON.parse(s));
      const c = localStorage.getItem(cKey);
      if (c) setChatMessages(JSON.parse(c));
    } catch {}
  }, [slug, index, sectionConfig]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  function toggleMaterial(i: number) {
    const next = { ...checkedMaterials, [i]: !checkedMaterials[i] };
    setCheckedMaterials(next);
    localStorage.setItem(diyKey(slug, index, "materials"), JSON.stringify(next));
  }

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
      const base64 = dataUrl.split(",")[1];
      setPendingImage({
        base64,
        mimeType: file.type,
        previewUrl: dataUrl,
      });
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
    localStorage.setItem(
      diyKey(slug, index, "chat"),
      JSON.stringify(updatedMessages)
    );
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
      localStorage.setItem(
        diyKey(slug, index, "chat"),
        JSON.stringify(withReply)
      );
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : "Failed to get response"
      );
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
      setCheckedMaterials({});
      setCheckedSteps({});
      localStorage.removeItem(diyKey(slug, index, "materials"));
      localStorage.removeItem(diyKey(slug, index, "steps"));
      setShowRefineModal(false);
      setRefineFeedback("");
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Refinement failed");
    } finally {
      setRefining(false);
    }
  }

  const materials = issueDetails?.materialsList ?? [];
  const steps = issueDetails?.stepByStepPlan ?? [];
  const materialsCheckedCount = materials.filter((_, i) => checkedMaterials[i]).length;
  const stepsCheckedCount = steps.filter((_, i) => checkedSteps[i]).length;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center gap-4">
            <Link
              href={`/section/${slug}/issue/${index}`}
              className="shrink-0 text-sm text-stone-400 transition-colors hover:text-stone-600"
            >
              ← {issue?.title ?? "Issue"}
            </Link>
            <div className="h-4 w-px bg-stone-200" />
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              DIY Walkthrough
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-6 py-10">
        {/* Materials */}
        {materials.length > 0 && (
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-900">
                Materials &amp; Tools
              </p>
              <span className="text-xs text-stone-400">
                {materialsCheckedCount}/{materials.length} gathered
              </span>
            </div>
            <ul className="space-y-2">
              {materials.map((m, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!checkedMaterials[i]}
                      onChange={() => toggleMaterial(i)}
                      className="h-4 w-4 rounded border-stone-300 accent-stone-800"
                    />
                    <span
                      className={`flex-1 text-sm ${
                        checkedMaterials[i]
                          ? "text-stone-400 line-through"
                          : "text-stone-700"
                      }`}
                    >
                      {m.item}
                    </span>
                    <span className="shrink-0 text-xs text-stone-400">
                      {m.estimatedCost}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        {steps.length > 0 && (
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-stone-900">
                Step-by-Step Plan
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setShowRefineModal(true); setRefineError(null); }}
                  className="text-xs text-stone-400 underline underline-offset-2 hover:text-stone-600"
                >
                  Refine This Plan
                </button>
                <span className="text-xs text-stone-400">
                  {stepsCheckedCount}/{steps.length} done
                </span>
              </div>
            </div>
            <ol className="space-y-3">
              {steps.map((step, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!checkedSteps[i]}
                      onChange={() => toggleStep(i)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 accent-stone-800"
                    />
                    <span
                      className={`text-sm leading-relaxed ${
                        checkedSteps[i]
                          ? "text-stone-400 line-through"
                          : "text-stone-700"
                      }`}
                    >
                      {step}
                    </span>
                  </label>
                </li>
              ))}
            </ol>
          </div>
        )}

        {materials.length === 0 && steps.length === 0 && (
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-stone-500">
              No DIY plan generated yet.{" "}
              <Link
                href={`/section/${slug}/issue/${index}`}
                className="text-stone-700 underline underline-offset-2"
              >
                Go back and click "Generate DIY Plan"
              </Link>{" "}
              to create one.
            </p>
          </div>
        )}

        {/* Chat */}
        <div className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-6 py-4">
            <p className="text-sm font-semibold text-stone-900">
              Ask a Question
            </p>
            <p className="mt-0.5 text-xs text-stone-400">
              Get expert guidance on this specific repair.
            </p>
          </div>

          {/* Message history */}
          <div className="max-h-96 overflow-y-auto px-6 py-4">
            {chatMessages.length === 0 && !chatLoading && (
              <p className="text-center text-xs text-stone-400">
                No messages yet. Ask a question below.
              </p>
            )}
            <div className="space-y-3">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-stone-900 text-white"
                        : "border border-stone-200 bg-stone-50 text-stone-700"
                    }`}
                  >
                    {msg.imageBase64 && (
                      <img
                        src={`data:${msg.imageMimeType};base64,${msg.imageBase64}`}
                        alt="Uploaded"
                        className="mb-2 max-h-48 rounded object-contain"
                      />
                    )}
                    {msg.text && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {msg.text}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-2.5">
                    <p className="text-sm text-stone-400">Thinking…</p>
                  </div>
                </div>
              )}
              {chatError && (
                <p className="text-center text-xs text-red-500">{chatError}</p>
              )}
              <div ref={chatBottomRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="border-t border-stone-100 px-6 py-4">
            {pendingImage && (
              <div className="mb-2 flex items-center gap-2">
                <img
                  src={pendingImage.previewUrl}
                  alt="Pending"
                  className="h-12 w-12 rounded object-cover"
                />
                <button
                  onClick={() => setPendingImage(null)}
                  className="text-xs text-stone-400 hover:text-stone-600"
                >
                  Remove
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
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
                placeholder="Ask a question about this repair…"
                disabled={chatLoading}
                className="flex-1 rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none disabled:opacity-50"
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleImageSelect}
              />
              <MicButton
                onTranscript={(t) => setInputText((prev) => prev ? `${prev} ${t}` : t)}
                disabled={chatLoading}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={chatLoading}
                title="Attach photo"
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-500 transition-colors hover:bg-stone-50 disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
              </button>
              <button
                onClick={sendMessage}
                disabled={chatLoading || (!inputText.trim() && !pendingImage)}
                className="rounded-md border border-stone-800 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </main>

      {showRefineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white shadow-lg">
            <div className="border-b border-stone-100 px-6 py-4">
              <p className="text-sm font-semibold text-stone-900">Refine This Plan</p>
              <p className="mt-0.5 text-xs text-stone-400">
                Describe what you found or what isn&apos;t working with the current plan.
              </p>
            </div>
            <div className="px-6 py-5">
              <textarea
                value={refineFeedback}
                onChange={(e) => setRefineFeedback(e.target.value)}
                placeholder="e.g. The shutoff valve isn't where the plan says. The tile I need to remove is larger than expected. I don't have a tile saw — what's the alternative?"
                rows={5}
                autoFocus
                className="w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <span />
                <MicButton
                  onTranscript={(t) => setRefineFeedback((prev) => prev ? `${prev} ${t}` : t)}
                  disabled={refining}
                />
              </div>
              {refineError && (
                <p className="mt-1 text-xs text-red-600">{refineError}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-4">
              <button
                onClick={() => { setShowRefineModal(false); setRefineFeedback(""); setRefineError(null); }}
                disabled={refining}
                className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRefine}
                disabled={!refineFeedback.trim() || refining}
                className="rounded-md border border-stone-800 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refining ? "Regenerating…" : "Regenerate Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
