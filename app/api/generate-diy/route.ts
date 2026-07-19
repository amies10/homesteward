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
      skillLevel,
      ownedTools,
      photoUrls,
    } = body as {
      issueTitle: string;
      issueDescription: string;
      severity: string;
      recommendedAction: string;
      equipmentSpecs?: string[];
      costEstimateDIY?: string;
      feedback?: string;
      existingMaterialsList?: Array<{ item: string; estimatedCost: string; isTool?: boolean }>;
      existingStepByStepPlan?: string[];
      userObservation?: string;
      skillLevel?: string;
      ownedTools?: string[];
      photoUrls?: string[];
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
"${feedback}"${ownedTools?.length ? `\n\nThe homeowner already owns: ${ownedTools.join(", ")}. Don't list owned tools in materialsList.` : ""}

Revise the plan to address their feedback. Return the complete updated plan — include all items and steps, not just the changes. Use the same JSON structure. Keep marking each materialsList entry with "isTool".`
      : `Generate a detailed DIY repair plan for the following home inspection issue.

Issue: ${issueTitle}
Description: ${issueDescription}
Severity: ${severity}
Recommended Action: ${recommendedAction}${equipmentSpecs?.length ? `\nEquipment typically needed: ${equipmentSpecs.join(", ")}` : ""}${costEstimateDIY ? `\nEstimated DIY cost: ${costEstimateDIY}` : ""}${observationLine}${skillLevel ? `\nThe homeowner's effective skill level is ${skillLevel}. Calibrate step granularity and tool assumptions to that level.` : ""}${ownedTools?.length ? `\nThe homeowner already owns: ${ownedTools.join(", ")}. Do not include owned tools in materialsList; where a step uses one, just name it.` : ""}

For materialsList: list every tool, material, and consumable a homeowner needs to complete this repair. Include estimated individual costs using en-dash (–) between low and high values. Mark each entry "isTool": true if it's a reusable tool (drill, wrench, ladder, etc.) or "isTool": false if it's a consumable material (screws, caulk, paint, etc.).

For stepByStepPlan: provide clear, safe, numbered steps a homeowner can follow. Each step should be a complete sentence. Include safety precautions where relevant. Be thorough — aim for 6–12 steps.`;

    const imageBlocks: Anthropic.ImageBlockParam[] = (photoUrls ?? []).map((url) => ({
      type: "image",
      source: { type: "url", url },
    }));

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system:
        "You are an expert home repair advisor. Generate detailed, accurate DIY repair plans for homeowners. Return only valid JSON with no surrounding text or markdown.",
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `${userContent}${imageBlocks.length ? "\n\nPhotos of the issue are attached — use what you see to make the plan more specific." : ""}

Return a JSON object in this exact structure:
{
  "materialsList": [
    { "item": "Tool or material name", "estimatedCost": "$10–$30", "isTool": false }
  ],
  "stepByStepPlan": [
    "Step 1: ...",
    "Step 2: ..."
  ]
}`,
            },
          ],
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
