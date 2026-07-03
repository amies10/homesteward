"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { saveUserProfile, loadUserProfile } from "@/lib/data";
import type { UserProfile } from "@/lib/sections";
import { supabase } from "@/lib/supabase-client";

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
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-stone-400 transition-colors hover:text-stone-600"
              >
                ← Dashboard
              </Link>
              <div className="h-4 w-px bg-stone-200" />
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                Settings
              </h1>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-stone-400 transition-colors hover:text-stone-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-6 py-10">
        {loaded && (
          <>
            <div>
              <p className="mb-0.5 text-sm font-medium text-stone-900">
                Skill Level
              </p>
              <p className="mb-4 text-xs text-stone-400">
                How comfortable are you with home repairs?
              </p>
              <div className="space-y-2">
                {SKILL_OPTIONS.map((opt) => {
                  const selected = skillLevel === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setSkillLevel(opt.value)}
                      className={`w-full rounded-lg border px-5 py-4 text-left transition-colors ${
                        selected
                          ? "border-stone-800 bg-stone-900"
                          : "border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50"
                      }`}
                    >
                      <p
                        className={`text-sm font-medium ${
                          selected ? "text-white" : "text-stone-900"
                        }`}
                      >
                        {opt.label}
                      </p>
                      <p
                        className={`mt-0.5 text-xs leading-relaxed ${
                          selected ? "text-stone-300" : "text-stone-500"
                        }`}
                      >
                        {opt.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-0.5 text-sm font-medium text-stone-900">
                Location
              </p>
              <p className="mb-3 text-xs text-stone-400">
                Used to find local contractors and estimate repair costs.
              </p>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Zip code or city, state"
                className="w-full rounded-lg border border-stone-300 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={!skillLevel || !location.trim() || saving}
                className="rounded-md border border-stone-800 bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              {saved && (
                <span className="text-sm text-stone-500">✓ Saved</span>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
