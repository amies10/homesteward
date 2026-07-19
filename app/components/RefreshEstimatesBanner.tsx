interface Props {
  onRefresh: () => void;
  refreshing: boolean;
  progress?: string | null;
}

export default function RefreshEstimatesBanner({ onRefresh, refreshing, progress }: Props) {
  return (
    <div className="mx-5 mt-3 rounded-2xl border border-porch-border bg-porch-accent-tint px-4 py-3.5">
      <p className="text-[13.5px] font-semibold text-porch-text">Update cost estimates for your area?</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-porch-text-secondary">
        Your report&apos;s cost estimates were generated before your location was set — they may run low.
      </p>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="btn-press mt-2.5 rounded-[8px] border-none bg-porch-accent px-3.5 py-2 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {refreshing ? progress || "Refreshing…" : "Refresh estimates"}
      </button>
    </div>
  );
}
