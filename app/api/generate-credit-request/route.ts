import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const client = new Anthropic();

interface CreditRequestIssue {
  title: string;
  description: string;
  severity: string;
  costEstimatePro?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { propertyAddress, buyerName, requestedTotal, issues } = body as {
      propertyAddress?: string;
      buyerName?: string;
      requestedTotal: string;
      issues: CreditRequestIssue[];
    };

    if (!issues || issues.length === 0) {
      return NextResponse.json({ error: "At least one issue is required" }, { status: 400 });
    }

    const introLines = [
      propertyAddress ? `Property address: ${propertyAddress}` : null,
      buyerName ? `Buyer name: ${buyerName}` : null,
    ].filter(Boolean);

    const issueLines = issues
      .map(
        (issue, i) =>
          `${i + 1}. ${issue.title} — ${issue.description} (Severity: ${issue.severity}; Estimated professional repair cost: ${
            issue.costEstimatePro ?? "N/A"
          })`
      )
      .join("\n");

    const userContent = `${introLines.length ? introLines.join("\n") + "\n\n" : ""}Findings:\n${issueLines}\n\nRequested credit: ${requestedTotal}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system:
        "You draft seller credit request documents for homebuyers based on home assessment findings. Write in clear, professional, neutral language suitable for a buyer's agent to forward to a listing agent. Use only the findings and figures provided — never invent issues, prices, or legal terms. This is a negotiation aid, not a legal document. Return only the document text in markdown: a brief opening paragraph, an itemized list (each item: issue, one-line description, estimated professional repair cost), a stated total requested credit, and a short closing paragraph noting estimates are based on typical professional repair costs and the buyer remains open to discussion.",
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

    return NextResponse.json({ document: textBlock.text.trim() });
  } catch (error) {
    console.error("Error in /api/generate-credit-request:", error);
    return NextResponse.json({ error: "Failed to generate credit request" }, { status: 500 });
  }
}
