"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sections, normalize, type Issue, type ParsedReport, type ReportSection } from "@/lib/sections";
import { loadLatestReport, updateReport, saveCompletion } from "@/lib/data";
import Modal from "@/app/components/Modal";
import { PlusIcon, XIcon } from "@/app/components/icons";

type AddType = "issue" | "enhancement";

export default function AddIssuePage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const router = useRouter();
  const { section: preselectedSection } = use(searchParams);

  const [report, setReport] = useState<ParsedReport | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [type, setType] = useState<AddType>("issue");
  const [section, setSection] = useState<string>(preselectedSection ?? "interior");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDesc, setNewSectionDesc] = useState("");
  const [addingSectionLoading, setAddingSectionLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLatestReport().then((r) => {
      setReport(r);
      setLoaded(true);
    });
  }, []);

  const customSections = (report?.sections.filter((s) => s.userAdded && s.slug) ?? []).map((s) => ({
    slug: s.slug!,
    label: s.name,
  }));
  const sectionChips = [
    ...sections.map((s) => ({ slug: s.slug, label: s.label })),
    ...customSections,
  ];
  const sectionLabel = sectionChips.find((s) => s.slug === section)?.label ?? section;

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
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
    setSection(slug);
    setShowAddSection(false);
    setNewSectionName("");
    setNewSectionDesc("");
    setAddingSectionLoading(false);
  }

  async function handleSubmit() {
    if (!title.trim() || submitting || submitted) return;
    setSubmitting(true);

    const sectionConfig = sections.find((s) => s.slug === section);
    const baseReport: ParsedReport = report ?? { sections: [] };
    const newReport: ParsedReport = JSON.parse(JSON.stringify(baseReport));

    const newIssue: Issue = {
      title: title.trim(),
      description: description.trim() || (type === "issue" ? "Logged by homeowner." : "Upgrade logged by homeowner."),
      severity: type === "issue" ? "repair" : "improvement",
      recommendedAction: description.trim(),
      userAdded: true,
      photoBase64: photo ?? undefined,
    };

    let idx = newReport.sections.findIndex(
      (s) => s.slug === section || normalize(s.name) === normalize(sectionConfig?.label ?? section)
    );
    if (idx === -1) {
      newReport.sections.push({ name: sectionConfig?.label ?? section, slug: section, issues: [newIssue] });
      idx = newReport.sections.length - 1;
    } else {
      newReport.sections[idx].issues.push(newIssue);
    }
    const newIssueIndex = newReport.sections[idx].issues.length - 1;

    await updateReport(newReport);

    if (type === "enhancement") {
      await saveCompletion({
        slug: section,
        issueIndex: newIssueIndex,
        completedBy: "me",
        completedAt: new Date().toISOString(),
      });
    }

    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      router.push(preselectedSection ? `/section/${preselectedSection}` : "/");
    }, 900);
  }

  if (!loaded) return null;

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2.5 border-b border-porch-border bg-porch-surface px-5 py-3.5">
        <Link
          href={preselectedSection ? `/section/${preselectedSection}` : "/"}
          className="flex items-center gap-1.5 text-[13.5px] text-porch-text-secondary no-underline"
        >
          <XIcon size={15} strokeWidth={2} />
          Cancel
        </Link>
        <span className="text-[15px] font-semibold text-porch-text">Log Something New</span>
        <span className="w-[46px]" />
      </header>

      <div className="px-5 pb-1.5 pt-5">
        <div className="mb-2 text-[13.5px] font-semibold text-porch-text">What are you adding?</div>
        <div className="flex gap-2">
          <button
            onClick={() => setType("issue")}
            className={`btn-press flex-1 rounded-xl border-[1.5px] p-3.5 text-left ${
              type === "issue" ? "border-porch-accent bg-porch-accent-tint" : "border-porch-border bg-porch-surface"
            }`}
          >
            <div className={`text-[14.5px] font-semibold ${type === "issue" ? "text-porch-accent" : "text-porch-text"}`}>A Problem</div>
            <div className={`mt-0.5 text-[12.5px] leading-snug ${type === "issue" ? "text-porch-accent-tint-text" : "text-porch-text-secondary"}`}>
              Something broke, or wasn&apos;t on the report.
            </div>
          </button>
          <button
            onClick={() => setType("enhancement")}
            className={`btn-press flex-1 rounded-xl border-[1.5px] p-3.5 text-left ${
              type === "enhancement" ? "border-porch-accent bg-porch-accent-tint" : "border-porch-border bg-porch-surface"
            }`}
          >
            <div className={`text-[14.5px] font-semibold ${type === "enhancement" ? "text-porch-accent" : "text-porch-text"}`}>An Upgrade</div>
            <div className={`mt-0.5 text-[12.5px] leading-snug ${type === "enhancement" ? "text-porch-accent-tint-text" : "text-porch-text-secondary"}`}>
              Something you fixed, replaced, or improved.
            </div>
          </button>
        </div>
      </div>

      <div className="px-5 pb-1.5 pt-[22px]">
        <div className="mb-2 text-[13.5px] font-semibold text-porch-text">Where in the house?</div>
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {sectionChips.map((chip) => {
            const active = section === chip.slug;
            return (
              <button
                key={chip.slug}
                onClick={() => setSection(chip.slug)}
                className={`btn-press shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-semibold ${
                  active ? "border-porch-accent bg-porch-accent text-white" : "border-porch-border-input bg-porch-surface text-[#6B5F55]"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
          <button
            onClick={() => setShowAddSection(true)}
            className="btn-press flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-dashed border-porch-border-input bg-porch-surface px-3.5 py-2 text-[13px] font-semibold text-porch-accent"
          >
            <PlusIcon size={12} />
            Add Section
          </button>
        </div>
      </div>

      <div className="px-5 pb-1.5 pt-[22px]">
        <div className="mb-2 text-[13.5px] font-semibold text-porch-text">
          {type === "issue" ? "What's the issue?" : "What did you do?"}
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={type === "issue" ? "e.g. Dishwasher won't drain" : "e.g. Repainted the kitchen"}
          className="w-full rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
        />
      </div>

      <div className="px-5 pb-1.5 pt-[18px]">
        <div className="mb-2 text-[13.5px] font-semibold text-porch-text">Tell us more</div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what happened, what you did, or what you're seeing — in your own words."
          rows={4}
          className="w-full resize-y rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-3 text-sm leading-relaxed text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
        />
      </div>

      <div className="px-5 pb-1.5 pt-[18px]">
        <div className="mb-2 text-[13.5px] font-semibold text-porch-text">Add a photo (optional)</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
        {photo ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="max-h-56 w-full rounded-2xl object-cover" />
            <button
              onClick={() => setPhoto(null)}
              aria-label="Remove photo"
              className="btn-press absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full border-none bg-[rgba(38,34,32,0.55)]"
            >
              <XIcon size={15} color="#FFFFFF" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            style={{ borderStyle: "dashed", borderColor: dragOver ? "#7D234A" : "#DCD3C6" }}
            className="flex h-28 cursor-pointer items-center justify-center rounded-2xl border-2 bg-porch-surface text-[13.5px] text-porch-text-tertiary"
          >
            Drop a photo here
          </div>
        )}
      </div>

      <div className="px-5 pt-6">
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || submitting || submitted}
          style={{ background: submitted ? "#3E7A4F" : "#7D234A" }}
          className="btn-press flex w-full items-center justify-center gap-2 rounded-[10px] border-none py-3.5 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitted ? "Added!" : type === "issue" ? `Add to ${sectionLabel}` : `Log Upgrade in ${sectionLabel}`}
        </button>
      </div>

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
    </div>
  );
}
