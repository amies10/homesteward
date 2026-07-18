import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { StoredChatMessage } from "@/lib/sections";

const client = new Anthropic();

function toAnthropicMessages(messages: StoredChatMessage[]): Anthropic.MessageParam[] {
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
              media_type: msg.imageMimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
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

interface AssistantChatContext {
  skillLevel?: string;
  location?: string;
  propertyAddress?: string;
  sections?: { name: string; issueCount: number }[];
  sectionName?: string;
  sectionIssues?: { title: string; severity: string }[];
  issueTitle?: string;
  issueDescription?: string;
  issueSeverity?: string;
}

function buildSystemPrompt(scope: "global" | "section" | "issue", context: AssistantChatContext): string {
  const base = "You are the Porchlight assistant, a knowledgeable, friendly home-repair guide helping a homeowner take care of their house.";
  const profileLine = [
    context.skillLevel ? `Their DIY skill level is: ${context.skillLevel}.` : "",
    context.location ? `They're located near: ${context.location}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (scope === "issue") {
    return `${base} ${profileLine}

You're currently focused on this specific issue from their inspection report:
Title: ${context.issueTitle}
Description: ${context.issueDescription}
Severity: ${context.issueSeverity}

Answer questions about this issue specifically — whether to DIY or call a pro, what it might cost, what's involved. Keep answers concise and practical, like advice from an experienced, patient contractor.`;
  }

  if (scope === "section") {
    const issueList = (context.sectionIssues ?? [])
      .map((i) => `- ${i.title} (${i.severity})`)
      .join("\n");
    return `${base} ${profileLine}

You're currently focused on the "${context.sectionName}" section of their home. Here are the known issues in this section:
${issueList || "(no issues logged yet)"}

Answer questions about this section — what to prioritize, what an issue means, what to expect. Keep answers concise and practical.`;
  }

  const sectionList = (context.sections ?? [])
    .map((s) => `- ${s.name}: ${s.issueCount} open issue${s.issueCount === 1 ? "" : "s"}`)
    .join("\n");
  return `${base} ${profileLine}

Here's an overview of their home's inspection report by section:
${sectionList || "(no report uploaded yet)"}

Answer questions about their home overall — what to tackle next, how sections relate, general guidance. Keep answers concise, warm, and practical.`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, scope, context } = body as {
      messages: StoredChatMessage[];
      scope: "global" | "section" | "issue";
      context: AssistantChatContext;
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: buildSystemPrompt(scope, context ?? {}),
      messages: toAnthropicMessages(messages),
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return NextResponse.json({ text: textBlock?.type === "text" ? textBlock.text : "" });
  } catch (error) {
    console.error("Error in /api/assistant-chat:", error);
    return NextResponse.json({ error: "Failed to get response" }, { status: 500 });
  }
}
