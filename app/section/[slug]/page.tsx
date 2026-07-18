"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  sections,
  normalize,
  SKILL_RANK,
  type ParsedReport,
  type Issue,
  type CompletionRecord,
  type UserProfile,
} from "@/lib/sections";
import {
  loadLatestReport,
  loadCompletions,
  loadIgnored,
  loadUserProfile,
  saveIgnore,
  removeIgnore,
  updateReport,
} from "@/lib/data";
import Modal from "@/app/components/Modal";
import ChatFAB from "@/app/components/ChatFAB";
import { ChevronLeftIcon, PencilIcon, PlusIcon, SettingsIcon, TrashIcon } from "@/app/components/icons";

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

export default function SectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const router = useRouter();
  const { slug } = use(params);

  const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null);
  const [report, setReport]           = useState<ParsedReport | null>(null);
  const [completions, setCompletions] = useState<Record<string, CompletionRecord>>({});
  const [ignored, setIgnored]         = useState<Record<string, true>>({});
  const [userSkillLevel, setUserSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [loaded, setLoaded]           = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft]     = useState("");
  const [nameSaving, setNameSaving]   = useState(false);

  const [showIssueForm, setShowIssueForm]   = useState(false);
  const [editIssueIndex, setEditIssueIndex] = useState<number | null>(null);
  const [formTitle, setFormTitle]           = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSeverity, setFormSeverity]     = useState<Issue["severity"]>("maintenance");
  const [formNotes, setFormNotes]           = useState("");
  const [formSaving, setFormSaving]         = useState(false);

  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([loadLatestReport(), loadCompletions(), loadIgnored(), loadUserProfile()]).then(
      ([r, c, ig, profile]) => {
        if (r) setReport(r);
        setCompletions(c);
        setIgnored(ig);
        if (profile) setUserSkillLevel(profile.skillLevel);
        setLoaded(true);
      }
    );
  }, []);

  const sectionConfig = sections.find((s) => s.slug === slug);
  const reportSection = report?.sections.find(
    (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
  );
  const displayName = reportSection?.name ?? sectionConfig?.label ?? slug;
  const displayDescription = reportSection?.description ?? sectionConfig?.description;

  if (!sectionConfig && !loaded) return null;
  if (loaded && !sectionConfig && !reportSection) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-porch-bg">
        <p className="text-sm text-porch-text-secondary">Section not found.</p>
      </div>
    );
  }

  function findSectionIndex(r: ParsedReport): number {
    return r.sections.findIndex(
      (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
    );
  }

  const allWithIndex = (reportSection?.issues ?? []).map((issue, i) => ({ issue, i }));
  const visibleWithIndex = allWithIndex.filter(({ issue }) => !issue.deleted);

  const sortedIssues = [...visibleWithIndex]
    .map(({ issue, i }) => ({
      issue, i,
      done:      !!completions[`${slug}-${i}`],
      isIgnored: !!ignored[`${slug}-${i}`],
    }))
    .sort((a, b) => {
      const ga = group(a.done, a.isIgnored);
      const gb = group(b.done, b.isIgnored);
      if (ga !== gb) return ga - gb;
      if (ga === 0) return (SEVERITY_ORDER[a.issue.severity] ?? 99) - (SEVERITY_ORDER[b.issue.severity] ?? 99);
      return 0;
    });

  const activeCount  = sortedIssues.filter((x) => !x.done && !x.isIgnored).length;
  const doneCount    = sortedIssues.filter((x) => x.done).length;

  function navigateToIssue(issueIndex: number) {
    if (selectedIssueIndex !== null) return;
    setSelectedIssueIndex(issueIndex);
    setTimeout(() => router.push(`/section/${slug}/issue/${issueIndex}`), 300);
  }

  async function handleIgnore(i: number) {
    setIgnored((prev) => ({ ...prev, [`${slug}-${i}`]: true }));
    await saveIgnore(slug, i);
  }

  async function handleUnignore(i: number) {
    setIgnored((prev) => { const n = { ...prev }; delete n[`${slug}-${i}`]; return n; });
    await removeIgnore(slug, i);
  }

  async function handleRename() {
    if (!nameDraft.trim() || !report) return;
    setNameSaving(true);
    const newReport: ParsedReport = JSON.parse(JSON.stringify(report));
    const idx = findSectionIndex(newReport);
    if (idx !== -1) {
      newReport.sections[idx].name = nameDraft.trim();
      newReport.sections[idx].slug = slug;
    } else {
      newReport.sections.push({ name: nameDraft.trim(), slug, issues: [] });
    }
    await updateReport(newReport);
    setReport(newReport);
    setEditingName(false);
    setNameSaving(false);
  }

  function openEditForm(i: number, issue: Issue) {
    setFormTitle(issue.title);
    setFormDescription(issue.description);
    setFormSeverity(issue.severity);
    setFormNotes(issue.notes ?? "");
    setEditIssueIndex(i);
    setShowIssueForm(true);
  }

  async function handleSaveIssueForm() {
    if (!formTitle.trim() || !formDescription.trim() || !report || editIssueIndex === null) return;
    setFormSaving(true);
    const newReport: ParsedReport = JSON.parse(JSON.stringify(report));
    const idx = findSectionIndex(newReport);
    if (idx === -1) return;
    newReport.sections[idx].issues[editIssueIndex] = {
      ...newReport.sections[idx].issues[editIssueIndex],
      title: formTitle.trim(),
      description: formDescription.trim(),
      severity: formSeverity,
      recommendedAction: formDescription.trim(),
      notes: formNotes.trim() || undefined,
    };

    await updateReport(newReport);
    setReport(newReport);
    setShowIssueForm(false);
    setEditIssueIndex(null);
    setFormSaving(false);
  }

  async function handleDeleteIssue(i: number) {
    if (!report) return;
    const newReport: ParsedReport = JSON.parse(JSON.stringify(report));
    const idx = findSectionIndex(newReport);
    if (idx === -1) return;
    newReport.sections[idx].issues[i] = { ...newReport.sections[idx].issues[i], deleted: true };
    await updateReport(newReport);
    setReport(newReport);
    setConfirmDeleteIndex(null);
  }

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-[90px] text-porch-text">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-porch-border bg-porch-surface px-5 py-[18px]">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-porch-text-secondary no-underline">
          <ChevronLeftIcon />
          Dashboard
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/settings" aria-label="Settings" className="flex items-center justify-center p-1.5">
            <SettingsIcon />
          </Link>
          {report && (
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
              className="rounded-[10px] border border-porch-border-input bg-porch-surface px-3 py-1.5 font-display text-lg font-semibold text-porch-text focus:outline-none"
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
            {report && (
              <button
                onClick={() => { setNameDraft(displayName); setEditingName(true); }}
                title="Rename section"
                aria-label="Edit section name"
                className="flex items-center p-0.5"
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

      <div className="px-5 pb-1 pt-3.5 text-[13px] text-porch-text-tertiary">
        {activeCount} thing{activeCount !== 1 ? "s" : ""} to look at · {doneCount} taken care of
      </div>

      {!loaded ? null : !report ? (
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
          <p className="text-sm text-porch-text-secondary">No issues found for this section.</p>
        </div>
      ) : (
        sortedIssues.map(({ issue, i, done, isIgnored }) => {
          const dimmed = done || isIgnored;
          const skillTag =
            !done && !isIgnored && userSkillLevel && issue.minimumSkillLevel
              ? SKILL_RANK[userSkillLevel] >= SKILL_RANK[issue.minimumSkillLevel]
                ? { label: "DIY-friendly", cls: "text-porch-accent bg-porch-accent-tint" }
                : { label: "Pro recommended", cls: "text-porch-pro-text bg-porch-pro-bg" }
              : null;

          return (
            <div key={i} className="px-5 py-2">
              <div
                style={{ opacity: dimmed ? 0.5 : 1 }}
                className="relative rounded-2xl border border-porch-border bg-porch-surface px-[18px] py-4 shadow-[0_1px_2px_rgba(38,34,32,0.03)]"
              >
                {selectedIssueIndex === i && <div className="comet-ring" />}
                {issue.severity === "safety" && !dimmed && (
                  <span className="absolute left-[-1px] top-4 h-[22px] w-1 rounded-r-[3px] bg-porch-urgent" />
                )}
                <a
                  href={`/section/${slug}/issue/${i}`}
                  onClick={(e) => { e.preventDefault(); navigateToIssue(i); }}
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
                  <div className="ml-auto flex items-center gap-2.5">
                    {issue.userAdded && !done && confirmDeleteIndex !== i && (
                      <>
                        <button onClick={() => openEditForm(i, issue)} title="Edit" aria-label="Edit issue" className="flex items-center">
                          <PencilIcon size={13} />
                        </button>
                        <button onClick={() => setConfirmDeleteIndex(i)} title="Delete" aria-label="Delete issue" className="flex items-center">
                          <TrashIcon />
                        </button>
                      </>
                    )}
                    {confirmDeleteIndex === i ? (
                      <>
                        <button onClick={() => handleDeleteIssue(i)} className="text-[12.5px] font-medium text-red-600 underline">
                          Delete
                        </button>
                        <button onClick={() => setConfirmDeleteIndex(null)} className="text-[12.5px] text-porch-text-tertiary underline">
                          Cancel
                        </button>
                      </>
                    ) : (
                      !done && (
                        <button
                          onClick={() => (isIgnored ? handleUnignore(i) : handleIgnore(i))}
                          className="text-[12.5px] text-porch-text-faint underline underline-offset-2"
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
        <Modal onClose={() => { setShowIssueForm(false); setEditIssueIndex(null); }} maxWidth={420}>
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
                className="w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Description</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What's the issue? Include any relevant details."
                rows={3}
                className="w-full resize-none rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-porch-text">Type</label>
              <select
                value={formSeverity}
                onChange={(e) => setFormSeverity(e.target.value as Issue["severity"])}
                className="w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text focus:outline-none"
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
                className="w-full resize-none rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => { setShowIssueForm(false); setEditIssueIndex(null); }}
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

      {report && (
        <ChatFAB
          scope="section"
          storageKey={`section_${slug}`}
          title={`Ask About ${displayName}`}
          placeholder={`Ask about ${displayName.toLowerCase()}...`}
          emptyStateText="Ask about anything in this section — an issue, a fix, or what to tackle first."
          context={{
            sectionName: displayName,
            sectionIssues: sortedIssues.map(({ issue }) => ({ title: issue.title, severity: issue.severity })),
          }}
        />
      )}
    </div>
  );
}
