"use client";

import { useState } from "react";

interface Props {
  onSubmit: (notes?: string) => Promise<void>;
  onCancel: () => void;
}

// Shared inline "mark done" flow — a short notes textarea plus Save/Skip
// buttons — used by both DayDetailSheet and AgendaList so completion notes
// look and behave identically wherever a task can be logged.
export default function CompleteWithNotes({ onSubmit, onCancel }: Props) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(withNotes: boolean) {
    setSaving(true);
    await onSubmit(withNotes && notes.trim() ? notes.trim() : undefined);
    setSaving(false);
  }

  return (
    <div className="mt-2.5 space-y-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Any notes? What you did, what to watch for… (optional)"
        disabled={saving}
        className="w-full resize-none rounded-[8px] border border-porch-border-input bg-porch-surface px-3 py-2 text-[13px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1 disabled:opacity-60"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="btn-press rounded-[8px] px-3 py-2 text-[12.5px] font-semibold text-porch-text-secondary disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={() => submit(false)}
          disabled={saving}
          className="btn-press rounded-[8px] border border-porch-border-input bg-porch-surface px-3 py-2 text-[12.5px] font-semibold text-porch-text disabled:opacity-50"
        >
          Skip notes
        </button>
        <button
          onClick={() => submit(true)}
          disabled={saving}
          className="btn-press rounded-[8px] border-none bg-porch-accent px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
