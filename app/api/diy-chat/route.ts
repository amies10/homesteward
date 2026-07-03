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
    const { messages, issueTitle, issueDescription, severity } = body as {
      messages: StoredChatMessage[];
      issueTitle: string;
      issueDescription: string;
      severity: string;
    };

    if (!messages?.length) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: `You are a home repair assistant helping a homeowner complete a specific repair task.

The repair task is:
Title: ${issueTitle}
Description: ${issueDescription}
Severity: ${severity}

You may only discuss this specific repair task. If the user asks about anything unrelated to this repair, politely redirect them back to the task at hand.

Keep answers concise and practical — like advice from an experienced contractor. Use clear language, avoid jargon when possible, and focus on what the homeowner needs to know to complete the job safely and correctly. If the user shares a photo, describe what you see and give specific, actionable guidance based on it.`,
      messages: toAnthropicMessages(messages),
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
