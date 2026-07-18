import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { issueTitle, issueDescription, stepText, stepNumber, totalSteps } = body as {
      issueTitle: string;
      issueDescription: string;
      stepText: string;
      stepNumber: number;
      totalSteps: number;
    };

    if (!issueTitle || !stepText) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system:
        "You are an experienced contractor giving a homeowner extra, practical detail on one step of a repair they're doing themselves. Keep it to 2-4 short sentences of plain prose — no headers, no lists. Cover things like: what \"good enough\" looks like, a common mistake to avoid, or a shortcut/alternative if they're missing a tool.",
      messages: [
        {
          role: "user",
          content: `Repair: ${issueTitle}
${issueDescription ? `Context: ${issueDescription}` : ""}

This is step ${stepNumber} of ${totalSteps}:
"${stepText}"

Give the homeowner a bit more detail on just this step.`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return NextResponse.json({ detail: textBlock?.type === "text" ? textBlock.text.trim() : "" });
  } catch (error) {
    console.error("Error in /api/elaborate-step:", error);
    return NextResponse.json({ error: "Failed to get more detail" }, { status: 500 });
  }
}
