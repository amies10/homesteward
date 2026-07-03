"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveUserProfile, loadUserProfile, loadLatestReport } from "@/lib/data";
import type { UserProfile } from "@/lib/sections";

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

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [skillLevel, setSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasReport, setHasReport] = useState(false);

  useEffect(() => {
    loadUserProfile().then((profile) => {
      if (profile?.onboardingCompleted) {
        router.replace("/");
        return;
      }
      if (profile?.skillLevel) setSkillLevel(profile.skillLevel);
      if (profile?.location) setLocation(profile.location);
    });
    loadLatestReport().then((report) => setHasReport(!!report));
  }, [router]);

  async function handleFinish() {
    if (!skillLevel || !location.trim()) return;
    setSaving(true);
    await saveUserProfile({
      skillLevel,
      location: location.trim(),
      onboardingCompleted: true,
    });
    router.push("/");
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <div className="flex items-baseline gap-3">
            <span className="text-xl font-semibold tracking-tight text-stone-900">
              HomeSteward
            </span>
            <span className="text-sm text-stone-400">setup</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        {/* Progress indicator */}
        <div className="mb-10 flex items-center gap-2">
          {[1, 2].map((n) => (
            <div
              key={n}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                n <= step ? "bg-stone-800" : "bg-stone-200"
              }`}
            />
          ))}
          <span className="ml-2 text-xs text-stone-400">Step {step} of 2</span>
        </div>

        {step === 1 ? (
          <div>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight text-stone-900">
              How comfortable are you with home repairs?
            </h1>
            <p className="mb-8 text-sm text-stone-500">
              {hasReport
                ? "Your report is saved. We just need a couple details to personalize your experience."
                : "This helps us tailor repair guidance and difficulty estimates to your skill level."}
            </p>

            <div className="space-y-3">
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

            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!skillLevel}
                className="rounded-md border border-stone-800 bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="mb-1 text-2xl font-semibold tracking-tight text-stone-900">
              Where is your home located?
            </h1>
            <p className="mb-8 text-sm text-stone-500">
              Used to find local contractors and estimate repair costs in your
              area. We never access your device location.
            </p>

            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && location.trim()) handleFinish();
              }}
              placeholder="Enter your zip code or city, state"
              autoFocus
              className="w-full rounded-lg border border-stone-300 px-4 py-3 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-500 focus:outline-none"
            />

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="rounded-md border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                ← Back
              </button>
              <button
                onClick={handleFinish}
                disabled={!location.trim() || saving}
                className="rounded-md border border-stone-800 bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Saving…" : "Finish →"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
