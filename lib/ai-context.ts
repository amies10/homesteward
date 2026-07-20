import type { PropertyDetails } from "./sections";

// Renders known property fields as plain lines for interpolation into AI
// prompts — one fact per line, skipping anything not on file. Returns ""
// (not null) when nothing is known, since every caller interpolates this
// directly into a template literal.
export function propertyContextLines(p: PropertyDetails | null): string {
  if (!p) return "";
  const lines: string[] = [];

  if (p.yearBuilt) lines.push(`Year built: ${p.yearBuilt}`);
  if (p.squareFeet) lines.push(`Square feet: ${p.squareFeet}`);
  if (p.homeStyle) lines.push(`Home style: ${p.homeStyle}`);

  if (p.roofType || p.roofAgeYears) {
    const parts = [p.roofType, p.roofAgeYears ? `~${p.roofAgeYears} years old` : null].filter(Boolean);
    lines.push(`Roof: ${parts.join(", ")}`);
  }

  if (p.hvacType || p.hvacAgeYears) {
    const parts = [p.hvacType, p.hvacAgeYears ? `~${p.hvacAgeYears} years old` : null].filter(Boolean);
    lines.push(`HVAC: ${parts.join(", ")}`);
  }

  if (p.foundationType) lines.push(`Foundation: ${p.foundationType}`);

  if (p.bedrooms || p.bathrooms) {
    const parts = [p.bedrooms ? `${p.bedrooms} bed` : null, p.bathrooms ? `${p.bathrooms} bath` : null].filter(Boolean);
    lines.push(parts.join(" / "));
  }

  for (const spec of p.otherSpecs ?? []) {
    if (spec.label && spec.value) lines.push(`${spec.label}: ${spec.value}`);
  }

  return lines.join("\n");
}
