"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import { CheckIcon, PlusIcon, TrashIcon } from "@/app/components/icons";
import { loadPropertyDetails, savePropertyDetails } from "@/lib/property";
import type { PropertyDetails } from "@/lib/sections";

const EMPTY: PropertyDetails = {
  yearBuilt: null,
  squareFeet: null,
  homeStyle: null,
  roofType: null,
  roofAgeYears: null,
  hvacType: null,
  hvacAgeYears: null,
  foundationType: null,
  bedrooms: null,
  bathrooms: null,
  otherSpecs: [],
};

function numField(v: number | null | undefined) {
  return v === null || v === undefined ? "" : String(v);
}

export default function PropertyDetailsPage() {
  const [details, setDetails] = useState<PropertyDetails>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newSpecLabel, setNewSpecLabel] = useState("");
  const [newSpecValue, setNewSpecValue] = useState("");

  useEffect(() => {
    loadPropertyDetails().then((data) => {
      if (data) setDetails({ ...EMPTY, ...data });
      setLoaded(true);
    });
  }, []);

  function set<K extends keyof PropertyDetails>(key: K, value: PropertyDetails[K]) {
    setDetails((d) => ({ ...d, [key]: value }));
  }

  function setNumber(key: keyof PropertyDetails, raw: string) {
    set(key, (raw.trim() === "" ? null : Number(raw)) as never);
  }

  function addSpec() {
    if (!newSpecLabel.trim() || !newSpecValue.trim()) return;
    set("otherSpecs", [...(details.otherSpecs ?? []), { label: newSpecLabel.trim(), value: newSpecValue.trim() }]);
    setNewSpecLabel("");
    setNewSpecValue("");
  }

  function removeSpec(i: number) {
    set("otherSpecs", (details.otherSpecs ?? []).filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setSaving(true);
    await savePropertyDetails(details);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const inputClass =
    "w-full rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none";
  const labelClass = "mb-1.5 block text-[13px] font-semibold text-porch-text";

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <AppHeader backHref="/profile" backLabel="Profile" />

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Property Details</span>
        <p className="mt-1 text-[13.5px] text-porch-text-secondary">
          Auto-filled from your inspection report where available — edit anything below.
        </p>
      </div>

      {loaded && (
        <>
          <div className="mx-5 mt-4 space-y-3.5 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Year Built</label>
                <input
                  type="number"
                  value={numField(details.yearBuilt)}
                  onChange={(e) => setNumber("yearBuilt", e.target.value)}
                  placeholder="1998"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Square Feet</label>
                <input
                  type="number"
                  value={numField(details.squareFeet)}
                  onChange={(e) => setNumber("squareFeet", e.target.value)}
                  placeholder="2100"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Home Style</label>
              <input
                type="text"
                value={details.homeStyle ?? ""}
                onChange={(e) => set("homeStyle", e.target.value || null)}
                placeholder="Colonial, Ranch, Craftsman…"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Bedrooms</label>
                <input
                  type="number"
                  step="1"
                  value={numField(details.bedrooms)}
                  onChange={(e) => setNumber("bedrooms", e.target.value)}
                  placeholder="3"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Bathrooms</label>
                <input
                  type="number"
                  step="0.5"
                  value={numField(details.bathrooms)}
                  onChange={(e) => setNumber("bathrooms", e.target.value)}
                  placeholder="2.5"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Roof Type</label>
                <input
                  type="text"
                  value={details.roofType ?? ""}
                  onChange={(e) => set("roofType", e.target.value || null)}
                  placeholder="Asphalt shingle"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Roof Age (years)</label>
                <input
                  type="number"
                  value={numField(details.roofAgeYears)}
                  onChange={(e) => setNumber("roofAgeYears", e.target.value)}
                  placeholder="12"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>HVAC Type</label>
                <input
                  type="text"
                  value={details.hvacType ?? ""}
                  onChange={(e) => set("hvacType", e.target.value || null)}
                  placeholder="Forced air gas / central AC"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>HVAC Age (years)</label>
                <input
                  type="number"
                  value={numField(details.hvacAgeYears)}
                  onChange={(e) => setNumber("hvacAgeYears", e.target.value)}
                  placeholder="8"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Foundation Type</label>
              <input
                type="text"
                value={details.foundationType ?? ""}
                onChange={(e) => set("foundationType", e.target.value || null)}
                placeholder="Poured concrete basement"
                className={inputClass}
              />
            </div>
          </div>

          <div className="mx-5 mt-3.5 space-y-3 rounded-2xl border border-porch-border bg-porch-surface p-[18px]">
            <div className="text-[15px] font-semibold text-porch-text">Other Specs</div>

            {(details.otherSpecs ?? []).map((spec, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-[10px] bg-porch-bg px-3.5 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-porch-text">{spec.label}</div>
                  <div className="truncate text-[13px] text-porch-text-secondary">{spec.value}</div>
                </div>
                <button onClick={() => removeSpec(i)} aria-label="Remove" className="shrink-0 p-1">
                  <TrashIcon />
                </button>
              </div>
            ))}

            <div className="flex gap-2">
              <input
                type="text"
                value={newSpecLabel}
                onChange={(e) => setNewSpecLabel(e.target.value)}
                placeholder="Label (e.g. Water heater)"
                className={`${inputClass} flex-1`}
              />
              <input
                type="text"
                value={newSpecValue}
                onChange={(e) => setNewSpecValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addSpec(); }}
                placeholder="Value"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={addSpec}
                disabled={!newSpecLabel.trim() || !newSpecValue.trim()}
                aria-label="Add spec"
                className="btn-press flex shrink-0 items-center justify-center rounded-[10px] border-none bg-porch-accent px-3 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PlusIcon color="#FFFFFF" />
              </button>
            </div>
          </div>

          <div className="px-5 pt-[26px]">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-press flex w-full items-center justify-center gap-2 rounded-[10px] border-none py-[13px] text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              style={{ background: saved ? "#3E7A4F" : "#7D234A" }}
            >
              {saved && <CheckIcon size={16} strokeWidth={2.6} />}
              {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
