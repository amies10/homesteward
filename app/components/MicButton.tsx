"use client";

import { useEffect, useRef, useState } from "react";

// Speech Recognition is not in all TS DOM lib versions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

const UNSUPPORTED_MESSAGE = "Voice input isn't available in this browser. Try Chrome, or just type.";

interface Props {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function MicButton({ onTranscript, disabled, className = "" }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [showUnsupportedTip, setShowUnsupportedTip] = useState(false);
  const recognitionRef = useRef<AnySpeechRecognition>(null);
  const tipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser feature detection, must run client-side post-hydration
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    return () => {
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
    };
  }, []);

  function toggle() {
    if (!supported) {
      setShowUnsupportedTip(true);
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current);
      tipTimeoutRef.current = setTimeout(() => setShowUnsupportedTip(false), 3000);
      return;
    }

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcript = Array.from<any>(e.results)
        .map((r) => r[0].transcript as string)
        .join(" ")
        .trim();
      if (transcript) onTranscript(transcript);
    };

    recognitionRef.current = rec;
    rec.start();
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-disabled={!supported}
        title={supported ? (listening ? "Stop recording" : "Voice input") : UNSUPPORTED_MESSAGE}
        className={`flex items-center justify-center rounded-md border px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1 ${
          !supported
            ? "border-stone-300 bg-white text-stone-500 opacity-60"
            : listening
              ? "animate-pulse border-red-300 bg-red-50 text-red-500"
              : "border-stone-300 bg-white text-stone-500 hover:bg-stone-50"
        } disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      </button>
      {showUnsupportedTip && (
        <div
          role="tooltip"
          className="absolute bottom-full right-0 z-20 mb-2 w-[200px] rounded-[10px] border border-porch-border bg-porch-surface px-3 py-2 text-[11.5px] leading-snug text-porch-text-secondary shadow-[0_4px_14px_rgba(38,34,32,0.12)]"
        >
          {UNSUPPORTED_MESSAGE}
        </div>
      )}
    </div>
  );
}
