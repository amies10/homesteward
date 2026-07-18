"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { saveUserProfile, loadUserProfile } from "@/lib/data";
import type { UserProfile } from "@/lib/sections";
import { supabase } from "@/lib/supabase-client";
import { CheckIcon, ChevronLeftIcon } from "@/app/components/icons";

const SKILL_OPTIONS: Array<{
  value: UserProfile["skillLevel"];
  label: string;
  description: string;
}> = [
  {
    value: "beginner",
    label: "Beginner",
    description: "I've never picked up a tool. I need guidance on everything.",
  },
  {
    value: "some_experience",
    label: "Some Experience",
    description: "I can handle basic tasks like painting or fixing a leaky faucet.",
  },
  {
    value: "experienced",
    label: "Experienced",
    description: "I'm comfortable with most repairs and have completed several projects.",
  },
  {
    value: "expert",
    label: "Expert",
    description: "I can tackle almost anything — electrical, plumbing, structural.",
  },
];

export default function SettingsPage() {
  const [skillLevel, setSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadUserProfile().then((profile) => {
      if (profile) {
        setSkillLevel(profile.skillLevel);
        setLocation(profile.location);
      }
      setLoaded(true);
    });
  }, []);

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
        <button onClick={() => supabase.auth.signOut()} className="border-none bg-transparent p-0 text-[13.5px] font-medium text-porch-text-secondary">
          Sign out
        </button>
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

            <div className="space-y-2.5">
              {SKILL_OPTIONS.map((opt) => {
                const selected = skillLevel === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSkillLevel(opt.value)}
                    className={`btn-press mt-2.5 w-full rounded-2xl border-[1.5px] px-4 py-[15px] text-left ${
                      selected ? "border-porch-accent bg-porch-accent" : "border-porch-border bg-porch-surface"
                    }`}
                  >
                    <div className={`text-[15px] font-semibold ${selected ? "text-white" : "text-porch-text"}`}>
                      {opt.label}
                    </div>
                    <div className={`mt-[3px] text-[13px] leading-relaxed ${selected ? "text-[#F1D9E1]" : "text-porch-text-secondary"}`}>
                      {opt.description}
                    </div>
                  </button>
                );
              })}
            </div>
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
