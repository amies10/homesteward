"use client";

import { useEffect, useRef, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import Modal from "@/app/components/Modal";
import { CheckIcon, UploadIcon } from "@/app/components/icons";
import {
  loadLatestReport,
  saveReport,
  clearLocalReport,
  loadUserProfile,
  updateProfileAddress,
} from "@/lib/data";
import { mergeParsedPropertyDetails } from "@/lib/property";
import { getSignedUrl } from "@/lib/storage";

export default function InspectionReportPage() {
  const [loaded, setLoaded] = useState(false);
  const [hasReport, setHasReport] = useState(false);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmStep, setConfirmStep] = useState<0 | 1 | 2>(0);
  const [uploading, setUploading] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [report, profile] = await Promise.all([loadLatestReport(), loadUserProfile()]);
    setHasReport(!!report);
    setPdfPath(report?.pdfStoragePath ?? null);
    setPdfFilename(report?.pdfFilename ?? null);
    setLocation(profile?.location ?? null);
    setLoaded(true);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleDownloadPdf() {
    if (!pdfPath) return;
    setDownloading(true);
    const url = await getSignedUrl(pdfPath, 60, pdfFilename ?? undefined);
    setDownloading(false);
    if (url) window.open(url, "_blank");
  }

  function handlePickFile(file: File) {
    setPendingFile(file);
    setError(null);
    setConfirmStep(hasReport ? 1 : 0);
    if (!hasReport) performUpload(file);
  }

  async function performUpload(file: File) {
    setConfirmStep(0);
    setUploading(true);
    setError(null);
    try {
      if (hasReport) await clearLocalReport();

      const form = new FormData();
      form.append("file", file);
      if (location) form.append("location", location);

      const res = await fetch("/api/parse-report", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      await saveReport(data, file.name, file);
      if (data.propertyAddress) await updateProfileAddress(data.propertyAddress);
      if (data.propertyDetails) await mergeParsedPropertyDetails(data.propertyDetails);

      await refresh();
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
      setPendingFile(null);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <AppHeader backHref="/settings" backLabel="Settings" />

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Inspection Report</span>
      </div>

      {loaded && (
        <>
          {hasReport && (
            <div className="mx-5 mt-4 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
              <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">
                Current report
              </p>
              <p className="mt-1.5 text-[14.5px] text-porch-text">{pdfFilename ?? "Inspection report"}</p>
              {pdfPath ? (
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                  className="btn-press mt-3.5 w-full rounded-[10px] border border-porch-border-input bg-porch-surface py-3 text-[14.5px] font-medium text-porch-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloading ? "Preparing…" : "Download PDF"}
                </button>
              ) : (
                <p className="mt-3.5 text-[12.5px] text-porch-text-tertiary">
                  The original PDF isn&apos;t available for download for this report.
                </p>
              )}
            </div>
          )}

          <div className="mx-5 mt-4 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-porch-text-tertiary">
              {hasReport ? "Replace report" : "Upload a report"}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-porch-text-secondary">
              {hasReport
                ? "Uploading a new report replaces everything tied to your current one."
                : "Upload your home inspection PDF to get started."}
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
                "Uploading…"
              ) : (
                <>
                  <UploadIcon size={16} color="#FFFFFF" /> {hasReport ? "Upload New Report" : "Upload Report"}
                </>
              )}
            </button>
            {error && <p className="mt-2.5 text-xs text-red-600">{error}</p>}
          </div>
        </>
      )}

      {confirmStep === 1 && (
        <Modal onClose={() => { setConfirmStep(0); setPendingFile(null); }}>
          <p className="mb-1 text-sm font-semibold text-porch-text">Replace your report?</p>
          <p className="mb-5 text-sm leading-relaxed text-porch-text-secondary">
            Uploading a new report will permanently delete all your current issues, completed fixes, ignored items,
            and DIY notes. This cannot be undone. Are you sure you want to continue?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setConfirmStep(0); setPendingFile(null); }}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => setConfirmStep(2)}
              className="btn-press rounded-[10px] border-none bg-porch-accent px-4 py-2 text-sm font-semibold text-white"
            >
              Continue
            </button>
          </div>
        </Modal>
      )}

      {confirmStep === 2 && (
        <Modal onClose={() => { setConfirmStep(0); setPendingFile(null); }}>
          <p className="mb-1 text-sm font-semibold text-porch-text">Replace report?</p>
          <p className="mb-5 text-sm leading-relaxed text-porch-text-secondary">
            This is permanent. Everything tied to your current report — fixes, notes, and history — will be gone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setConfirmStep(0); setPendingFile(null); }}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => pendingFile && performUpload(pendingFile)}
              className="btn-press rounded-[10px] border-none bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Yes, replace my report
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
