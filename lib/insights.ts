import type { PropertyDetails, Issue } from "./sections";

export interface AgingInsight {
  label: string;
  ageYears: number;
  lifespan: [number, number];
  message: string;
}

function isApproaching(ageYears: number, lifespan: [number, number]): boolean {
  return ageYears >= lifespan[0] - 2;
}

function makeMessage(label: string, ageYears: number, lifespan: [number, number]): string {
  const age = Math.round(ageYears);
  return `Your ${label} is ~${age} years old — typical lifespan ${lifespan[0]}–${lifespan[1]} years. Worth budgeting for replacement.`;
}

// Tries to pull an age (in years) for a piece of equipment out of free text —
// either an explicit "installed in 2015"-style year, or an "8 years" phrase.
function extractAgeYears(text: string): number | null {
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[0], 10);
    const age = new Date().getFullYear() - year;
    if (age >= 0 && age < 100) return age;
  }
  const ageMatch = text.match(/(\d+(?:\.\d+)?)\s*years?/i);
  if (ageMatch) return parseFloat(ageMatch[1]);
  return null;
}

export function computeAgingInsights(property: PropertyDetails | null, allIssues: Issue[]): AgingInsight[] {
  const insights: AgingInsight[] = [];
  if (!property) return insights;

  if (property.roofAgeYears != null) {
    const lifespan: [number, number] = /asphalt|shingle/i.test(property.roofType ?? "") ? [18, 25] : [20, 30];
    if (isApproaching(property.roofAgeYears, lifespan)) {
      insights.push({
        label: "roof",
        ageYears: property.roofAgeYears,
        lifespan,
        message: makeMessage("roof", property.roofAgeYears, lifespan),
      });
    }
  }

  if (property.hvacAgeYears != null) {
    const lifespan: [number, number] = [12, 18];
    if (isApproaching(property.hvacAgeYears, lifespan)) {
      insights.push({
        label: "HVAC system",
        ageYears: property.hvacAgeYears,
        lifespan,
        message: makeMessage("HVAC system", property.hvacAgeYears, lifespan),
      });
    }
  }

  const waterHeaterCandidates = [
    ...(property.otherSpecs ?? []).filter((s) => /water heater/i.test(s.label) || /water heater/i.test(s.value)).map((s) => `${s.label} ${s.value}`),
    ...allIssues.flatMap((i) => i.equipmentSpecs ?? []).filter((s) => /water heater/i.test(s)),
  ];
  for (const text of waterHeaterCandidates) {
    const age = extractAgeYears(text);
    if (age == null) continue;
    const lifespan: [number, number] = [8, 12];
    if (isApproaching(age, lifespan)) {
      insights.push({
        label: "water heater",
        ageYears: age,
        lifespan,
        message: makeMessage("water heater", age, lifespan),
      });
    }
    break; // one water-heater insight is enough even if multiple mentions match
  }

  return insights;
}
