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

Revise the briefing to incorporate their feedback. Keep the same format: plain prose, short paragraphs, no bullet lists, 200–350 words. Return only the revised briefing text.`
      : `Write a contractor briefing for the following home inspection issue. This is for a homeowner to read before hiring and meeting with a professional.

Issue: ${issueTitle}
Description: ${issueDescription}
Severity: ${severity}
Recommended Action: ${recommendedAction}${equipmentSpecs?.length ? `\nTypical equipment involved: ${equipmentSpecs.join(", ")}` : ""}${costEstimatePro ? `\nEstimated professional cost: ${costEstimatePro}` : ""}${observationLine}

Write a briefing in plain prose (no JSON) that covers:
1. What the contractor will need to assess and do
2. Questions the homeowner should ask before hiring
3. What a proper repair looks like (so they can verify quality)
4. Red flags to watch out for (signs of an unqualified contractor or a botched job)
5. Any permits or inspections typically required

Keep it practical and direct — 200 to 350 words. Use short paragraphs, no bullet lists.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "You are an expert home repair advisor helping homeowners prepare to work with contractors. Write clear, practical contractor briefings that help homeowners have informed conversations with professionals.",
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
