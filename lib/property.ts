import { supabase } from "./supabase-client";
import type { PropertyDetails } from "./sections";

async function getCurrentUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

function fromRow(row: Record<string, unknown>): PropertyDetails {
  return {
    yearBuilt: (row.year_built as number | null) ?? null,
    squareFeet: (row.square_feet as number | null) ?? null,
    homeStyle: (row.home_style as string | null) ?? null,
    roofType: (row.roof_type as string | null) ?? null,
    roofAgeYears: (row.roof_age_years as number | null) ?? null,
    hvacType: (row.hvac_type as string | null) ?? null,
    hvacAgeYears: (row.hvac_age_years as number | null) ?? null,
    foundationType: (row.foundation_type as string | null) ?? null,
    bedrooms: (row.bedrooms as number | null) ?? null,
    bathrooms: (row.bathrooms as number | null) ?? null,
    otherSpecs: (row.other_specs as PropertyDetails["otherSpecs"] | null) ?? [],
  };
}

export async function loadPropertyDetails(): Promise<PropertyDetails | null> {
  try {
    const { data, error } = await supabase
      .from("property_details")
      .select(
        "year_built, square_feet, home_style, roof_type, roof_age_years, hvac_type, hvac_age_years, foundation_type, bedrooms, bathrooms, other_specs"
      )
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return fromRow(data);
  } catch (err) {
    console.warn("[property] loadPropertyDetails failed", err);
    return null;
  }
}

export async function savePropertyDetails(partial: Partial<PropertyDetails>): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const payload: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if ("yearBuilt" in partial) payload.year_built = partial.yearBuilt;
  if ("squareFeet" in partial) payload.square_feet = partial.squareFeet;
  if ("homeStyle" in partial) payload.home_style = partial.homeStyle;
  if ("roofType" in partial) payload.roof_type = partial.roofType;
  if ("roofAgeYears" in partial) payload.roof_age_years = partial.roofAgeYears;
  if ("hvacType" in partial) payload.hvac_type = partial.hvacType;
  if ("hvacAgeYears" in partial) payload.hvac_age_years = partial.hvacAgeYears;
  if ("foundationType" in partial) payload.foundation_type = partial.foundationType;
  if ("bedrooms" in partial) payload.bedrooms = partial.bedrooms;
  if ("bathrooms" in partial) payload.bathrooms = partial.bathrooms;
  if ("otherSpecs" in partial) payload.other_specs = partial.otherSpecs;

  try {
    const { error } = await supabase.from("property_details").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
  } catch (err) {
    console.warn("[property] savePropertyDetails failed", err);
  }
}

// Called right after parse-report returns propertyDetails. Only fills fields
// that are currently null/empty so a re-parse never clobbers a manual edit.
export async function mergeParsedPropertyDetails(
  parsed: PropertyDetails | null | undefined,
  reportId?: string
): Promise<void> {
  if (!parsed) return;
  const userId = await getCurrentUserId();
  if (!userId) return;

  const existing = await loadPropertyDetails();
  const merged: Partial<PropertyDetails> = {};

  const scalarFields: (keyof PropertyDetails)[] = [
    "yearBuilt",
    "squareFeet",
    "homeStyle",
    "roofType",
    "roofAgeYears",
    "hvacType",
    "hvacAgeYears",
    "foundationType",
    "bedrooms",
    "bathrooms",
  ];
  for (const field of scalarFields) {
    const currentValue = existing?.[field];
    if ((currentValue === null || currentValue === undefined) && parsed[field] != null) {
      (merged as Record<string, unknown>)[field] = parsed[field];
    }
  }
  if ((!existing?.otherSpecs || existing.otherSpecs.length === 0) && parsed.otherSpecs?.length) {
    merged.otherSpecs = parsed.otherSpecs;
  }

  if (Object.keys(merged).length === 0) return;

  const payload: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (reportId) payload.report_id = reportId;
  if ("yearBuilt" in merged) payload.year_built = merged.yearBuilt;
  if ("squareFeet" in merged) payload.square_feet = merged.squareFeet;
  if ("homeStyle" in merged) payload.home_style = merged.homeStyle;
  if ("roofType" in merged) payload.roof_type = merged.roofType;
  if ("roofAgeYears" in merged) payload.roof_age_years = merged.roofAgeYears;
  if ("hvacType" in merged) payload.hvac_type = merged.hvacType;
  if ("hvacAgeYears" in merged) payload.hvac_age_years = merged.hvacAgeYears;
  if ("foundationType" in merged) payload.foundation_type = merged.foundationType;
  if ("bedrooms" in merged) payload.bedrooms = merged.bedrooms;
  if ("bathrooms" in merged) payload.bathrooms = merged.bathrooms;
  if ("otherSpecs" in merged) payload.other_specs = merged.otherSpecs;

  try {
    const { error } = await supabase.from("property_details").upsert(payload, { onConflict: "user_id" });
    if (error) throw error;
  } catch (err) {
    console.warn("[property] mergeParsedPropertyDetails failed", err);
  }
}
