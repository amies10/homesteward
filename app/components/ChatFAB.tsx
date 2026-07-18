"use client";

import { useEffect, useRef, useState } from "react";
import type { StoredChatMessage } from "@/lib/sections";
import AssistantAvatar from "./AssistantAvatar";
import MicButton from "./MicButton";
import { CameraIcon, ChevronLeftIcon, SendIcon } from "./icons";

interface Props {
  scope: "global" | "section" | "issue";
  storageKey: string;
  title: string;
  placeholder: string;
  emptyStateText: string;
  context: Record<string, unknown>;
}

export default function ChatFAB({ scope, storageKey, title, placeholder, emptyStateText, context }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<StoredChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [pendingImage, setPendingImage] = useState<{ base64: string; mimeType: string; previewUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const key = `porchlight_chat_${storageKey}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) setMessages(JSON.parse(stored));
    } catch {}
  }, [key]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPendingImage({ base64: dataUrl.split(",")[1], mimeType: file.type, previewUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function sendMessage() {
    if (!inputText.trim() && !pendingImage) return;

    const userMsg: StoredChatMessage = {
      role: "user",
      text: inputText.trim(),
      imageBase64: pendingImage?.base64,
      imageMimeType: pendingImage?.mimeType,
      timestamp: new Date().toISOString(),
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    localStorage.setItem(key, JSON.stringify(updated));
    setInputText("");
    setPendingImage(null);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/assistant-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated, scope, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      const assistantMsg: StoredChatMessage = {
        role: "assistant",
        text: data.text,
        timestamp: new Date().toISOString(),
      };
      const withReply = [...updated, assistantMsg];
      setMessages(withReply);
      localStorage.setItem(key, JSON.stringify(withReply));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask a question"
        className="btn-press fixed bottom-[22px] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border-none bg-porch-accent shadow-[0_4px_14px_rgba(125,35,74,0.4)]"
      >
        <AssistantAvatar size={34} variant="full" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-porch-bg">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-porch-border bg-porch-surface px-5 py-4">
            <button onClick={() => setOpen(false)} aria-label="Close" className="flex items-center p-1">
              <ChevronLeftIcon size={18} />
            </button>
            <div className="text-[15px] font-semibold text-porch-text">{title}</div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            {messages.length === 0 && !loading && (
              <p className="pt-5 text-center text-[13.5px] text-porch-text-faint">{emptyStateText}</p>
            )}
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-porch-surface border border-porch-border text-porch-text"
                        : "bg-porch-accent-tint border border-[#ECE0E6] text-porch-text"
                    }`}
                  >
                    {msg.imageBase64 && (
                      <img
                        src={`data:${msg.imageMimeType};base64,${msg.imageBase64}`}
                        alt="Uploaded"
                        className="mb-2 max-h-48 rounded-lg object-contain"
                      />
                    )}
                    {msg.text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-porch-border bg-porch-surface px-4 py-2.5">
                    <p className="text-sm text-porch-text-tertiary">Thinking…</p>
                  </div>
                </div>
              )}
              {error && <p className="text-center text-xs text-red-500">{error}</p>}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="shrink-0 border-t border-[#F2EBE1] bg-porch-surface px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5">
            {pendingImage && (
              <div className="mb-2 flex items-center gap-2">
                <img src={pendingImage.previewUrl} alt="Pending" className="h-12 w-12 rounded-lg object-cover" />
                <button onClick={() => setPendingImage(null)} className="text-xs text-porch-text-tertiary hover:text-porch-text-secondary">
                  Remove
                </button>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full border border-porch-border bg-porch-bg py-1.5 pl-4 pr-1.5">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={placeholder}
                disabled={loading}
                className="flex-1 border-none bg-transparent text-[14.5px] text-porch-text outline-none placeholder:text-porch-text-tertiary disabled:opacity-50"
              />
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />
              <MicButton
                onTranscript={(t) => setInputText((prev) => (prev ? `${prev} ${t}` : t))}
                disabled={loading}
                className="!h-[34px] !w-[34px] !rounded-full !border-none !bg-porch-accent-tint !p-0"
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={loading}
                aria-label="Attach photo"
                className="btn-press flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-none bg-porch-accent-tint disabled:opacity-50"
              >
                <CameraIcon />
              </button>
              <button
                onClick={sendMessage}
                disabled={loading || (!inputText.trim() && !pendingImage)}
                aria-label="Send"
                className="btn-press flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-none bg-porch-accent disabled:opacity-50"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
