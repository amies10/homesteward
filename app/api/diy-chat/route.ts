import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { StoredChatMessage } from "@/lib/sections";

const client = new Anthropic();

function toAnthropicMessages(
  messages: StoredChatMessage[]
): Anthropic.MessageParam[] {
  return messages.map((msg) => {
    if (msg.role === "assistant") {
      return { role: "assistant", content: msg.text };
    }

    if (msg.imageBase64 && msg.imageMimeType) {
      return {
        role: "user",
        content: [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: msg.imageMimeType as
                | "image/jpeg"
                | "image/png"
                | "image/gif"
                | "image/webp",
              data: msg.imageBase64,
            },
          },
          ...(msg.text ? [{ type: "text" as const, text: msg.text }] : []),
        ],
      };
    }

    return { role: "user", content: msg.text };
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, issueTitle, issueDescription, severity, photoUrls } = body as {
      messages: StoredChatMessage[];
      issueTitle: string;
      issueDescription: string;
      severity: string;
      photoUrls?: string[];
    };

    if (!messages?.length) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    const anthropicMessages = toAnthropicMessages(messages);

    // Attach issue-gallery photos to only the newest user turn, not every
    // message in history, so they aren't re-sent (and re-billed) each call.
    if (photoUrls?.length) {
      const last = anthropicMessages[anthropicMessages.length - 1];
      if (last?.role === "user") {
        const imageBlocks: Anthropic.ImageBlockParam[] = photoUrls.map((url) => ({
          type: "image",
          source: { type: "url", url },
        }));
        last.content =
          typeof last.content === "string"
            ? [...imageBlocks, { type: "text", text: last.content }]
            : [...imageBlocks, ...last.content];
      }
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: `You are helping a homeowner fix something in their house right now. The repair:

Title: ${issueTitle}
Description: ${issueDescription}
Severity: ${severity}

Voice: talk like a retired tradesman helping a neighbor — warm, plain, direct. You've done this job a hundred times and you're glad to walk them through it.

Rules:
- Short answers. Two or three sentences covers most questions. Go longer only when they ask for a full walkthrough, and even then, no padding.
- Plain words. "Shut off the water" not "ensure the water supply is deactivated."
- Answer the question first. Add detail only if it changes what they should do.
- Numbered steps only when order matters. Otherwise prose.
- Never open with "Certainly!", "Great question!", or any preamble. Just answer.
- No caveats they didn't ask for. Mention safety only when a step is genuinely dangerous, in one plain sentence.
- Don't repeat what's already in their step-by-step plan.
- A little personality is fine — "that valve's always in an awkward spot" — never at the cost of clarity.

Stay on this repair. If they ask about something unrelated, warmly steer them back to the job.

If they share a photo, say what you see and what it means for the fix — specifics, not descriptions.`,
      messages: anthropicMessages,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return NextResponse.json({ text: textBlock?.text ?? "" });
  } catch (error) {
    console.error("Error in /api/diy-chat:", error);
    return NextResponse.json(
      { error: "Failed to get response" },
      { status: 500 }
    );
  }
}
