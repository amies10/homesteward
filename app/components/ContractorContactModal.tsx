"use client";

import { useState } from "react";
import Modal from "./Modal";
import type { ContractorResult } from "@/lib/sections";

interface Props {
  contractor: ContractorResult;
  onClose: () => void;
  onRecordHire: (contractor: ContractorResult) => void | Promise<void>;
}

const rowClass =
  "btn-press flex min-h-[44px] w-full items-center truncate rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-2.5 text-left text-sm text-porch-text no-underline focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1";

export default function ContractorContactModal({ contractor, onClose, onRecordHire }: Props) {
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);

  async function handleRecordHire() {
    if (recording || recorded) return;
    setRecording(true);
    try {
      await onRecordHire(contractor);
      setRecorded(true);
      setTimeout(() => onClose(), 1800);
    } finally {
      setRecording(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={380}>
      <p className="font-display text-lg font-semibold text-porch-text">{contractor.name}</p>

      {recorded ? (
        <p className="mt-3.5 rounded-[10px] border border-porch-success-border bg-porch-success-bg px-3.5 py-3 text-sm font-semibold text-porch-success">
          Saved — we&apos;ll remember who did this work.
        </p>
      ) : (
        <>
          <div className="mt-3.5 space-y-2">
            {contractor.phone && (
              <a href={`tel:${contractor.phone}`} className={rowClass}>
                {contractor.phone}
              </a>
            )}
            {contractor.website && (
              <a href={contractor.website} target="_blank" rel="noopener noreferrer" className={rowClass}>
                {contractor.website}
              </a>
            )}
            <a href={contractor.mapsUrl} target="_blank" rel="noopener noreferrer" className={rowClass}>
              View on Google Maps
            </a>
          </div>

          <button
            onClick={handleRecordHire}
            disabled={recording}
            className="btn-press mt-4 w-full rounded-[10px] border-none bg-porch-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {recording ? "Saving…" : "Record that you hired this pro"}
          </button>
          <button
            onClick={onClose}
            className="btn-press mt-2 w-full rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2.5 text-sm font-semibold text-porch-text-secondary"
          >
            Close
          </button>
        </>
      )}
    </Modal>
  );
}
