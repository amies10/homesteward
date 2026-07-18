interface Props {
  size?: number;
  variant?: "full" | "bust";
  className?: string;
}

/** The illustrated "grandfatherly contractor" mark used as the AI assistant's avatar. */
export default function AssistantAvatar({ size = 24, variant = "bust", className = "" }: Props) {
  const height = Math.round((size * 32) / 24);
  return (
    <svg
      width={size}
      height={height}
      viewBox="0 0 24 32"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="11.5" cy="5.6" r="3.1" fill="#F2D9C4" stroke="none" />
      <path
        d="M7 6.8c-.5 1.7.1 3 .9 3.8.1-.8.3-1.4.7-1.9.1 1.1.7 2.1 1.6 2.5.1-.7.2-1.3.5-1.6.3.8 1 1.4 1.8 1.6.3-.5.3-1 .4-1.6.5.5.9 1.1 1 1.8.8-.9 1.3-2.2.8-3.8-.7-.6-1.9-.9-3.4-.9s-2.7.3-3.3.9z"
        fill="#FAF7F2"
        stroke="none"
      />
      {variant === "full" && (
        <path
          d="M8.2 3.6c.5-.7 1.5-1.1 2.8-1.1s2.3.4 2.8 1.1"
          stroke="#FAF7F2"
          strokeWidth="1.1"
          fill="none"
        />
      )}
      {variant === "full" && (
        <>
          <circle cx="10.2" cy="5.5" r="0.35" fill="#4B2A22" stroke="none" />
          <circle cx="13" cy="5.5" r="0.35" fill="#4B2A22" stroke="none" />
        </>
      )}
      <path
        d="M5.2 15.5c.6-2.4 3-3.7 6.3-3.7s5.7 1.3 6.3 3.7l1.2 8.7c.1 1-.6 1.8-1.6 1.8H5.6c-1 0-1.7-.8-1.6-1.8z"
        fill="#4B2A22"
        stroke="none"
      />
      {variant === "full" && (
        <>
          <path d="M7.4 12.6 6 26" stroke="#3A2119" strokeWidth="1" fill="none" />
          <path d="M16 12.6 17.4 26" stroke="#3A2119" strokeWidth="1" fill="none" />
          <path d="M9.5 26v3.2M13.5 26v3.2" stroke="#3A2119" strokeWidth="1.6" fill="none" />
          <path d="M14.5 15.5c1.6.3 2.6 1.3 2.7 2.7" stroke="#F2D9C4" strokeWidth="1.3" fill="none" />
          <path
            d="M15.2 17.7h3.4a1 1 0 0 1 1 1.1c-.2 1.6-1.4 2.6-3 2.6h-1.4z"
            fill="#FAF7F2"
            stroke="none"
          />
          <rect x="12.4" y="17.3" width="3.4" height="4.3" rx="0.7" fill="#FAF7F2" stroke="none" />
          <path
            d="M13.1 16.6c0-.5.3-.7.5-1M14.4 16.6c0-.5.3-.7.5-1"
            stroke="#C9BFB2"
            strokeWidth="0.9"
            fill="none"
          />
        </>
      )}
    </svg>
  );
}
