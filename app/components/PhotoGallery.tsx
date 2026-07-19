"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/app/components/Modal";
import { CameraIcon, TrashIcon } from "@/app/components/icons";
import { signPaths } from "@/lib/storage";

interface Props {
  paths: string[];
  legacyBase64?: string;
  onAdd: (file: File) => void;
  onRemove: (path: string) => void;
  readOnly?: boolean;
  uploading?: boolean;
}

export default function PhotoGallery({ paths, legacyBase64, onAdd, onRemove, readOnly, uploading }: Props) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!paths.length) return;
    signPaths(paths).then(setSignedUrls);
  }, [paths]);

  const tileClass = "relative aspect-square overflow-hidden rounded-xl border border-porch-border bg-porch-bg";

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {legacyBase64 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={legacyBase64} alt="" className={`${tileClass} object-cover`} />
        )}
        {paths.map((path) => (
          <button key={path} onClick={() => setViewing(path)} className={`${tileClass} btn-press`}>
            {signedUrls[path] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signedUrls[path]} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-porch-accent border-t-transparent" />
              </span>
            )}
          </button>
        ))}
        {!readOnly && (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Add photo"
            className={`${tileClass} btn-press flex items-center justify-center disabled:opacity-60`}
          >
            {uploading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-porch-accent border-t-transparent" />
            ) : (
              <CameraIcon size={18} />
            )}
          </button>
        )}
      </div>

      {!readOnly && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAdd(file);
            e.target.value = "";
          }}
        />
      )}

      {viewing && (
        <Modal onClose={() => setViewing(null)} maxWidth={480}>
          {signedUrls[viewing] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signedUrls[viewing]} alt="" className="w-full rounded-[10px] object-contain" />
          )}
          {!readOnly && (
            <button
              onClick={() => { setConfirmRemove(viewing); setViewing(null); }}
              className="btn-press mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-porch-border-input bg-porch-surface py-2.5 text-sm font-semibold text-porch-text-secondary"
            >
              <TrashIcon />
              Remove Photo
            </button>
          )}
        </Modal>
      )}

      {confirmRemove && (
        <Modal onClose={() => setConfirmRemove(null)}>
          <p className="mb-1 text-sm font-semibold text-porch-text">Remove this photo?</p>
          <p className="mb-5 text-sm leading-relaxed text-porch-text-secondary">
            This can&apos;t be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmRemove(null)}
              className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2 text-sm font-semibold text-porch-text-secondary"
            >
              Cancel
            </button>
            <button
              onClick={() => { onRemove(confirmRemove); setConfirmRemove(null); }}
              className="btn-press rounded-[10px] border-none bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Remove
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
