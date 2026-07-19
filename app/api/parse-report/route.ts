import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const location = (formData.get("location") as string | null)?.trim() || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const response = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 32000,
      system:
        "You are an expert home inspector report analyzer. Extract all deficiencies, repair items, safety concerns, and maintenance notes from home inspection reports. Return only valid JSON with no surrounding text or markdown.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Read this home inspection report and extract every issue, deficiency, repair item, safety concern, and maintenance note.

Categorize each issue into one of these home sections (use these exact names):
- Exterior
- Roofing
- Structure
- Attic and Insulation
- Interior
- Heating and Air Conditioning
- Electrical
- Plumbing
- Bathrooms
- Appliances

For each issue, assign a severity:
- "safety": Safety hazards requiring immediate attention
- "repair": Items needing repair or replacement
- "maintenance": Routine maintenance items
- "improvement": Recommended improvements or upgrades
- "fyi": Informational notes, no action required

Return a JSON object in this exact structure, with no other text:
{
  "propertyAddress": "123 Main St, Anytown, CA 90210",
  "propertyDetails": {
    "yearBuilt": 1998,
    "squareFeet": 2100,
    "homeStyle": "Colonial",
    "roofType": "Asphalt shingle",
    "roofAgeYears": 12,
    "hvacType": "Forced air gas furnace / central AC",
    "hvacAgeYears": 8,
    "foundationType": "Poured concrete basement",
    "bedrooms": 3,
    "bathrooms": 2.5,
    "otherSpecs": [{ "label": "Water heater", "value": "50 gal gas, installed 2019" }]
  },
  "sections": [
    {
      "name": "Section Name",
      "issues": [
        {
          "title": "Brief issue title",
          "description": "Original description from the report",
          "severity": "safety|repair|maintenance|improvement|fyi",
          "recommendedAction": "What should be done",
          "costEstimateDIY": "$50–$150",
          "costEstimatePro": "$200–$500",
          "minimumSkillLevel": "beginner|some_experience|experienced|expert",
          "equipmentSpecs": ["Tool or equipment name", "Another item"]
        }
      ]
    }
  ]
}

For propertyAddress: extract the subject property address from the report if it appears (typically on the cover page, header, or client information section). Set to null if not found.

For propertyDetails: extract every field only when the report actually states it (cover page, general property description, or system-specific sections). Set any field to null when the report doesn't mention it — never guess. otherSpecs is an array of any other notable property specs the report mentions that don't fit the named fields (e.g. garage, pool, deck, sump pump); return an empty array if none.

Cost estimates must reflect real-world pricing in and around: ${location ?? "an unspecified location — use US national averages"}.
costEstimatePro is the full invoice a homeowner would actually pay in that market: labor at local rates, parts and materials with contractor markup, a service-call/trip charge, and sales tax where applicable. Never quote bare labor rates — even a small pro visit rarely invoices under $150–$250 in most US markets.
costEstimateDIY uses local big-box retail material prices, excluding tools. Use en-dash (–) between the low and high values. If a repair is not DIY-appropriate (e.g. electrical panel work, structural repairs), set costEstimateDIY to null. If a professional is not typically needed (e.g. replacing a lightbulb), set costEstimatePro to null.

For minimumSkillLevel, assess the minimum skill level a homeowner needs to safely DIY this repair. Use these levels:
- "beginner": No experience needed (e.g. cleaning gutters, replacing air filters, caulking)
- "some_experience": Basic tool familiarity needed (e.g. replacing a faucet, patching drywall, installing a ceiling fan)
- "experienced": Significant hands-on experience needed (e.g. repairing roof flashing, replacing subfloor, repairing chimney)
- "expert": Professional-grade skills needed (e.g. electrical panel work, structural repairs, gas line work)
If costEstimateDIY is null (not DIY-appropriate), still set minimumSkillLevel to the level that would theoretically be required — it will be used for informational purposes.

For equipmentSpecs, list the key tools and equipment a homeowner or contractor would need for this repair — concise names only, no costs. If no special tools are needed, return an empty array.

Only include sections that have at least one issue. If this is not a home inspection report or no issues are found, return {"sections": []}.`,
            },
          ],
        },
      ],
    }).finalMessage();

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response from AI" },
        { status: 500 }
      );
    }

    console.log("[parse-report] raw response:", textBlock.text);

    let parsed;
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[parse-report] JSON parse failed:", e);
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON" },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error in /api/parse-report:", error);
    return NextResponse.json(
      { error: "Failed to process report" },
      { status: 500 }
    );
  }
}
