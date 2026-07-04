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
      costEstimateDIY,
      feedback,
      existingMaterialsList,
      existingStepByStepPlan,
      userObservation,
    } = body as {
      issueTitle: string;
      issueDescription: string;
      severity: string;
      recommendedAction: string;
      equipmentSpecs?: string[];
      costEstimateDIY?: string;
      feedback?: string;
      existingMaterialsList?: Array<{ item: string; estimatedCost: string }>;
      existingStepByStepPlan?: string[];
      userObservation?: string;
    };

    if (!issueTitle || !issueDescription) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const isRefinement = !!(feedback && existingMaterialsList && existingStepByStepPlan);

    const observationLine = userObservation
      ? `\nHomeowner's firsthand observation: ${userObservation}`
      : "";

    const userContent = isRefinement
      ? `You previously generated this DIY repair plan for the following issue:

Issue: ${issueTitle}
Description: ${issueDescription}${observationLine}

--- Current Materials List ---
${existingMaterialsList!.map((m) => `- ${m.item} (${m.estimatedCost})`).join("\n")}

--- Current Step-by-Step Plan ---
${existingStepByStepPlan!.map((s, i) => `${i + 1}. ${s}`).join("\n")}

The homeowner has this feedback:
"${feedback}"

Revise the plan to address their feedback. Return the complete updated plan — include all items and steps, not just the changes. Use the same JSON structure.`
      : `Generate a detailed DIY repair plan for the following home inspection issue.

Issue: ${issueTitle}
Description: ${issueDescription}
Severity: ${severity}
Recommended Action: ${recommendedAction}${equipmentSpecs?.length ? `\nEquipment typically needed: ${equipmentSpecs.join(", ")}` : ""}${costEstimateDIY ? `\nEstimated DIY cost: ${costEstimateDIY}` : ""}${observationLine}

For materialsList: list every tool, material, and consumable a homeowner needs to complete this repair. Include estimated individual costs using en-dash (–) between low and high values.

For stepByStepPlan: provide clear, safe, numbered steps a homeowner can follow. Each step should be a complete sentence. Include safety precautions where relevant. Be thorough — aim for 6–12 steps.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system:
        "You are an expert home repair advisor. Generate detailed, accurate DIY repair plans for homeowners. Return only valid JSON with no surrounding text or markdown.",
      messages: [
        {
          role: "user",
          content: `${userContent}

Return a JSON object in this exact structure:
{
  "materialsList": [
    { "item": "Tool or material name", "estimatedCost": "$10–$30" }
  ],
  "stepByStepPlan": [
    "Step 1: ...",
    "Step 2: ..."
  ]
}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Unexpected response from AI" }, { status: 500 });
    }

    let parsed;
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[generate-diy] JSON parse failed:", e, textBlock.text);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error in /api/generate-diy:", error);
    return NextResponse.json({ error: "Failed to generate DIY plan" }, { status: 500 });
  }
}
