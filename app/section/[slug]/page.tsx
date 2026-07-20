"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  sections,
  normalize,
  mergeReports,
  issueKey,
  SKILL_RANK,
  type StoredReport,
  type Issue,
  type MergedIssueRef,
  type CompletionRecord,
  type UserProfile,
} from "@/lib/sections";
import {
  loadReports,
  loadCompletions,
  loadIgnored,
  loadUserProfile,
  loadAllMyCompletions,
  saveIgnore,
  removeIgnore,
  updateReportSections,
} from "@/lib/data";
import { computeEffectiveSkill } from "@/lib/skill";
import { loadPropertyDetails } from "@/lib/property";
import { loadToolbox } from "@/lib/toolbox";
import { propertyContextLines } from "@/lib/ai-context";
import Modal from "@/app/components/Modal";
import { PageSkeleton } from "@/app/components/Skeleton";
import ChatFAB from "@/app/components/ChatFAB";
import { ChevronLeftIcon, PencilIcon, PlusIcon, SearchIcon, SettingsIcon, TrashIcon, XIcon } from "@/app/components/icons";
import HomeButton from "@/app/components/HomeButton";
import CalendarButton from "@/app/components/CalendarButton";

const TYPE_LABEL: Record<Issue["severity"], string> = {
  safety: "Safety",
  repair: "Repair",
  maintenance: "Maintenance",
  improvement: "Improvement",
  fyi: "FYI",
};

function group(done: boolean, ignored: boolean) {
  if (done) return 2;
  if (ignored) return 1;
  return 0;
}

const SEVERITY_ORDER: Record<string, number> = {
  safety: 0, repair: 1, maintenance: 2, improvement: 3, fyi: 4,
};

const SEVERITY_OPTIONS = [
  { value: "safety",      label: "Safety" },
  { value: "repair",      label: "Repair" },
  { value: "maintenance", label: "Maintenance" },
  { value: "improvement", label: "Improvement" },
  { value: "fyi",         label: "FYI" },
] as const;

function refKey(ref: MergedIssueRef): string {
  return `${ref.reportId}:${ref.issueIndex}`;
}

