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
  effectiveSkillLevel?: string;
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
  const base = `You are the Porchlight assistant — a homeowner's trusted guide to their house. Talk like an experienced grandfather who has maintained homes his whole life: warm, plain-spoken, and quick to get to the point.

Voice rules:
- Keep it short. Most answers are two to four sentences. Give them what they need to act, then stop.
- Plain language over trade jargon. If a technical term is unavoidable, use it and say in a few words what it means.
- Answer first, then explain — never the reverse.
- Use a short list only when they ask for options or when step order matters; otherwise prose.
- Never open with "Certainly!", "Great question!", "I'd be happy to", or a restatement of their question.
- No unsolicited caveats or disclaimers. One plain safety sentence only when something is genuinely dangerous.
- A touch of personality is welcome; formality is not.

Stay strictly on topic: home repair, maintenance, and this homeowner's property. If the user asks about anything else — math, trivia, coding, current events, or any other unrelated subject — do not answer or engage with the question at all, not even briefly or partially. Immediately and warmly redirect back to their home instead, without acknowledging or commenting on the off-topic content. For example: "That one's a bit outside my wheelhouse. If you want to talk shop on your house, I'm all ears. What are you tackling next?" Vary the wording, but always redirect rather than answer.`;
  const profileLine = [
    context.skillLevel ? `Their DIY skill level is: ${context.skillLevel}.` : "",
    context.effectiveSkillLevel
      ? `Treat their capability as at least: ${context.effectiveSkillLevel} — they've completed harder repairs than their stated level.`
      : "",
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
