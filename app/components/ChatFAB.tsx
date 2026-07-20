"use client";

import { useEffect, useRef, useState } from "react";
import type { StoredChatMessage } from "@/lib/sections";
import { streamChat } from "@/lib/chat-stream";
import AssistantAvatar from "./AssistantAvatar";
import BottomSheet from "./BottomSheet";
import MicButton from "./MicButton";
import { renderInlineMarkdown } from "./inlineMarkdown";
import { CameraIcon, SendIcon } from "./icons";

interface Props {
  scope: "global" | "section" | "issue";
  storageKey: string;
  title: string;
  placeholder: string;
  emptyStateText: string;
  context: Record<string, unknown>;
  suggestedPrompts?: string[];
}

export default function ChatFAB({ scope, storageKey, title, placeholder, emptyStateText, context, suggestedPrompts }: Props) {
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage, keyed on storageKey
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

  async function sendMessage(textOverride?: string) {
    const text = (textOverride ?? inputText).trim();
    if (!text && !pendingImage) return;

    const userMsg: StoredChatMessage = {
      role: "user",
      text,
      imageBase64: pendingImage?.base64,
      imageMimeType: pendingImage?.mimeType,
      timestamp: new Date().toISOString(),
    };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    localStorage.setItem(key, JSON.stringify(withUser));
    setInputText("");
    setPendingImage(null);
    setLoading(true);
    setError(null);

    const placeholder: StoredChatMessage = { role: "assistant", text: "", timestamp: new Date().toISOString() };
    setMessages([...withUser, placeholder]);

    try {
      const finalText = await streamChat("/api/assistant-chat", { messages: withUser, scope, context }, (accumulated) => {
        setMessages((prev) => prev.map((m, i) => (i === prev.length - 1 ? { ...m, text: accumulated } : m)));
      });
      const finalMessages = [...withUser, { ...placeholder, text: finalText }];
      setMessages(finalMessages);
      localStorage.setItem(key, JSON.stringify(finalMessages));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get response");
      setMessages(withUser);
    } finally {
      setLoading(false);
    }
  }

  const lastMessage = messages[messages.length - 1];
  const lastAssistantText = lastMessage?.role === "assistant" ? lastMessage.text : "";

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask a question"
          className="btn-press fixed bottom-[22px] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border-none bg-porch-accent shadow-[0_4px_14px_rgba(125,35,74,0.4)]"
        >
          <AssistantAvatar size={34} variant="full" />
        </button>
      )}

      {open && (
        <BottomSheet
          zIndex={50}
          collapsedHeight={140}
          initialHeight={typeof window !== "undefined" ? Math.round(window.innerHeight * 0.65) : 500}
          onClose={() => setOpen(false)}
          persistentContent={
            <div className="w-full px-5 pb-1 pt-0.5 text-[15px] font-semibold text-porch-text">{title}</div>
          }
          footer={
            <div className="shrink-0 border-t border-[#F2EBE1] px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-2.5">
              {pendingImage && (
                <div className="mb-2 flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  onClick={() => sendMessage()}
                  disabled={loading || (!inputText.trim() && !pendingImage)}
                  aria-label="Send"
                  className="btn-press flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full border-none bg-porch-accent disabled:opacity-50"
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          }
        >
          {messages.length === 0 && !loading && (
            <div className="pt-5 text-center">
              <p className="text-[13.5px] text-porch-text-faint">{emptyStateText}</p>
              {!!suggestedPrompts?.length && (
                <div className="mt-3.5 flex flex-wrap justify-center gap-2 px-2">
                  {suggestedPrompts.slice(0, 4).map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(prompt)}
                      className="btn-press rounded-full border border-porch-accent/40 bg-porch-accent-tint px-3.5 py-2.5 text-[13px] text-porch-accent"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="space-y-3">
            {messages.map((msg, i) => {
              if (!msg.text && !msg.imageBase64) return null;
              return (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-porch-surface border border-porch-border text-porch-text"
                        : "bg-porch-accent-tint border border-[#ECE0E6] text-porch-text"
                    }`}
                  >
                    {msg.imageBase64 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:${msg.imageMimeType};base64,${msg.imageBase64}`}
                        alt="Uploaded"
                        className="mb-2 max-h-48 rounded-lg object-contain"
                      />
                    )}
                    {msg.text && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{renderInlineMarkdown(msg.text)}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && lastAssistantText === "" && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-porch-border bg-porch-surface px-4 py-2.5">
                  <p className="text-sm text-porch-text-tertiary">Thinking…</p>
                </div>
              </div>
            )}
            {error && <p className="text-center text-xs text-red-500">{error}</p>}
            <div ref={bottomRef} />
          </div>
        </BottomSheet>
      )}
    </>
  );
}
