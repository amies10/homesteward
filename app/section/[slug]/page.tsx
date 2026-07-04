"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
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

const SEVERITY: Record<Issue["severity"], { card: string; badge: string; label: string }> = {
  safety:      { card: "border-red-200 bg-red-50",      badge: "bg-red-100 text-red-700",       label: "Safety" },
  repair:      { card: "border-orange-200 bg-orange-50", badge: "bg-orange-100 text-orange-700", label: "Repair" },
  maintenance: { card: "border-amber-200 bg-amber-50",  badge: "bg-amber-100 text-amber-700",   label: "Maintenance" },
  improvement: { card: "border-blue-200 bg-blue-50",    badge: "bg-blue-100 text-blue-700",     label: "Improvement" },
  fyi:         { card: "border-stone-200 bg-stone-50",  badge: "bg-stone-100 text-stone-500",   label: "FYI" },
};

const SEVERITY_ORDER: Record<string, number> = {
  safety: 0, repair: 1, maintenance: 2, improvement: 3, fyi: 4,
};

function group(done: boolean, ignored: boolean) {
  if (done) return 2;
  if (ignored) return 1;
  return 0;
}

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
  const { slug } = use(params);

  const [report, setReport]           = useState<ParsedReport | null>(null);
  const [completions, setCompletions] = useState<Record<string, CompletionRecord>>({});
  const [ignored, setIgnored]         = useState<Record<string, true>>({});
  const [userSkillLevel, setUserSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [loaded, setLoaded]           = useState(false);

  // Inline rename
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft]     = useState("");
  const [nameSaving, setNameSaving]   = useState(false);

  // Add / Edit issue modal
  const [showIssueForm, setShowIssueForm]   = useState(false);
  const [issueFormMode, setIssueFormMode]   = useState<"add" | "edit">("add");
  const [editIssueIndex, setEditIssueIndex] = useState<number | null>(null);
  const [formTitle, setFormTitle]           = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSeverity, setFormSeverity]     = useState<Issue["severity"]>("maintenance");
  const [formNotes, setFormNotes]           = useState("");
  const [formSaving, setFormSaving]         = useState(false);

  // Delete confirmation
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

  // Derived section data
  const sectionConfig = sections.find((s) => s.slug === slug);
  const reportSection = report?.sections.find(
    (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
  );
  const displayName = reportSection?.name ?? sectionConfig?.label ?? slug;
  const displayDescription = reportSection?.description ?? sectionConfig?.description;

  // Wait for load before showing custom sections (they need report data)
  if (!sectionConfig && !loaded) return null;
  if (loaded && !sectionConfig && !reportSection) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-500">Section not found.</p>
      </div>
    );
  }

  // Helper: find the index of this section in the report sections array
  function findSectionIndex(r: ParsedReport): number {
    return r.sections.findIndex(
      (s) => s.slug === slug || (sectionConfig && normalize(s.name) === normalize(sectionConfig.label))
    );
  }

  // Issues — filter soft-deleted, preserve original indices
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
  const ignoredCount = sortedIssues.filter((x) => x.isIgnored).length;
  const doneCount    = sortedIssues.filter((x) => x.done).length;

  // ── Handlers ──────────────────────────────────────────────────────────────

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

  function openAddForm() {
    setIssueFormMode("add");
    setFormTitle(""); setFormDescription(""); setFormSeverity("maintenance"); setFormNotes("");
    setEditIssueIndex(null);
    setShowIssueForm(true);
  }

  function openEditForm(i: number, issue: Issue) {
    setIssueFormMode("edit");
    setFormTitle(issue.title);
    setFormDescription(issue.description);
    setFormSeverity(issue.severity);
    setFormNotes(issue.notes ?? "");
    setEditIssueIndex(i);
    setShowIssueForm(true);
  }

  async function handleSaveIssueForm() {
    if (!formTitle.trim() || !formDescription.trim() || !report) return;
    setFormSaving(true);
    const newReport: ParsedReport = JSON.parse(JSON.stringify(report));

    if (issueFormMode === "add") {
      const newIssue: Issue = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        severity: formSeverity,
        recommendedAction: formDescription.trim(),
        userAdded: true,
        notes: formNotes.trim() || undefined,
      };
      const idx = findSectionIndex(newReport);
      if (idx === -1) {
        newReport.sections.push({ name: sectionConfig?.label ?? slug, slug, issues: [newIssue] });
      } else {
        newReport.sections[idx].issues.push(newIssue);
      }
    } else {
      if (editIssueIndex === null) return;
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
    }

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="shrink-0 text-sm text-stone-400 transition-colors hover:text-stone-600"
              >
                ← Dashboard
              </Link>
              <div className="h-4 w-px bg-stone-200" />
              <div className="flex items-center gap-2">
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
                      className="rounded-md border border-stone-300 px-2 py-1 text-lg font-semibold text-stone-900 focus:border-stone-500 focus:outline-none"
                    />
                    <button
                      onClick={handleRename}
                      disabled={nameSaving || !nameDraft.trim()}
                      className="rounded-md border border-stone-800 bg-stone-900 px-3 py-1 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-50"
                    >
                      {nameSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingName(false)}
                      className="text-xs text-stone-400 hover:text-stone-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                      {displayName}
                    </h1>
                    {report && (
                      <button
                        onClick={() => { setNameDraft(displayName); setEditingName(true); }}
                        title="Rename section"
                        className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        </svg>
                      </button>
                    )}
                    {displayDescription && (
                      <span className="hidden text-sm text-stone-400 sm:inline">
                        {displayDescription}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {report && !editingName && (
              <button
                onClick={openAddForm}
                className="shrink-0 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                + Add Issue
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {!loaded ? null : !report ? (
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-stone-500">
              No inspection report uploaded yet.{" "}
              <Link href="/" className="text-stone-700 underline underline-offset-2">
                Go to the dashboard
              </Link>{" "}
              to upload one.
            </p>
          </div>
        ) : sortedIssues.length === 0 ? (
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-stone-500">No issues found for this section.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="mb-6 text-sm text-stone-500">
              {activeCount} active issue{activeCount !== 1 ? "s" : ""}
              {ignoredCount > 0 && <span className="ml-2 text-stone-400">· {ignoredCount} ignored</span>}
              {doneCount > 0    && <span className="ml-2 text-stone-400">· {doneCount} complete</span>}
            </p>

            {sortedIssues.map(({ issue, i, done, isIgnored }) => {
              const style  = SEVERITY[issue.severity] ?? SEVERITY.fyi;
              const dimmed = done || isIgnored;
              const skillTag =
                !done && !isIgnored && userSkillLevel && issue.minimumSkillLevel
                  ? SKILL_RANK[userSkillLevel] >= SKILL_RANK[issue.minimumSkillLevel]
                    ? ({ label: "DIY-friendly",    cls: "bg-green-50 text-green-700" } as const)
                    : ({ label: "Pro recommended", cls: "bg-amber-50 text-amber-700" } as const)
                  : null;

              return (
                <div
                  key={i}
                  className={`rounded-lg border px-5 py-4 ${dimmed ? "border-stone-200 bg-white opacity-50" : style.card}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Clickable area */}
                    <Link
                      href={`/section/${slug}/issue/${i}`}
                      className="min-w-0 flex-1 hover:opacity-75"
                    >
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <span className={`text-sm font-medium ${dimmed ? "text-stone-400 line-through" : "text-stone-900"}`}>
                          {issue.title}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {issue.userAdded && !done && !isIgnored && (
                            <span className="rounded-full border border-stone-200 px-2 py-0.5 text-xs text-stone-400">
                              Added by you
                            </span>
                          )}
                          {skillTag && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${skillTag.cls}`}>
                              {skillTag.label}
                            </span>
                          )}
                          {done ? (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-400">✓ Complete</span>
                          ) : isIgnored ? (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-400">Ignored</span>
                          ) : (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>{style.label}</span>
                          )}
                        </div>
                      </div>
                      <p className={`text-xs leading-relaxed ${dimmed ? "text-stone-400" : "text-stone-600"}`}>
                        {issue.description}
                      </p>
                      {issue.notes && !dimmed && (
                        <p className="mt-1.5 text-xs italic leading-relaxed text-stone-400">
                          Note: {issue.notes}
                        </p>
                      )}
                    </Link>

                    {/* Action buttons */}
                    <div className="flex shrink-0 items-center gap-1 pt-0.5">
                      {/* Edit / Delete (user-added only) */}
                      {issue.userAdded && !done && (
                        <>
                          {confirmDeleteIndex === i ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDeleteIssue(i)}
                                className="rounded px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteIndex(null)}
                                className="rounded px-2 py-1 text-xs text-stone-400 transition-colors hover:bg-stone-100"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={(e) => { e.preventDefault(); openEditForm(i, issue); }}
                                title="Edit"
                                className="rounded p-1 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                </svg>
                              </button>
                              <button
                                onClick={(e) => { e.preventDefault(); setConfirmDeleteIndex(i); }}
                                title="Delete"
                                className="rounded p-1 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-500"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                                </svg>
                              </button>
                            </>
                          )}
                        </>
                      )}

                      {/* Ignore / Undo */}
                      {!done && confirmDeleteIndex !== i && (
                        isIgnored ? (
                          <button
                            onClick={() => handleUnignore(i)}
                            className="rounded px-2 py-1 text-xs text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            onClick={() => handleIgnore(i)}
                            className="rounded px-2 py-1 text-xs text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                          >
                            Ignore
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit Issue modal */}
      {showIssueForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white shadow-lg">
            <div className="border-b border-stone-100 px-6 py-4">
              <p className="text-sm font-semibold text-stone-900">
                {issueFormMode === "add" ? "Add Issue" : "Edit Issue"}
              </p>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-700">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Brief description of the issue"
                  autoFocus
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-700">Description</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What's the issue? Include any relevant details."
                  rows={3}
                  className="w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-700">Severity</label>
                <select
                  value={formSeverity}
                  onChange={(e) => setFormSeverity(e.target.value as Issue["severity"])}
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-500 focus:outline-none"
                >
                  {SEVERITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-stone-700">
                  Notes{" "}
                  <span className="font-normal text-stone-400">(optional)</span>
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Any additional context, photos to take, vendor info, etc."
                  rows={2}
                  className="w-full resize-none rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-stone-100 px-6 py-4">
              <button
                onClick={() => { setShowIssueForm(false); setEditIssueIndex(null); }}
                className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveIssueForm}
                disabled={!formTitle.trim() || !formDescription.trim() || formSaving}
                className="rounded-md border border-stone-800 bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {formSaving ? "Saving…" : issueFormMode === "add" ? "Add Issue" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
