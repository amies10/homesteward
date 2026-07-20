"use client";

import { useEffect, useState } from "react";
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
import MarkdownProse from "@/app/components/MarkdownProse";
import { useProgressiveStatus } from "@/app/components/useProgressiveStatus";
import { shareText } from "@/lib/share";
import { ShareIcon } from "@/app/components/icons";

const SEVERITY_STYLE: Record<Issue["severity"], { badge: string; label: string }> = {
  safety: { badge: "bg-red-100 text-red-700", label: "Safety" },
  repair: { badge: "bg-orange-100 text-orange-700", label: "Repair" },
  maintenance: { badge: "bg-amber-100 text-amber-700", label: "Maintenance" },
  improvement: { badge: "bg-blue-100 text-blue-700", label: "Improvement" },
  fyi: { badge: "bg-stone-100 text-stone-500", label: "FYI" },
};

interface CreditItem {
  key: string;
  slug: string;
  reportId: string;
  issueIndex: number;
  issue: Issue;
}

function formatDollars(n: number): string {
  return "$" + n.toLocaleString("en-US");
}

export default function CreditRequestPage() {
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [completions, setCompletions] = useState<Record<string, CompletionRecord>>({});
  const [ignored, setIgnored] = useState<Record<string, true>>({});
  const [loaded, setLoaded] = useState(false);

  // Per-item selection overrides — an item without an entry here falls back
  // to its severity-based default (see `isSelected` below), so there's no
  // need to pre-populate this map once issues load.
  const [selectionOverrides, setSelectionOverrides] = useState<Record<string, boolean>>({});
  const [propertyAddress, setPropertyAddress] = useState("");
  const [buyerName, setBuyerName] = useState("");
  // Only set once the user types into the requested-credit field; until then
  // the field displays the live computed default (see `requestedTotal` below).
  const [requestedTotalOverride, setRequestedTotalOverride] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultDoc, setResultDoc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateStatus = useProgressiveStatus(generating, [
    ["Drafting your request…", 0],
    ["Almost done…", 6000],
  ]);

  useEffect(() => {
    Promise.all([loadReports(), loadCompletions(), loadIgnored()]).then(([loadedReports, c, ig]) => {
      setReports(loadedReports);
      setCompletions(c);
      setIgnored(ig);
      setLoaded(true);
    });
  }, []);

  const mergedSections = mergeReports(reports);

  const items: CreditItem[] = mergedSections.flatMap((section) =>
    section.issues
      .filter((ref) => !ref.issue.deleted)
      .filter((ref) => {
        const key = issueKey(ref.reportId, section.slug, ref.issueIndex);
        return !completions[key] && !ignored[key];
      })
      .map((ref) => ({
        key: issueKey(ref.reportId, section.slug, ref.issueIndex),
        slug: section.slug,
        reportId: ref.reportId,
        issueIndex: ref.issueIndex,
        issue: ref.issue,
      }))
  );

  // Pre-checked by default when severity is safety/repair, unless the user
  // has explicitly toggled that item.
  function isSelected(item: CreditItem): boolean {
    const override = selectionOverrides[item.key];
    if (override !== undefined) return override;
    return item.issue.severity === "safety" || item.issue.severity === "repair";
  }

  const selectedItems = items.filter(isSelected);
  const selectedTotal = selectedItems.reduce((sum, item) => {
    const mid = parseMidpoint(item.issue.costEstimatePro);
    return sum + (mid ?? 0);
  }, 0);

  // Live default: rounded to the nearest $100, recomputed every render from
  // the current selection. Overridden the moment the user types their own
  // value (see requestedTotalOverride).
  const defaultRequestedTotal = selectedTotal > 0 ? String(Math.round(selectedTotal / 100) * 100) : "";
  const requestedTotal = requestedTotalOverride ?? defaultRequestedTotal;

  function toggleItem(key: string, item: CreditItem) {
    setSelectionOverrides((prev) => ({ ...prev, [key]: !isSelected(item) }));
  }

  async function handleGenerate() {
    if (selectedItems.length === 0 || !requestedTotal.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-credit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyAddress: propertyAddress.trim() || undefined,
          buyerName: buyerName.trim() || undefined,
          requestedTotal: requestedTotal.trim(),
          issues: selectedItems.map((item) => ({
            title: item.issue.title,
            description: item.issue.description,
            severity: item.issue.severity,
            costEstimatePro: item.issue.costEstimatePro ?? undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResultDoc(data.document);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate document");
    } finally {
      setGenerating(false);
    }
  }

  function handleStartOver() {
    setResultDoc(null);
    setError(null);
  }

  async function handleShare() {
    if (!resultDoc) return;
    try {
      const result = await shareText("Seller credit request", resultDoc);
      if (result === "copied") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }

  const inputClass =
    "w-full rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1";

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <AppHeader backHref="/" backLabel="Dashboard" />

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Seller Credit Request</span>
        <p className="mt-1 text-[13.5px] leading-relaxed text-porch-text-secondary">
          Draft a document requesting a credit for open issues, based on your report&apos;s findings.
        </p>
      </div>

      {!loaded ? (
        <PageSkeleton />
      ) : resultDoc ? (
        <div className="px-5 pb-1 pt-3">
          <div className="rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <MarkdownProse text={resultDoc} />
          </div>
          <div className="mt-3.5 flex gap-2.5">
            <button
              onClick={handleShare}
              className="btn-press flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-porch-border-input bg-porch-surface py-3 text-sm font-semibold text-porch-text"
            >
              <ShareIcon size={14} />
              {copied ? "Copied ✓" : "Copy / Share"}
            </button>
            <button
              onClick={handleStartOver}
              className="btn-press flex-1 rounded-[10px] border-none bg-porch-accent py-3 text-sm font-semibold text-white"
            >
              Start over
            </button>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="mx-5 mt-4 rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
          <p className="text-sm text-porch-text-secondary">No open issues to include yet.</p>
        </div>
      ) : (
        <div className="px-5 pb-1 pt-3">
          <div className="space-y-2.5 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">
                Property address <span className="font-normal text-porch-text-tertiary">(optional)</span>
              </label>
              <input
                type="text"
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="123 Main St, Anytown, ST"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">
                Buyer name <span className="font-normal text-porch-text-tertiary">(optional)</span>
              </label>
              <input
                type="text"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Your name"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-3.5 mb-2 text-[13.5px] font-semibold text-porch-text">
            Include in the request ({selectedItems.length} selected)
          </div>
          <div className="space-y-2">
            {items.map((item) => {
              const style = SEVERITY_STYLE[item.issue.severity];
              const checked = isSelected(item);
              return (
                <label
                  key={item.key}
                  className="btn-press flex cursor-pointer items-start gap-3 rounded-2xl border border-porch-border bg-porch-surface px-[18px] py-3.5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleItem(item.key, item)}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-porch-accent focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[14.5px] font-semibold leading-snug text-porch-text">{item.issue.title}</span>
                      <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-medium ${style.badge}`}>
                        {style.label}
                      </span>
                    </div>
                    <div className="mt-1.5 text-[13px] text-porch-text-secondary">
                      Pro <strong className="font-semibold text-porch-text">{item.issue.costEstimatePro ?? "—"}</strong>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="sticky bottom-0 mt-4 rounded-2xl border border-porch-border bg-porch-surface p-[18px] shadow-[0_-2px_10px_rgba(38,34,32,0.06)]">
            <div className="mb-2.5 text-[13.5px] text-porch-text-secondary">
              Total of selected estimates:{" "}
              <strong className="font-semibold text-porch-text">
                {selectedTotal > 0 ? `~${formatDollars(selectedTotal)}` : "—"}
              </strong>
            </div>
            <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Requested credit</label>
            <input
              type="text"
              inputMode="numeric"
              value={requestedTotal}
              onChange={(e) => setRequestedTotalOverride(e.target.value)}
              placeholder="e.g. 3200"
              className={inputClass}
            />
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <button
              onClick={handleGenerate}
              disabled={selectedItems.length === 0 || !requestedTotal.trim() || generating}
              className="btn-press mt-3.5 flex w-full items-center justify-center rounded-[10px] border-none bg-porch-accent py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? generateStatus ?? "Generating…" : "Generate document"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
