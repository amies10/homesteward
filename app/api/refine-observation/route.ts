import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      rawObservation: string;
      issueTitle: string;
      issueDescription: string;
    };

    const { rawObservation, issueTitle, issueDescription } = body;

    if (!rawObservation?.trim()) {
      return NextResponse.json({ error: "Missing observation text" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system:
        "You clean up homeowner voice notes and typed observations about home repair issues. Fix grammar, remove filler words, and make the text clear and concise — but preserve every specific detail the person mentions (measurements, timing, location, severity, materials). Keep it in first person. Return only the polished observation text, nothing else.",
      messages: [
        {
          role: "user",
          content: `Issue context: ${issueTitle} — ${issueDescription}

Homeowner's raw observation:
"${rawObservation}"

Return only the polished version. Keep it to 1–3 sentences unless the detail genuinely requires more.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Unexpected AI response" }, { status: 500 });
    }

    return NextResponse.json({ observation: textBlock.text.trim() });
  } catch (error) {
    console.error("[refine-observation] Error:", error);
    return NextResponse.json({ error: "Failed to refine observation" }, { status: 500 });
  }
}
