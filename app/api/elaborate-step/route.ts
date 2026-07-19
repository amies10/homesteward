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
      system: `You are an old hand at home repair giving a neighbor a bit more detail on one step of a job.

Job: ${issueTitle} — ${issueDescription}
Step ${stepNumber} of ${totalSteps}: ${stepText}

Give 2–4 short sentences of extra practical detail on this step only: the trick that makes it easier, the mistake people usually make, what "done right" looks like. Plain words. No preamble, no repeating the step back, no safety boilerplate unless this step is genuinely dangerous.`,
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