export default function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const router = useRouter();
  const { slug } = use(params);
  const { q } = use(searchParams);

  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);
  const [filter, setFilter] = useState(q ?? "");
  const [reports, setReports]         = useState<StoredReport[]>([]);
  const [completions, setCompletions] = useState<Record<string, CompletionRecord>>({});
  const [ignored, setIgnored]         = useState<Record<string, true>>({});
  const [effectiveSkillLevel, setEffectiveSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [loaded, setLoaded]           = useState(false);
  const [propertyContext, setPropertyContext] = useState("");
  const [toolboxNames, setToolboxNames] = useState<string[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft]     = useState("");
  const [nameSaving, setNameSaving]   = useState(false);

  const [showIssueForm, setShowIssueForm]   = useState(false);
  const [editTarget, setEditTarget]         = useState<{ reportId: string; issueIndex: number } | null>(null);
  const [formTitle, setFormTitle]           = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSeverity, setFormSeverity]     = useState<Issue["severity"]>("maintenance");
  const [formNotes, setFormNotes]           = useState("");
  const [formSaving, setFormSaving]         = useState(false);

  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadReports(),
      loadCompletions(),
      loadIgnored(),
      loadUserProfile(),
      loadAllMyCompletions(),
    ]).then(([loadedReports, c, ig, profile, myCompletions]) => {
      setReports(loadedReports);
      setCompletions(c);
      setIgnored(ig);
      if (profile) {
        const lookupIssue = (reportId: string, issueSlug: string, index: number) => {
          const r = loadedReports.find((rp) => rp.id === reportId);
          const cfg = sections.find((sc) => sc.slug === issueSlug);
          const sec = r?.sections.find(
            (s) => s.slug === issueSlug || (cfg && normalize(s.name) === normalize(cfg.label))
          );
          return sec?.issues[index];
        };
        setEffectiveSkillLevel(computeEffectiveSkill(profile.skillLevel, myCompletions, lookupIssue).effective);
      }
      setLoaded(true);
    });

    loadPropertyDetails().then((property) => setPropertyContext(propertyContextLines(property)));
    loadToolbox().then((tools) => setToolboxNames(tools.map((t) => t.toolName)));
  }, []);

  const mergedSections = mergeReports(reports);
  const sectionConfig = sections.find((s) => s.slug === slug);
  const mergedSection = mergedSections.find((s) => s.slug === slug);
  const displayName = mergedSection?.name ?? sectionConfig?.label ?? slug;
  const displayDescription = mergedSection?.description ?? sectionConfig?.description;
  const showSourceBadge = reports.length > 1;
  const reportById = new Map(reports.map((r) => [r.id, r]));

  if (!sectionConfig && !loaded) return <PageSkeleton />;
  if (loaded && !sectionConfig && !mergedSection) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-porch-bg">
        <p className="text-sm text-porch-text-secondary">Section not found.</p>
      </div>
    );
  }

  const allRefs = mergedSection?.issues ?? [];
  const visibleRefs = allRefs.filter((ref) => !ref.issue.deleted);

  const sortedIssues = [...visibleRefs]
    .map((ref) => ({
      ref,
      done:      !!completions[issueKey(ref.reportId, slug, ref.issueIndex)],
      isIgnored: !!ignored[issueKey(ref.reportId, slug, ref.issueIndex)],
    }))
    .sort((a, b) => {
      const ga = group(a.done, a.isIgnored);
      const gb = group(b.done, b.isIgnored);
      if (ga !== gb) return ga - gb;
      if (ga === 0) return (SEVERITY_ORDER[a.ref.issue.severity] ?? 99) - (SEVERITY_ORDER[b.ref.issue.severity] ?? 99);
      return 0;
    });

  const activeCount  = sortedIssues.filter((x) => !x.done && !x.isIgnored).length;
  const doneCount    = sortedIssues.filter((x) => x.done).length;

  const trimmedFilter = filter.trim().toLowerCase();
  const filteredIssues = trimmedFilter
    ? sortedIssues.filter(
        ({ ref }) =>
          ref.issue.title.toLowerCase().includes(trimmedFilter) ||
          ref.issue.description.toLowerCase().includes(trimmedFilter)
      )
    : sortedIssues;

  function navigateToIssue(ref: MergedIssueRef) {
    if (selectedIssueKey) return;
    setSelectedIssueKey(refKey(ref));
    setTimeout(() => router.push(`/section/${slug}/issue/${ref.issueIndex}?r=${ref.reportId}`), 150);
  }

  async function handleIgnore(ref: MergedIssueRef) {
    const key = issueKey(ref.reportId, slug, ref.issueIndex);
    setIgnored((prev) => ({ ...prev, [key]: true }));
    await saveIgnore(ref.reportId, slug, ref.issueIndex);
  }

  async function handleUnignore(ref: MergedIssueRef) {
    const key = issueKey(ref.reportId, slug, ref.issueIndex);
    setIgnored((prev) => { const n = { ...prev }; delete n[key]; return n; });
    await removeIgnore(ref.reportId, slug, ref.issueIndex);
  }

  async function handleRename() {
    if (!nameDraft.trim() || reports.length === 0) return;
    setNameSaving(true);
    const trimmed = nameDraft.trim();
    let touched = false;
    const updates: Array<{ id: string; sections: typeof reports[0]["sections"] }> = [];
    for (const r of reports) {
      const idx = r.sections.findIndex(
        (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
      );
      if (idx !== -1) {
        const newSections = r.sections.map((s, i) => (i === idx ? { ...s, name: trimmed, slug } : s));
        updates.push({ id: r.id, sections: newSections });
        touched = true;
      }
    }
    if (!touched) {
      const base = reports[0];
      updates.push({ id: base.id, sections: [...base.sections, { name: trimmed, slug, issues: [] }] });
    }
    for (const u of updates) await updateReportSections(u.id, u.sections);
    setReports(await loadReports());
    setEditingName(false);
    setNameSaving(false);
  }

  function openEditForm(ref: MergedIssueRef) {
    setFormTitle(ref.issue.title);
    setFormDescription(ref.issue.description);
    setFormSeverity(ref.issue.severity);
    setFormNotes(ref.issue.notes ?? "");
    setEditTarget({ reportId: ref.reportId, issueIndex: ref.issueIndex });
    setShowIssueForm(true);
  }

  async function handleSaveIssueForm() {
    if (!formTitle.trim() || !formDescription.trim() || !editTarget) return;
    setFormSaving(true);
    const targetReport = reports.find((r) => r.id === editTarget.reportId);
    if (!targetReport) { setFormSaving(false); return; }
    const idx = targetReport.sections.findIndex(
      (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
    );
    if (idx === -1) { setFormSaving(false); return; }
    const newSections = targetReport.sections.map((s, si) => {
      if (si !== idx) return s;
      return {
        ...s,
        issues: s.issues.map((iss, ii) =>
          ii === editTarget.issueIndex
            ? {
                ...iss,
                title: formTitle.trim(),
                description: formDescription.trim(),
                severity: formSeverity,
                recommendedAction: formDescription.trim(),
                notes: formNotes.trim() || undefined,
              }
            : iss
        ),
      };
    });

    await updateReportSections(targetReport.id, newSections);
    setReports(await loadReports());
    setShowIssueForm(false);
    setEditTarget(null);
    setFormSaving(false);
  }

  async function handleDeleteIssue(ref: MergedIssueRef) {
    const targetReport = reports.find((r) => r.id === ref.reportId);
    if (!targetReport) return;
    const idx = targetReport.sections.findIndex(
      (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
    );
    if (idx === -1) return;
    const newSections = targetReport.sections.map((s, si) =>
      si !== idx
        ? s
        : { ...s, issues: s.issues.map((iss, ii) => (ii === ref.issueIndex ? { ...iss, deleted: true } : iss)) }
    );
    await updateReportSections(targetReport.id, newSections);
    setReports(await loadReports());
    setConfirmDeleteKey(null);
  }

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-[90px] text-porch-text">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-porch-border bg-porch-surface px-5 py-[18px]">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-porch-text-secondary no-underline">
          <ChevronLeftIcon />
          Dashboard
        </Link>
        <div className="flex items-center gap-1">
          <CalendarButton />
          <HomeButton />
          <Link href="/settings" aria-label="Settings" className="flex items-center justify-center p-1.5">
            <SettingsIcon />
          </Link>
          {reports.length > 0 && (
            <Link
              href={`/add-issue?section=${slug}`}
              className="btn-press flex items-center gap-1.5 rounded-[10px] border-none bg-porch-accent px-3.5 py-2 text-[13.5px] font-medium text-white no-underline"
            >
              <PlusIcon size={14} color="#FFFFFF" strokeWidth={2.2} />
              Add Issue
            </Link>
          )}
        </div>
      </header>

      <div className="px-5 pb-1 pt-[22px]">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setEditingName(false);
              }}
              autoFocus
              className="rounded-[10px] border border-porch-border-input bg-porch-surface px-3 py-1.5 font-display text-lg font-semibold text-porch-text focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
            />
            <button
              onClick={handleRename}
              disabled={nameSaving || !nameDraft.trim()}
              className="btn-press rounded-[8px] border-none bg-porch-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {nameSaving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditingName(false)} className="text-xs text-porch-text-tertiary">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-display text-[25px] font-semibold text-porch-text">{displayName}</span>
            {reports.length > 0 && (
              <button
                onClick={() => { setNameDraft(displayName); setEditingName(true); }}
                title="Rename section"
                aria-label="Edit section name"
                className="btn-press flex items-center rounded-[8px] p-2.5"
              >
                <PencilIcon />
              </button>
            )}
          </div>
        )}
        {displayDescription && (
          <div className="mt-1 text-sm leading-relaxed text-porch-text-secondary">{displayDescription}</div>
        )}
      </div>

      <div
        className={`px-5 pb-1 pt-3.5 text-[13px] ${
          activeCount === 0 ? "font-semibold text-porch-success" : "text-porch-text-tertiary"
        }`}
      >
        {activeCount === 0
          ? "All clear ✓ — nothing to look at here"
          : `${activeCount} thing${activeCount !== 1 ? "s" : ""} to look at · ${doneCount} taken care of`}
      </div>

      {loaded && reports.length > 0 && sortedIssues.length > 0 && (
        <div className="px-5 pb-1 pt-2">
          <div className="flex items-center gap-2 rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-2.5">
            <SearchIcon size={15} />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search issues..."
              className="flex-1 border-none bg-transparent text-sm text-porch-text outline-none placeholder:text-porch-text-tertiary"
            />
            {filter && (
              <button
                onClick={() => setFilter("")}
                aria-label="Clear search"
                className="flex items-center p-0.5 text-porch-text-tertiary"
              >
                <XIcon size={14} color="#A99C8B" />
              </button>
            )}
          </div>
        </div>
      )}

      {!loaded ? null : reports.length === 0 ? (
        <div className="mx-5 mt-4 rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
          <p className="text-sm text-porch-text-secondary">
            No inspection report uploaded yet.{" "}
            <Link href="/" className="text-porch-accent underline underline-offset-2">
              Go to the dashboard
            </Link>{" "}
            to upload one.
          </p>
        </div>
      ) : sortedIssues.length === 0 ? (
        <div className="mx-5 mt-4 rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-porch-success-bg">
            <span className="text-2xl text-porch-success">✓</span>
          </div>
          <p className="font-display text-[17px] font-semibold text-porch-text">All clear</p>
          <p className="mt-1 text-sm text-porch-text-secondary">
            Nothing needs your attention in this section right now.
          </p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="mx-5 mt-4 rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
          <p className="text-sm text-porch-text-secondary">No issues match &quot;{filter.trim()}&quot;.</p>
        </div>
      ) : (
        filteredIssues.map(({ ref, done, isIgnored }) => {
          const { issue } = ref;
          const key = refKey(ref);
          const dimmed = done || isIgnored;
          const skillTag =
            !done && !isIgnored && effectiveSkillLevel && issue.minimumSkillLevel
              ? SKILL_RANK[effectiveSkillLevel] >= SKILL_RANK[issue.minimumSkillLevel]
                ? { label: "DIY-friendly", cls: "text-porch-accent bg-porch-accent-tint" }
                : { label: "Pro recommended", cls: "text-porch-pro-text bg-porch-pro-bg" }
              : null;
          const sourceReport = reportById.get(ref.reportId);
          const sourceLabel = sourceReport?.documentType ?? sourceReport?.pdfFilename ?? "Report";

          return (
            <div key={key} className="px-5 py-2">
              <div
                style={{ opacity: dimmed ? 0.5 : 1 }}
                className="relative rounded-2xl border border-porch-border bg-porch-surface px-[18px] py-4 shadow-[0_1px_2px_rgba(38,34,32,0.03)]"
              >
                {selectedIssueKey === key && <div className="comet-ring" />}
                {issue.severity === "safety" && !dimmed && (
                  <span className="absolute left-[-1px] top-4 h-[22px] w-1 rounded-r-[3px] bg-porch-urgent" />
                )}
                <a
                  href={`/section/${slug}/issue/${ref.issueIndex}?r=${ref.reportId}`}
                  onClick={(e) => { e.preventDefault(); navigateToIssue(ref); }}
                  className="block text-inherit no-underline"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[15px] font-semibold leading-snug text-porch-text">{issue.title}</span>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                      {skillTag && (
                        <span className={`whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold ${skillTag.cls}`}>
                          {skillTag.label}
                        </span>
                      )}
                      {done && (
                        <span className="whitespace-nowrap rounded-full bg-porch-success-bg px-2.5 py-[3px] text-[11.5px] font-semibold text-porch-success">
                          Complete
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 text-[13.5px] leading-relaxed text-porch-text-secondary">{issue.description}</div>
                  {issue.notes && !dimmed && (
                    <p className="mt-1.5 text-xs italic leading-relaxed text-porch-text-tertiary">Note: {issue.notes}</p>
                  )}
                </a>

                <div className="mt-3 flex items-center gap-2.5">
                  <span className="rounded-full border border-porch-border bg-porch-surface px-2.5 py-[3px] text-xs font-medium text-[#6B5F55]">
                    {TYPE_LABEL[issue.severity]}
                  </span>
                  {issue.userAdded && (
                    <span className="rounded-full border border-porch-border px-2.5 py-[3px] text-xs text-porch-text-tertiary">
                      Added by you
                    </span>
                  )}
                  {showSourceBadge && (
                    <span
                      title={sourceLabel}
                      className="max-w-[110px] truncate rounded-full border border-porch-border bg-porch-bg px-2 py-[3px] text-[11px] text-porch-text-tertiary"
                    >
                      {sourceLabel}
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-2.5">
                    {issue.userAdded && !done && confirmDeleteKey !== key && (
                      <>
                        <button onClick={() => openEditForm(ref)} title="Edit" aria-label="Edit issue" className="flex items-center">
                          <PencilIcon size={13} />
                        </button>
                        <button onClick={() => setConfirmDeleteKey(key)} title="Delete" aria-label="Delete issue" className="flex items-center">
                          <TrashIcon />
                        </button>
                      </>
                    )}
                    {confirmDeleteKey === key ? (
                      <>
                        <button
                          onClick={() => handleDeleteIssue(ref)}
                          className="btn-press rounded-[8px] px-3 py-2.5 text-[12.5px] font-semibold text-red-600 underline"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmDeleteKey(null)}
                          className="btn-press rounded-[8px] px-3 py-2.5 text-[12.5px] font-semibold text-porch-text-tertiary underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      !done && (
                        <button
                          onClick={() => (isIgnored ? handleUnignore(ref) : handleIgnore(ref))}
                          className="btn-press rounded-[8px] px-3 py-2.5 text-[12.5px] font-semibold text-porch-text-faint underline underline-offset-2"
                        >
                          {isIgnored ? "Restore" : "Not now"}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      {showIssueForm && (
        <Modal onClose={() => { setShowIssueForm(false); setEditTarget(null); }} maxWidth={420}>
          <div className="mb-4 font-display text-lg font-semibold text-porch-text">Edit Issue</div>
          <div className="space-y-3.5">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Title</label>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Brief description of the issue"
                autoFocus
                className="w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What's the issue? Include any relevant details."
                rows={3}
                className="w-full resize-none rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Type</label>
              <select
                value={formSeverity}
                onChange={(e) => setFormSeverity(e.target.value as Issue["severity"])}
                className="w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
              >
                {SEVERITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">
                Notes <span className="font-normal text-porch-text-tertiary">(optional)</span>
              </label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Any additional context, photos to take, vendor info, etc."
                rows={2}
                className="w-full resize-none rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => { setShowIssueForm(false); setEditTarget(null); }}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveIssueForm}
              disabled={!formTitle.trim() || !formDescription.trim() || formSaving}
              className="btn-press rounded-[10px] border-none bg-porch-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {formSaving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

      {reports.length > 0 && (
        <ChatFAB
          scope="section"
          storageKey={`section_${slug}`}
          title={`Ask About ${displayName}`}
          placeholder={`Ask about ${displayName.toLowerCase()}...`}
          emptyStateText="Ask about anything in this section — an issue, a fix, or what to tackle first."
          context={{
            sectionName: displayName,
            sectionIssues: sortedIssues.map(({ ref }) => ({ title: ref.issue.title, severity: ref.issue.severity })),
            propertyContext: propertyContext || undefined,
            toolbox: toolboxNames,
          }}
          suggestedPrompts={[
            `What should I fix first in ${displayName.toLowerCase()}?`,
            "Which of these can I do myself?",
            "What happens if I wait on these?",
          ]}
        />
      )}
    </div>
  );
}
