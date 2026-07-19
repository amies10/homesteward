import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      issueTitle,
      issueDescription,
      severity,
      recommendedAction,
      equipmentSpecs,
      costEstimatePro,
      feedback,
      existingBriefing,
      userObservation,
    } = body as {
      issueTitle: string;
      issueDescription: string;
      severity: string;
      recommendedAction: string;
      equipmentSpecs?: string[];
      costEstimatePro?: string;
      feedback?: string;
      existingBriefing?: string;
      userObservation?: string;
    };

    if (!issueTitle || !issueDescription) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const isRefinement = !!(feedback && existingBriefing);

    const observationLine = userObservation
      ? `\nHomeowner's firsthand observation: ${userObservation}`
      : "";

    const userContent = isRefinement
      ? `You previously wrote this contractor briefing for a home inspection issue:

Issue: ${issueTitle}
Description: ${issueDescription}${observationLine}

--- Current Briefing ---
${existingBriefing}
---

The homeowner has this additional context or feedback:
"${feedback}"

Revise the briefing to incorporate their feedback. Keep the same format: four sections, each starting with a "### " markdown header using exactly these titles, followed by a blank line and then one short plain-prose paragraph (no bullet lists):
### What the contractor will assess and do

Plain paragraph text here, no bold.

### Questions to ask before hiring

Plain paragraph text here, no bold.

Do not bold, italicize, or otherwise markdown-format any of the body text — only the "### " header lines use markdown. Return only the revised briefing text.`
      : `Write a contractor briefing for the following home inspection issue. This is for a homeowner to read before hiring and meeting with a professional.

Issue: ${issueTitle}
Description: ${issueDescription}
Severity: ${severity}
Recommended Action: ${recommendedAction}${equipmentSpecs?.length ? `\nTypical equipment involved: ${equipmentSpecs.join(", ")}` : ""}${costEstimatePro ? `\nEstimated professional cost: ${costEstimatePro}` : ""}${observationLine}

Write the briefing as exactly four sections, each starting with a "### " markdown header using exactly these titles, followed by a blank line and then one short plain-prose paragraph (no bullet lists, no sub-headers):
### What the contractor will assess and do

Plain paragraph text here, no bold.

### Questions to ask before hiring

Plain paragraph text here, no bold.

### What a proper repair looks like

Plain paragraph text here, no bold.

### Red flags to watch for

Plain paragraph text here, no bold.

Do not bold, italicize, or otherwise markdown-format any of the body text — only the "### " header lines use markdown. Mention permits or inspections where relevant within those sections rather than as a separate one. Keep it practical and direct — 220 to 380 words total.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "You are an expert home repair advisor helping homeowners prepare to work with contractors. Write clear, practical contractor briefings that help homeowners have informed conversations with professionals.\n\nWrite in plain, direct language a homeowner actually talks in — like a knowledgeable friend prepping them for the contractor visit, not a consumer-affairs pamphlet. Short sentences. No filler like \"It's important to note\" and no generic advice that applies to every repair.",
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Unexpected response from AI" }, { status: 500 });
    }

    return NextResponse.json({ contractorBriefing: textBlock.text.trim() });
  } catch (error) {
    console.error("Error in /api/generate-expert:", error);
    return NextResponse.json({ error: "Failed to generate expert guide" }, { status: 500 });
  }
}
