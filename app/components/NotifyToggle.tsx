interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  showNote?: boolean;
}

export default function NotifyToggle({ checked, onChange, label = "Remind me when this is due", showNote }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12.5px] text-porch-text-secondary">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`btn-press relative h-6 w-11 shrink-0 rounded-full border-none transition-colors ${
            checked ? "bg-porch-accent" : "bg-porch-border"
          }`}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
      </div>
      {showNote && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-porch-text-tertiary">
          Reminders will be delivered once Porchlight is added to your home screen.
        </p>
      )}
    </div>
  );
}
