"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { saveUserProfile, loadUserProfile, loadLatestReport } from "@/lib/data";
import type { UserProfile } from "@/lib/sections";
import { supabase } from "@/lib/supabase-client";
import { getSignedUrl } from "@/lib/storage";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "@/app/components/icons";
import HomeButton from "@/app/components/HomeButton";
import SkillLevelPicker from "@/app/components/SkillLevelPicker";

export default function SettingsPage() {
  const [skillLevel, setSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadUserProfile().then((profile) => {
      if (profile) {
        setSkillLevel(profile.skillLevel);
        setLocation(profile.location);
      }
      setLoaded(true);
    });
    loadLatestReport().then((report) => {
      if (report?.pdfStoragePath) {
        setPdfPath(report.pdfStoragePath);
        setPdfFilename(report.pdfFilename ?? "inspection-report.pdf");
      }
    });
  }, []);

  async function handleDownloadPdf() {
    if (!pdfPath) return;
    setDownloading(true);
    const url = await getSignedUrl(pdfPath, 60, pdfFilename ?? undefined);
    setDownloading(false);
    if (url) window.open(url, "_blank");
  }

  async function handleSave() {
    if (!skillLevel || !location.trim()) return;
    setSaving(true);
    await saveUserProfile({
      skillLevel,
      location: location.trim(),
      onboardingCompleted: true,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-porch-border bg-porch-surface px-5 py-3.5">
        <Link href="/" className="flex items-center gap-1.5 text-[13.5px] text-porch-text-secondary no-underline">
          <ChevronLeftIcon size={15} />
          Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => supabase.auth.signOut()} className="border-none bg-transparent p-0 text-[13.5px] font-medium text-porch-text-secondary">
            Sign out
          </button>
          <HomeButton size={18} />
        </div>
      </header>

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Settings</span>
      </div>

      {loaded && (
        <>
          <div className="px-5 pb-1 pt-[18px]">
            <div className="text-[15.5px] font-semibold text-porch-text">Skill Level</div>
            <div className="mt-0.5 text-[13.5px] text-porch-text-secondary">
              How comfortable are you with home repairs?
            </div>

            <SkillLevelPicker value={skillLevel} onChange={setSkillLevel} />
          </div>

          <div className="px-5 pb-1 pt-[26px]">
            <div className="text-[15.5px] font-semibold text-porch-text">Location</div>
            <div className="mb-2.5 mt-0.5 text-[13.5px] text-porch-text-secondary">
              Used to find local pros and estimate repair costs.
            </div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ZIP code"
              className="w-full rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
            />
          </div>

          {pdfPath && (
            <div className="px-5 pt-[26px]">
              <div className="text-[15.5px] font-semibold text-porch-text">Inspection Report</div>
              <div className="mb-2.5 mt-0.5 text-[13.5px] text-porch-text-secondary">
                {pdfFilename}
              </div>
              <button
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="btn-press w-full rounded-[10px] border border-porch-border-input bg-porch-surface py-3 text-[14.5px] font-medium text-porch-text-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {downloading ? "Preparing…" : "Download PDF"}
              </button>
            </div>
          )}

          <div className="space-y-2.5 px-5 pt-[26px]">
            <Link
              href="/profile"
              className="btn-press flex items-center justify-between rounded-2xl border border-porch-border bg-porch-surface px-4 py-4 no-underline"
            >
              <span className="text-[14.5px] font-semibold text-porch-text">Profile</span>
              <ChevronRightIcon />
            </Link>
            <Link
              href="/property"
              className="btn-press flex items-center justify-between rounded-2xl border border-porch-border bg-porch-surface px-4 py-4 no-underline"
            >
              <span className="text-[14.5px] font-semibold text-porch-text">Property Details</span>
              <ChevronRightIcon />
            </Link>
          </div>

          <div className="px-5 pt-[26px]">
            <button
              onClick={handleSave}
              disabled={!skillLevel || !location.trim() || saving}
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
