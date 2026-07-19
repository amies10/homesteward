import { SKILL_RANK, type SkillLevel, type CompletionRecord, type Issue } from "./sections";

const RANK_TO_LEVEL: SkillLevel[] = ["beginner", "some_experience", "experienced", "expert"];

export interface EffectiveSkillResult {
  effective: SkillLevel;
  earned: boolean;
}

// Promotes a homeowner's effective skill level based on repairs they've
// completed themselves, capped at one level above their stated skill so two
// data points can't jump someone from beginner to expert. Never demotes.
export function computeEffectiveSkill(
  base: SkillLevel,
  myCompletions: CompletionRecord[],
  lookupIssue: (slug: string, index: number) => Issue | undefined
): EffectiveSkillResult {
  const baseRank = SKILL_RANK[base];
  const maxRank = Math.min(baseRank + 1, RANK_TO_LEVEL.length - 1);

  let derivedRank = baseRank;

  for (let candidateRank = baseRank + 1; candidateRank <= maxRank; candidateRank++) {
    let qualifyingCount = 0;

    for (const completion of myCompletions) {
      const difficulty = completion.difficulty ?? 2;
      if (difficulty > 4) continue;

      const issue = lookupIssue(completion.slug, completion.issueIndex);
      if (issue?.minimumSkillLevel) {
        if (SKILL_RANK[issue.minimumSkillLevel] >= candidateRank) qualifyingCount++;
      } else {
        // Issue not resolvable (e.g. completion from an older, cleared report) —
        // fall back to difficulty alone.
        if (difficulty >= 3) qualifyingCount++;
      }
    }

    if (qualifyingCount >= 2) derivedRank = candidateRank;
  }

  const effectiveRank = Math.min(Math.max(baseRank, derivedRank), maxRank);
  return {
    effective: RANK_TO_LEVEL[effectiveRank],
    earned: effectiveRank > baseRank,
  };
}
