import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const client = new Anthropic();

interface EstimateIssue {
  title: string;
  description: string;
  severity: string;
  recommendedAction: string;
  costEstimateDIY?: string | null;
  costEstimatePro?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const serverClient = createServerSupabaseClient();
    const { data: userData, error: userError } = await serverClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    const body = await request.json();
    const { issues, location } = body as { issues: EstimateIssue[]; location: string };

    if (!issues?.length) {
      return NextResponse.json({ error: "No issues provided" }, { status: 400 });
    }

    const issuesJson = JSON.stringify(
      issues.map((issue, i) => ({
        index: i,
        title: issue.title,
        description: issue.description,
        severity: issue.severity,
        recommendedAction: issue.recommendedAction,
      }))
    );

    const response = await client.messages
      .stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `You are an expert home repair cost estimator. Return only valid JSON with no surrounding text or markdown.

Cost estimates must reflect real-world pricing in and around: ${location}.
costEstimatePro is the full invoice a homeowner would actually pay in that market: labor at local rates, parts and materials with contractor markup, a service-call/trip charge, and sales tax where applicable. Never quote bare labor rates — even a small pro visit rarely invoices under $150–$250 in most US markets.
costEstimateDIY uses local big-box retail material prices, excluding tools. Use en-dash (–) between the low and high values. If a repair is not DIY-appropriate, set costEstimateDIY to null. If a professional is not typically needed, set costEstimatePro to null.`,
        messages: [
          {
            role: "user",
            content: `Re-estimate costs for each of these home repair issues, in order. Return a JSON object of this exact shape, with one entry per issue in the same order:
{
  "estimates": [
    { "costEstimateDIY": "$50–$150", "costEstimatePro": "$200–$500" }
  ]
}

Issues:
${issuesJson}`,
          },
        ],
      })
      .finalMessage();

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Unexpected response from AI" }, { status: 500 });
    }

    let parsed: { estimates: Array<{ costEstimateDIY: string | null; costEstimatePro: string | null }> };
    try {
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON object found in response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("[refresh-estimates] JSON parse failed:", e);
      return NextResponse.json({ error: "Failed to parse AI response as JSON" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error in /api/refresh-estimates:", error);
    return NextResponse.json({ error: "Failed to refresh estimates" }, { status: 500 });
  }
}
