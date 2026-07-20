import { NextRequest, NextResponse } from "next/server";
import type { ContractorResult } from "@/lib/sections";

const CHAIN_KEYWORDS = [
  "homeadvisor",
  "angi",
  "angie",
  "home depot",
  "lowe's",
  "lowes",
  "menards",
  "mr. rooter",
  "mr rooter",
  "roto-rooter",
  "roto rooter",
  "hometeam",
  "ars rescue",
  "one hour heating",
  "one hour air",
  "merry maids",
  "molly maid",
  "servicemaster",
  "terminix",
  "orkin",
  "truly nolen",
  "rentokil",
  "stanley steemer",
  "servpro",
  "mr. electric",
  "mr electric",
  "mister sparky",
  "benjamin franklin plumbing",
  "mr. appliance",
  "mr appliance",
  "sears home",
  "aire serv",
  "rainbow international",
  "glass doctor",
  "four seasons heating",
  "porch.com",
  "thumbtack",
  "taskrabbit",
];

function isChain(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_KEYWORDS.some((kw) => lower.includes(kw));
}

function getContractorType(sectionSlug: string, issueTitle: string): string {
  const t = issueTitle.toLowerCase();

  if (t.includes("electric") || t.includes("panel") || t.includes("outlet") || t.includes("wiring") || t.includes("breaker") || t.includes("gfci")) return "electrician";
  if (t.includes("roof") || t.includes("shingle") || t.includes("flashing") || t.includes("gutter")) return "roofer";
  if (t.includes("plumb") || t.includes("pipe") || t.includes("drain") || t.includes("water heater") || t.includes("toilet") || t.includes("faucet")) return "plumber";
  if (t.includes("hvac") || t.includes("furnace") || t.includes("boiler") || t.includes("heat pump") || t.includes("air condition") || t.includes("ductwork")) return "HVAC contractor";
  if (t.includes("foundation") || t.includes("structural") || t.includes("beam") || t.includes("joist") || t.includes("crawl space")) return "structural contractor";
  if (t.includes("insulation") || t.includes("attic") || t.includes("air seal")) return "insulation contractor";
  if (t.includes("window") || t.includes("door") || t.includes("frame")) return "window and door contractor";
  if (t.includes("siding") || t.includes("stucco") || t.includes("cladding")) return "siding contractor";
  if (t.includes("mold") || t.includes("asbestos") || t.includes("lead paint")) return "remediation contractor";
  if (t.includes("tile") || t.includes("grout") || t.includes("caulk")) return "tile contractor";
  if (t.includes("drywall") || t.includes("plaster") || t.includes("ceiling")) return "drywall contractor";

  const sectionMap: Record<string, string> = {
    plumbing:          "plumber",
    electrical:        "electrician",
    roofing:           "roofer",
    hvac:              "HVAC contractor",
    "attic-insulation":"insulation contractor",
    structure:         "structural contractor",
    exterior:          "general contractor",
    interior:          "general contractor",
    bathrooms:         "plumber",
    appliances:        "appliance repair technician",
  };

  return sectionMap[sectionSlug] ?? "general contractor";
}

interface PlacesPlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
}

interface PlacesResponse {
  places?: PlacesPlace[];
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  console.log("[find-contractors] API key present:", !!apiKey, "| length:", apiKey?.length ?? 0);
  if (!apiKey) {
    return NextResponse.json({ error: "Google Places API key not configured" }, { status: 500 });
  }

  try {
    const body = await request.json() as {
      issueTitle: string;
      issueSectionSlug: string;
      userLocation: string;
    };

    const { issueTitle, issueSectionSlug, userLocation } = body;
    console.log("[find-contractors] body:", { issueTitle, issueSectionSlug, userLocation });

    if (!issueTitle || !userLocation) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const contractorType = getContractorType(issueSectionSlug ?? "", issueTitle);
    const textQuery = `${contractorType} near ${userLocation}`;
    console.log("[find-contractors] textQuery:", textQuery);

    const placesRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.displayName",
          "places.formattedAddress",
          "places.nationalPhoneNumber",
          "places.rating",
          "places.userRatingCount",
          "places.googleMapsUri",
          "places.websiteUri",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: 10,
      }),
    });

    console.log("[find-contractors] Places API status:", placesRes.status);
    if (!placesRes.ok) {
      const err = await placesRes.text();
      console.error("[find-contractors] Places API error body:", err);
      return NextResponse.json({ error: "Places API request failed" }, { status: 502 });
    }

    const placesData = await placesRes.json() as PlacesResponse;
    console.log("[find-contractors] result count:", placesData.places?.length ?? 0);

    const places = placesData.places ?? [];

    const contractors: ContractorResult[] = places
      .filter((p) => {
        const name = p.displayName?.text ?? "";
        return name.length > 0 && !isChain(name);
      })
      .slice(0, 5)
      .map((p) => ({
        name: p.displayName?.text ?? "Unknown",
        address: p.formattedAddress ?? "",
        phone: p.nationalPhoneNumber,
        website: p.websiteUri,
        rating: p.rating,
        reviewCount: p.userRatingCount,
        mapsUrl: p.googleMapsUri ?? `https://maps.google.com/maps?q=${encodeURIComponent((p.displayName?.text ?? "") + " " + (p.formattedAddress ?? ""))}`,
      }));

    return NextResponse.json({ contractors, contractorType });
  } catch (error) {
    console.error("[find-contractors] Error:", error);
    return NextResponse.json({ error: "Failed to find contractors" }, { status: 500 });
  }
}
