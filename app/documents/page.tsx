"use client";

import { useEffect, useRef, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import Modal from "@/app/components/Modal";
import { PageSkeleton } from "@/app/components/Skeleton";
import { TrashIcon, UploadIcon } from "@/app/components/icons";
import { sections } from "@/lib/sections";
import { getSignedUrl } from "@/lib/storage";
import { loadDocuments, uploadDocument, deleteDocument, type DocumentItem } from "@/lib/documents";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const CATEGORY_CHIPS: Array<{ value: DocumentItem["category"] | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "manual", label: "Manuals" },
  { value: "warranty", label: "Warranties" },
  { value: "invoice", label: "Invoices" },
  { value: "permit", label: "Permits" },
  { value: "paint", label: "Paint" },
  { value: "other", label: "Other" },
];

const CATEGORY_LABEL: Record<DocumentItem["category"], string> = {
  manual: "Manual",
  warranty: "Warranty",
  invoice: "Invoice",
  permit: "Permit",
  paint: "Paint",
  other: "Other",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<DocumentItem["category"] | "all">("all");
  const [openingId, setOpeningId] = useState<string | null>(null);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<DocumentItem["category"]>("other");
  const [uploadSection, setUploadSection] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const docs = await loadDocuments();
    setDocuments(docs);
    setLoaded(true);
  }

  useEffect(() => {
    loadDocuments().then((docs) => {
      setDocuments(docs);
      setLoaded(true);
    });
  }, []);

  function handlePickFile(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("That file is larger than 20MB — try a smaller file.");
      return;
    }
    setPendingFile(file);
    setUploadTitle(stripExtension(file.name));
    setUploadCategory("other");
    setUploadSection("");
    setUploadError(null);
  }

  async function handleConfirmUpload() {
    if (!pendingFile || !uploadTitle.trim()) return;
    setUploading(true);
    setUploadError(null);
    const doc = await uploadDocument(pendingFile, {
      title: uploadTitle.trim(),
      category: uploadCategory,
      sectionSlug: uploadSection || undefined,
    });
    setUploading(false);
    if (!doc) {
      setUploadError("Couldn't upload that file — try again.");
      return;
    }
    setPendingFile(null);
    await refresh();
  }

  async function handleOpenDocument(doc: DocumentItem) {
    setOpeningId(doc.id);
    const url = await getSignedUrl(doc.storagePath);
    setOpeningId(null);
    if (url) window.open(url, "_blank");
  }

  async function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    const doc = documents.find((d) => d.id === pendingDeleteId);
    if (!doc) {
      setPendingDeleteId(null);
      return;
    }
    setDeleting(true);
    await deleteDocument(doc.id, doc.storagePath);
    setDeleting(false);
    setPendingDeleteId(null);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
  }

  const visibleDocuments =
    categoryFilter === "all" ? documents : documents.filter((d) => d.category === categoryFilter);

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <AppHeader backHref="/settings" backLabel="Settings" />

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Document Vault</span>
        <p className="mt-1 text-[13.5px] text-porch-text-secondary">
          Manuals, warranties, invoices, and permits — all in one place.
        </p>
      </div>

      {!loaded ? (
        <PageSkeleton />
      ) : (
        <>
          {documents.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-0.5">
              {CATEGORY_CHIPS.map((chip) => {
                const active = categoryFilter === chip.value;
                return (
                  <button
                    key={chip.value}
                    onClick={() => setCategoryFilter(chip.value)}
                    className={`btn-press shrink-0 whitespace-nowrap rounded-full border-[1.5px] px-3.5 py-[7px] text-[13px] font-semibold focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1 ${
                      active
                        ? "border-porch-accent bg-porch-accent text-white"
                        : "border-porch-border-input bg-porch-surface text-[#6B5F55]"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-4 space-y-2.5 px-5">
            {documents.length === 0 ? (
              <div className="rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
                <p className="text-sm text-porch-text-secondary">
                  No documents yet. Add a manual, warranty, invoice, or permit to keep it on hand.
                </p>
              </div>
            ) : visibleDocuments.length === 0 ? (
              <div className="rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
                <p className="text-sm text-porch-text-secondary">No documents in this category.</p>
              </div>
            ) : (
              visibleDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2.5 rounded-2xl border border-porch-border bg-porch-surface px-4 py-3.5"
                >
                  <button
                    onClick={() => handleOpenDocument(doc)}
                    disabled={openingId === doc.id}
                    className="btn-press flex min-w-0 flex-1 flex-col items-start gap-1 border-none bg-transparent p-0 text-left disabled:opacity-60"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[14.5px] font-semibold text-porch-text">{doc.title}</span>
                      <span className="shrink-0 rounded-full bg-porch-accent-tint px-2 py-[2px] text-[10.5px] font-semibold text-porch-accent">
                        {CATEGORY_LABEL[doc.category]}
                      </span>
                    </div>
                    <span className="text-[12.5px] text-porch-text-tertiary">
                      {formatDate(doc.createdAt)}
                      {doc.fileName ? ` · ${doc.fileName}` : ""}
                      {openingId === doc.id ? " · Opening…" : ""}
                    </span>
                  </button>
                  <button
                    onClick={() => setPendingDeleteId(doc.id)}
                    aria-label="Delete document"
                    title="Delete document"
                    className="btn-press flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[8px] text-red-600 focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mx-5 mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handlePickFile(file);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-press flex w-full items-center justify-center gap-2 rounded-[10px] border-none bg-porch-accent py-3 text-[14.5px] font-semibold text-white"
            >
              <UploadIcon size={16} color="#FFFFFF" /> Add Document
            </button>
            {uploadError && !pendingFile && <p className="mt-2.5 text-xs text-red-600">{uploadError}</p>}
          </div>
        </>
      )}

      {pendingFile && (
        <Modal onClose={uploading ? undefined : () => { setPendingFile(null); setUploadError(null); }} maxWidth={400}>
          <p className="mb-3.5 text-[15px] font-semibold text-porch-text">Add Document</p>

          <label className="mb-3.5 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-porch-text">Title</span>
            <input
              type="text"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              autoFocus
              className="w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
            />
          </label>

          <label className="mb-3.5 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-porch-text">Category</span>
            <select
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value as DocumentItem["category"])}
              className="w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
            >
              {CATEGORY_CHIPS.filter((c) => c.value !== "all").map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>

          <label className="mb-1.5 block">
            <span className="mb-1.5 block text-[13px] font-semibold text-porch-text">Section (optional)</span>
            <select
              value={uploadSection}
              onChange={(e) => setUploadSection(e.target.value)}
              className="w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-sm text-porch-text focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
            >
              <option value="">No section</option>
              {sections.map((s) => (
                <option key={s.slug} value={s.slug}>{s.label}</option>
              ))}
            </select>
          </label>

          {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => { setPendingFile(null); setUploadError(null); }}
              disabled={uploading}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmUpload}
              disabled={!uploadTitle.trim() || uploading}
              className="btn-press rounded-[10px] border-none bg-porch-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {pendingDeleteId && (
        <Modal onClose={deleting ? undefined : () => setPendingDeleteId(null)} maxWidth={360}>
          <p className="mb-1 text-sm font-semibold text-porch-text">Delete this document?</p>
          <p className="mb-5 text-sm leading-relaxed text-porch-text-secondary">This can&apos;t be undone.</p>
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
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
