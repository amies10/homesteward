import type { UserProfile } from "@/lib/sections";

export const ACCOUNT_TYPE_OPTIONS: Array<{
  value: NonNullable<UserProfile["accountType"]>;
  emoji: string;
  label: string;
  description: string;
}> = [
  {
    value: "owner",
    emoji: "🏠",
    label: "I own this home",
    description: "Track repairs, upgrades, and maintenance for a home you own.",
  },
  {
    value: "renter",
    emoji: "🔑",
    label: "I'm renting",
    description: "Keep tabs on issues to report and fixes you or your landlord handle.",
  },
  {
    value: "prebuy",
    emoji: "🔍",
    label: "I'm evaluating a home to buy",
    description: "Review an inspection report before closing, and build a credit request.",
  },
];

interface Props {
  value: UserProfile["accountType"] | null;
  onChange: (value: NonNullable<UserProfile["accountType"]>) => void;
}

export default function AccountTypePicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2.5">
      {ACCOUNT_TYPE_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`btn-press w-full rounded-2xl border-[1.5px] px-5 py-4 text-left focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1 ${
              selected ? "border-porch-accent bg-porch-accent" : "border-porch-border bg-porch-surface"
            }`}
          >
            <p className={`text-[15px] font-semibold ${selected ? "text-white" : "text-porch-text"}`}>
              <span aria-hidden="true" className="mr-1.5">{opt.emoji}</span>
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
