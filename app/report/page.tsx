"use client";

import { useEffect, useRef, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import Modal from "@/app/components/Modal";
import { PageSkeleton } from "@/app/components/Skeleton";
import { useProgressiveStatus } from "@/app/components/useProgressiveStatus";
import { CheckIcon, TrashIcon, UploadIcon } from "@/app/components/icons";
import {
  sections,
  normalize,
  mergeReports,
  slugify,
  type ParsedReport,
  type ReportSection,
  type PropertyDetails,
  type StoredReport,
} from "@/lib/sections";
import {
  loadReports,
  saveReport,
  deleteReport,
  loadUserProfile,
  updateProfileAddress,
} from "@/lib/data";
import { mergeParsedPropertyDetails } from "@/lib/property";
import { getSignedUrl } from "@/lib/storage";

interface ParseResponse {
  documentType?: string | null;
  parserNote?: string | null;
  propertyAddress?: string | null;
  propertyDetails?: PropertyDetails | null;
  sections: ReportSection[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function issueCountFor(report: StoredReport): number {
  return report.sections.reduce((sum, s) => sum + s.issues.filter((i) => !i.deleted).length, 0);
}

export default function HomeReportsPage() {
  const [loaded, setLoaded] = useState(false);
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [location, setLocation] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadStatus = useProgressiveStatus(uploading, [
    ["Uploading your report…", 0],
    ["Reading your report…", 4000],
    ["Organizing your issues…", 15000],
    ["Almost done…", 30000],
  ]);

  async function refresh() {
    const r = await loadReports();
    setReports(r);
    setLoaded(true);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    refresh();
    loadUserProfile().then((profile) => setLocation(profile?.location ?? null));
  }, []);

  async function handleDownloadPdf(report: StoredReport) {
    if (!report.pdfStoragePath) return;
    setDownloadingId(report.id);
    const url = await getSignedUrl(report.pdfStoragePath, 60, report.pdfFilename ?? undefined);
    setDownloadingId(null);
    if (url) window.open(url, "_blank");
  }

  function handlePickFile(file: File) {
    setError(null);
    performUpload(file);
  }

  async function performUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (location) form.append("location", location);

      const res = await fetch("/api/parse-report", { method: "POST", body: form });
      const data = (await res.json()) as ParseResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Upload failed");

      if (!data.sections || data.sections.length === 0) {
        throw new Error(data.parserNote || "We couldn't find any home issues in this document.");
      }

      // Assign slugs to any non-standard sections client-side, deduping
      // against the 10 standard slugs and every already-merged custom slug so
      // two custom sections (from this or an earlier report) never collide.
      const existingMerged = mergeReports(reports);
      const taken = new Set<string>([...sections.map((s) => s.slug), ...existingMerged.map((s) => s.slug)]);
      const slugifiedSections: ReportSection[] = data.sections.map((section) => {
        const std = sections.find((s) => normalize(s.label) === normalize(section.name));
        if (std) return { ...section, slug: std.slug };
        const base = slugify(section.name);
        let slug = base;
        let n = 2;
        while (taken.has(slug)) { slug = `${base}-${n}`; n++; }
        taken.add(slug);
        return { ...section, slug };
      });

      const reportToSave: ParsedReport = {
        sections: slugifiedSections,
        propertyAddress: data.propertyAddress,
        propertyDetails: data.propertyDetails,
      };

      await saveReport(reportToSave, file.name, file, {
        documentType: data.documentType ?? undefined,
        parserNote: data.parserNote ?? undefined,
      });
      if (data.propertyAddress) await updateProfileAddress(data.propertyAddress);
      if (data.propertyDetails) await mergeParsedPropertyDetails(data.propertyDetails);

      await refresh();
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    setDeleting(true);
    await deleteReport(pendingDeleteId);
    setDeleting(false);
    setPendingDeleteId(null);
    await refresh();
  }

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <AppHeader backHref="/settings" backLabel="Settings" />

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Home Reports</span>
      </div>

      {!loaded ? (
        <PageSkeleton />
      ) : (
        <>
          {reports.length === 0 ? (
            <div className="mx-5 mt-4 rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
              <p className="text-sm text-porch-text-secondary">
                No reports uploaded yet. Upload an inspection report, contractor estimate, or punch list to get
                started.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {reports.map((report) => {
                const isBase = report.id === reports[0]?.id;
                const count = issueCountFor(report);
                return (
                  <div key={report.id} className="mx-5 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-semibold text-porch-text">
                            {report.documentType ?? "Report"}
                          </p>
                          {isBase && (
                            <span className="shrink-0 rounded-full bg-porch-accent-tint px-2 py-[2px] text-[10.5px] font-semibold text-porch-accent">
                              Base report
                            </span>
                          )}
                        </div>
                        {report.pdfFilename && (
                          <p className="mt-1 truncate text-[13px] text-porch-text-secondary">{report.pdfFilename}</p>
                        )}
                        <p className="mt-1 text-[12.5px] text-porch-text-tertiary">
                          Uploaded {formatDate(report.createdAt)} · {count} issue{count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button
                        onClick={() => setPendingDeleteId(report.id)}
                        aria-label="Delete report"
                        title="Delete report"
                        className="btn-press flex shrink-0 items-center rounded-[8px] p-2 text-red-600"
                      >
                        <TrashIcon />
                      </button>
                    </div>

                    {report.parserNote && (
                      <p className="mt-3 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
                        {report.parserNote}
                      </p>
                    )}

                    {report.pdfStoragePath ? (
                      <button
                        onClick={() => handleDownloadPdf(report)}
                        disabled={downloadingId === report.id}
                        className="btn-press mt-3.5 w-full rounded-[10px] border border-porch-border-input bg-porch-surface py-2.5 text-[13.5px] font-medium text-porch-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {downloadingId === report.id ? "Preparing…" : "Download PDF"}
                      </button>
                    ) : (
                      <p className="mt-3.5 text-[12px] text-porch-text-tertiary">
                        The original PDF isn&apos;t available for download for this report.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mx-5 mt-4 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">
              {reports.length > 0 ? "Add another report" : "Upload a report"}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-porch-text-secondary">
              Inspection reports, contractor punch lists, estimates, or assessments — each upload adds its own
              issues without touching your other reports.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePickFile(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-press mt-3.5 flex w-full items-center justify-center gap-2 rounded-[10px] border-none py-3 text-[14.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: justUploaded ? "#3E7A4F" : "#7D234A" }}
            >
              {justUploaded ? (
                <>
                  <CheckIcon size={16} strokeWidth={2.6} /> Uploaded
                </>
              ) : uploading ? (
                uploadStatus ?? "Uploading…"
              ) : (
                <>
                  <UploadIcon size={16} color="#FFFFFF" /> {reports.length > 0 ? "Add Another Report" : "Upload Report"}
                </>
              )}
            </button>
            {error && <p className="mt-2.5 text-xs text-red-600">{error}</p>}
          </div>
        </>
      )}

      {pendingDeleteId && (
        <Modal onClose={() => setPendingDeleteId(null)}>
          <p className="mb-1 text-sm font-semibold text-porch-text">Delete this report?</p>
          <p className="mb-5 text-sm leading-relaxed text-porch-text-secondary">
            Issues, fixes, and notes that came from it will be removed. Your other reports are untouched.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setPendingDeleteId(null)}
              disabled={deleting}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="btn-press rounded-[10px] border-none bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete Report"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
