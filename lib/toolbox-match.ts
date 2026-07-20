import { isToolHeuristic } from "./toolbox";
import type { IssueDetails, MergedIssueRef } from "./sections";

export type DetailsRow = {
  reportId: string;
  slug: string;
  issueIndex: number;
  materialsList: IssueDetails["materialsList"];
};

// MergedIssueRef (lib/sections.ts) doesn't carry a section slug — slug lives
// one level up, on MergedSection. Matching against detailsRows' (reportId,
// slug, issueIndex) and building a /section/{slug}/issue/{issueIndex} link
// both need it, so callers flatten mergeReports() output into this shape
// (ref fields plus the section slug it came from) rather than bare
// MergedIssueRef.
export type OpenIssueRef = MergedIssueRef & { slug: string };

// Case-insensitive, substring-both-directions match — "Cordless drill" in the
// toolbox covers a materials-list item of "drill" and vice versa.
export function isOwned(itemName: string, toolbox: string[]): boolean {
  const item = itemName.toLowerCase();
  return toolbox.some((tool) => {
    const owned = tool.toLowerCase();
    return owned.includes(item) || item.includes(owned);
  });
}

// F1: issues whose materials list is entirely tool items the user already
// owns — nothing left to buy before starting. Only considers issues that are
// both open (present in openIssueRefs) and have at least one tool-type
// material item (otherwise there's nothing to be "ready" for).
export function findReadyFixes(
  toolbox: string[],
  detailsRows: DetailsRow[],
  openIssueRefs: OpenIssueRef[]
): Array<{ ref: OpenIssueRef; missingCount: number }> {
  const results: Array<{ ref: OpenIssueRef; missingCount: number }> = [];

  for (const row of detailsRows) {
    const materials = row.materialsList ?? [];
    const toolItems = materials.filter((m) => m.isTool ?? isToolHeuristic(m.item));
    if (toolItems.length === 0) continue;

    const missingCount = toolItems.filter((m) => !isOwned(m.item, toolbox)).length;
    if (missingCount > 0) continue;

    const ref = openIssueRefs.find(
      (r) => r.reportId === row.reportId && r.slug === row.slug && r.issueIndex === row.issueIndex
    );
    if (!ref) continue;

    results.push({ ref, missingCount });
  }

  return results;
}
