interface Props {
  size?: number;
  showWordmark?: boolean;
  wordmarkSize?: number;
  wordmarkColor?: string;
  className?: string;
}

export default function Logo({
  size = 34,
  showWordmark = true,
  wordmarkSize = 22,
  wordmarkColor = "#262220",
  className = "",
}: Props) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        style={{ width: size, height: size, borderRadius: size * 0.32 }}
        className="flex shrink-0 items-center justify-center bg-porch-accent"
      >
        <svg
          width={size * 0.6}
          height={size * 0.6}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M4 8 L12 8 L20 8" stroke="#FAF7F2" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M8 8 L4 6" stroke="#FAF7F2" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 8 L20 6" stroke="#FAF7F2" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M9 8 L9 19" stroke="#FAF7F2" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M16 8 L16 19" stroke="#FAF7F2" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16" cy="12.2" r="2.3" fill="#C48A5A" stroke="none" />
        </svg>
      </div>
      {showWordmark && (
        <span
          style={{ fontSize: wordmarkSize, color: wordmarkColor }}
          className="font-display font-bold tracking-tight"
        >
          Porchlight
        </span>
      )}
    </div>
  );
}
