import type { SkillLevel } from "@/lib/sections";

export const SKILL_OPTIONS: Array<{
  value: SkillLevel;
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

interface Props {
  value: SkillLevel | null;
  onChange: (value: SkillLevel) => void;
}

export default function SkillLevelPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2.5">
      {SKILL_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
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
  );
}
