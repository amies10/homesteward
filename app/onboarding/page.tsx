"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveUserProfile, loadUserProfile, loadLatestReport } from "@/lib/data";
import type { UserProfile } from "@/lib/sections";
import Logo from "@/app/components/Logo";

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
    <div className="flex min-h-screen flex-col bg-porch-bg">
      <header className="border-b border-porch-border bg-porch-surface">
        <div className="mx-auto max-w-2xl px-5 py-4">
          <Logo size={32} wordmarkSize={19} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12">
        <div className="mb-9 flex items-center gap-2">
          {[1, 2].map((n) => (
            <div
              key={n}
              className={`h-1.5 w-8 rounded-full transition-colors ${n <= step ? "bg-porch-accent" : "bg-porch-border"}`}
            />
          ))}
          <span className="ml-2 text-xs text-porch-text-tertiary">Step {step} of 2</span>
        </div>

        {step === 1 ? (
          <div>
            <h1 className="mb-1 font-display text-2xl font-semibold text-porch-text">
              How comfortable are you with home repairs?
            </h1>
            <p className="mb-8 text-[14px] text-porch-text-secondary">
              {hasReport
                ? "Your report is saved. We just need a couple details to personalize your experience."
                : "This helps us tailor repair guidance and difficulty estimates to your skill level."}
            </p>

            <div className="space-y-2.5">
              {SKILL_OPTIONS.map((opt) => {
                const selected = skillLevel === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSkillLevel(opt.value)}
                    className={`btn-press w-full rounded-2xl border-[1.5px] px-5 py-4 text-left ${
                      selected ? "border-porch-accent bg-porch-accent" : "border-porch-border bg-porch-surface"
                    }`}
                  >
                    <p className={`text-[15px] font-semibold ${selected ? "text-white" : "text-porch-text"}`}>
                      {opt.label}
                    </p>
                    <p
                      className={`mt-0.5 text-[13px] leading-relaxed ${
                        selected ? "text-[#F1D9E1]" : "text-porch-text-secondary"
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
                className="btn-press rounded-[10px] border-none bg-porch-accent px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="mb-1 font-display text-2xl font-semibold text-porch-text">
              Where is your home located?
            </h1>
            <p className="mb-8 text-[14px] leading-relaxed text-porch-text-secondary">
              Used to find local contractors and estimate repair costs in your area. We never access your
              device location.
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
              className="w-full rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-3 text-sm text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
            />

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="btn-press rounded-[10px] border border-porch-border-input bg-porch-surface px-4 py-2.5 text-sm font-semibold text-porch-text-secondary"
              >
                ← Back
              </button>
              <button
                onClick={handleFinish}
                disabled={!location.trim() || saving}
                className="btn-press rounded-[10px] border-none bg-porch-accent px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
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
