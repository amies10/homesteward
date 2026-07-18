"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sections, normalize, type ParsedReport, type Issue, type ReportSection } from "@/lib/sections";
import {
  saveReport,
  loadLatestReport,
  loadCompletions,
  loadIgnored,
  loadUserProfile,
  clearLocalReport,
  updateReport,
  updateProfileAddress,
} from "@/lib/data";
import Logo from "@/app/components/Logo";
import Modal from "@/app/components/Modal";
import ChatFAB from "@/app/components/ChatFAB";
import SectionIcon from "@/app/components/SectionIcon";
import { CheckIcon, ChevronRightIcon, PlusIcon, SettingsIcon, UploadIcon } from "@/app/components/icons";

const SEVERITY_ORDER: Record<Issue["severity"], number> = {
  safety: 0, repair: 1, maintenance: 2, improvement: 3, fyi: 4,
};

const SEVERITY_STYLE: Record<Issue["severity"], { badge: string; label: string }> = {
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

export default function Dashboard() {
  const router = useRouter();
  const [profileChecked, setProfileChecked] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [skillLevel, setSkillLevel] = useState<string | null>(null);
  const [report, setReport] = useState<ParsedReport | null>(null);
  const [completions, setCompletions] = useState<Record<string, unknown>>({});
  const [ignored, setIgnored] = useState<Record<string, true>>({});
  const [loading, setLoading] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [addingSectionLoading, setAddingSectionLoading] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      Promise.all([loadLatestReport(), loadCompletions(), loadIgnored()]).then(
        ([report, completions, ignored]) => {
          if (report) setReport(report);
          setCompletions(completions);
          setIgnored(ignored);
        }
      );
    });
  }, [router]);

  function activeIssuesFor(label: string, slug: string): Issue[] {
    if (!report) return [];
    const section = report.sections.find(
      (s) => s.slug === slug || normalize(s.name) === normalize(label)
    );
    if (!section) return [];
    return section.issues.filter(
      (issue, i) => !issue.deleted && !completions[`${slug}-${i}`] && !ignored[`${slug}-${i}`]
    );
  }

  function navigateToSection(slug: string) {
    if (selectedSlug) return;
    setSelectedSlug(slug);
    setTimeout(() => router.push(`/section/${slug}`), 600);
  }

  async function handleAddSection() {
    if (!newSectionName.trim() || !report) return;
    setAddingSectionLoading(true);

    const name = newSectionName.trim();
    const base = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
    const taken = new Set([
      ...sections.map((s) => s.slug),
      ...report.sections.filter((s) => s.slug).map((s) => s.slug!),
    ]);
    let slug = base;
    let n = 2;
    while (taken.has(slug)) { slug = `${base}-${n}`; n++; }

    const newSection: ReportSection = {
      name,
      description: newSectionDesc.trim() || undefined,
      slug,
      userAdded: true,
      issues: [],
    };
    const newReport: ParsedReport = { ...report, sections: [...report.sections, newSection] };
    await updateReport(newReport);
    setReport(newReport);
    setShowAddSection(false);
    setNewSectionName("");
    setNewSectionDesc("");
    setAddingSectionLoading(false);
  }

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setReport(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/parse-report", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setReport(data);
      await saveReport(data, file.name);
      if (data.propertyAddress) {
        setAddress(data.propertyAddress);
        await updateProfileAddress(data.propertyAddress);
      }
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 1800);
      setShowSummaryModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const allSectionRows = [
    ...sections.map((section) => ({
      slug: section.slug,
      name: report?.sections.find((s) => s.slug === section.slug || normalize(s.name) === normalize(section.label))?.name ?? section.label,
      desc: section.description,
      custom: false,
    })),
    ...(report?.sections.filter((s) => s.userAdded && s.slug).map((s) => ({
      slug: s.slug!,
      name: s.name,
      desc: s.description ?? "Custom section",
      custom: true,
    })) ?? []),
  ];

  if (!profileChecked) return null;

  return (
    <div className="min-h-screen bg-porch-bg pb-12 text-porch-text">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-porch-border bg-porch-surface px-5 py-4">
        <Logo size={34} wordmarkSize={20} />
        <div className="flex items-center gap-2.5">
          <Link href="/completed" className="text-[13px] font-semibold text-porch-text-secondary no-underline">
            Completed Fixes
          </Link>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            aria-label="Upload new report"
            className="btn-press relative flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border-none bg-porch-accent-tint disabled:opacity-60"
          >
            {justUploaded ? (
              <CheckIcon size={16} color="#3E7A4F" strokeWidth={2.4} />
            ) : loading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-porch-accent border-t-transparent" />
            ) : (
              <UploadIcon size={16} />
            )}
          </button>
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

      <div className="px-5 pb-1 pt-6">
        <div className="rounded-2xl border border-porch-border bg-porch-surface p-5 shadow-[0_1px_2px_rgba(38,34,32,0.03)]">
          <div className="mb-0.5 text-[15px] text-[#6B5F55]">{greeting()}</div>
          <div className="font-display text-[22px] font-semibold text-porch-text">
            {address || "Your Home"}
          </div>
          <div className="mt-4 flex gap-2.5">
            <button
              onClick={() => setShowSummaryModal(true)}
              disabled={!report}
              className="btn-press flex-1 rounded-[10px] border border-porch-border-input bg-porch-surface py-[11px] text-sm font-medium text-porch-text disabled:cursor-not-allowed disabled:opacity-50"
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

      <div className="flex items-center justify-between gap-2.5 px-5 pb-2.5 pt-7">
        <div className="font-display text-xl font-semibold text-porch-text">What are we working on?</div>
        <button
          onClick={() => setShowAddSection(true)}
          disabled={!report}
          className="btn-press flex shrink-0 items-center gap-1.5 border-none bg-transparent p-0 text-[13.5px] font-semibold text-porch-accent disabled:opacity-40"
        >
          <PlusIcon />
          Add Section
        </button>
      </div>

      {!report ? (
        <div className="mx-5 mt-2 rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
          <p className="text-sm text-porch-text-secondary">
            Upload an inspection report using the icon above to get started.
          </p>
        </div>
      ) : (
        allSectionRows.map((row) => {
          const activeIssues = activeIssuesFor(row.name, row.slug);
          const urgent = activeIssues.some((i) => i.severity === "safety");
          const selected = selectedSlug === row.slug;
          return (
            <div key={row.slug} className="px-5 py-1.5">
              <a
                href={`/section/${row.slug}`}
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
                    {urgent && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-porch-urgent" />}
                  </div>
                  <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-porch-text-secondary">
                    {row.desc}
                  </div>
                </div>
                <ChevronRightIcon size={16} />
              </a>
            </div>
          );
        })
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
            className="mb-3.5 w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
          />
          <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Description</label>
          <input
            type="text"
            value={newSectionDesc}
            onChange={(e) => setNewSectionDesc(e.target.value)}
            placeholder="What's covered here?"
            className="mb-[18px] w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
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

      {showSummaryModal && report && (() => {
        const allIssues = report.sections.flatMap((s) => s.issues);
        const severityCounts = { safety: 0, repair: 0, maintenance: 0, improvement: 0, fyi: 0 } as Record<Issue["severity"], number>;
        for (const issue of allIssues) severityCounts[issue.severity]++;
        const top3 = [...allIssues]
          .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
          .slice(0, 3);
        return (
          <Modal onClose={() => setShowSummaryModal(false)} maxWidth={400} maxHeight="75vh">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="font-display text-lg font-semibold text-porch-text">Inspection Summary</span>
            </div>
            {report.propertyAddress && (
              <p className="mb-3 text-sm text-porch-text-secondary">{report.propertyAddress}</p>
            )}
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-[10px] bg-porch-bg px-4 py-3">
                <p className="font-display text-2xl font-semibold text-porch-text">{allIssues.length}</p>
                <p className="mt-0.5 text-xs text-porch-text-secondary">Total issues</p>
              </div>
              <div className="rounded-[10px] bg-porch-bg px-4 py-3">
                <p className="font-display text-2xl font-semibold text-porch-text">{report.sections.length}</p>
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
            {top3.length > 0 && (
              <div className="mb-5 border-t border-[#ECE0D8] pt-4">
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-porch-text-tertiary">
                  Top Priority Issues
                </p>
                <ul className="space-y-2.5">
                  {top3.map((issue, i) => {
                    const style = SEVERITY_STYLE[issue.severity];
                    return (
                      <li key={i} className="flex items-start justify-between gap-3">
                        <span className="text-sm leading-snug text-porch-text">{issue.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                          {style.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <button
              onClick={() => setShowSummaryModal(false)}
              className="btn-press w-full rounded-[10px] border-none bg-porch-accent py-3 text-sm font-semibold text-white"
            >
              View My Home
            </button>
            <button
              onClick={() => { setShowSummaryModal(false); setShowClearConfirm(true); }}
              className="mt-3 w-full text-center text-xs text-porch-text-tertiary underline underline-offset-2"
            >
              Clear report
            </button>
          </Modal>
        );
      })()}

      {showClearConfirm && (
        <Modal onClose={() => setShowClearConfirm(false)}>
          <p className="mb-1 text-sm font-semibold text-porch-text">Clear report?</p>
          <p className="mb-5 text-sm leading-relaxed text-porch-text-secondary">
            This will remove your uploaded report and all section data. Completed fixes will not be affected.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                clearLocalReport();
                setReport(null);
                setError(null);
                setShowClearConfirm(false);
              }}
              className="btn-press rounded-[10px] border-none bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Yes, Clear Report
            </button>
          </div>
        </Modal>
      )}

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
            issueCount: activeIssuesFor(row.name, row.slug).length,
          })),
        }}
      />
    </div>
  );
}
