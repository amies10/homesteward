"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  sections,
  normalize,
  SKILL_RANK,
  type ParsedReport,
  type Issue,
  type CompletionRecord,
  type UserProfile,
} from "@/lib/sections";
import {
  loadLatestReport,
  loadCompletions,
  loadIgnored,
  loadUserProfile,
  saveIgnore,
  removeIgnore,
} from "@/lib/data";

const SEVERITY: Record<
  Issue["severity"],
  { card: string; badge: string; label: string }
> = {
  safety: {
    card: "border-red-200 bg-red-50",
    badge: "bg-red-100 text-red-700",
    label: "Safety",
  },
  repair: {
    card: "border-orange-200 bg-orange-50",
    badge: "bg-orange-100 text-orange-700",
    label: "Repair",
  },
  maintenance: {
    card: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
    label: "Maintenance",
  },
  improvement: {
    card: "border-blue-200 bg-blue-50",
    badge: "bg-blue-100 text-blue-700",
    label: "Improvement",
  },
  fyi: {
    card: "border-stone-200 bg-stone-50",
    badge: "bg-stone-100 text-stone-500",
    label: "FYI",
  },
};

const SEVERITY_ORDER: Record<string, number> = {
  safety: 0,
  repair: 1,
  maintenance: 2,
  improvement: 3,
  fyi: 4,
};

function group(done: boolean, ignored: boolean): number {
  if (done) return 2;
  if (ignored) return 1;
  return 0;
}

export default function SectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const section = sections.find((s) => s.slug === slug);
  const [report, setReport] = useState<ParsedReport | null>(null);
  const [completions, setCompletions] = useState<Record<string, CompletionRecord>>({});
  const [ignored, setIgnored] = useState<Record<string, true>>({});
  const [userSkillLevel, setUserSkillLevel] = useState<UserProfile["skillLevel"] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([loadLatestReport(), loadCompletions(), loadIgnored(), loadUserProfile()]).then(
      ([report, completions, ignored, profile]) => {
        if (report) setReport(report);
        setCompletions(completions);
        setIgnored(ignored);
        if (profile) setUserSkillLevel(profile.skillLevel);
        setLoaded(true);
      }
    );
  }, []);

  if (!section) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-sm text-stone-500">Section not found.</p>
      </div>
    );
  }

  const reportSection = report?.sections.find(
    (s) => normalize(s.name) === normalize(section.label)
  );
  const issues = reportSection?.issues ?? [];

  const sortedIssues = [...issues]
    .map((issue, i) => ({
      issue,
      i,
      done: !!completions[`${slug}-${i}`],
      ignored: !!ignored[`${slug}-${i}`],
    }))
    .sort((a, b) => {
      const ga = group(a.done, a.ignored);
      const gb = group(b.done, b.ignored);
      if (ga !== gb) return ga - gb;
      if (ga === 0) {
        return (SEVERITY_ORDER[a.issue.severity] ?? 99) - (SEVERITY_ORDER[b.issue.severity] ?? 99);
      }
      return 0;
    });

  const activeCount = sortedIssues.filter((x) => !x.done && !x.ignored).length;
  const ignoredCount = sortedIssues.filter((x) => x.ignored).length;
  const doneCount = sortedIssues.filter((x) => x.done).length;

  async function handleIgnore(i: number) {
    setIgnored((prev) => ({ ...prev, [`${slug}-${i}`]: true }));
    await saveIgnore(slug, i);
  }

  async function handleUnignore(i: number) {
    setIgnored((prev) => {
      const next = { ...prev };
      delete next[`${slug}-${i}`];
      return next;
    });
    await removeIgnore(slug, i);
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-stone-400 transition-colors hover:text-stone-600"
            >
              ← Dashboard
            </Link>
            <div className="h-4 w-px bg-stone-200" />
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                {section.label}
              </h1>
              <span className="text-sm text-stone-400">
                {section.description}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {!loaded ? null : !report ? (
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-stone-500">
              No inspection report uploaded yet.{" "}
              <Link
                href="/"
                className="text-stone-700 underline underline-offset-2"
              >
                Go to the dashboard
              </Link>{" "}
              to upload one.
            </p>
          </div>
        ) : issues.length === 0 ? (
          <div className="rounded-lg border border-stone-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-stone-500">
              No issues found for this section.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="mb-6 text-sm text-stone-500">
              {activeCount} active issue{activeCount !== 1 ? "s" : ""}
              {ignoredCount > 0 && (
                <span className="ml-2 text-stone-400">· {ignoredCount} ignored</span>
              )}
              {doneCount > 0 && (
                <span className="ml-2 text-stone-400">· {doneCount} complete</span>
              )}
            </p>
            {sortedIssues.map(({ issue, i, done, ignored: isIgnored }) => {
              const style = SEVERITY[issue.severity] ?? SEVERITY.fyi;
              const dimmed = done || isIgnored;
              const skillTag =
                !done && !isIgnored && userSkillLevel && issue.minimumSkillLevel
                  ? SKILL_RANK[userSkillLevel] >= SKILL_RANK[issue.minimumSkillLevel]
                    ? ({ label: "DIY-friendly", cls: "bg-green-50 text-green-700" } as const)
                    : ({ label: "Pro recommended", cls: "bg-amber-50 text-amber-700" } as const)
                  : null;
              return (
                <div
                  key={i}
                  className={`rounded-lg border px-5 py-4 ${
                    dimmed
                      ? "border-stone-200 bg-white opacity-50"
                      : style.card
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Clickable area */}
                    <Link
                      href={`/section/${slug}/issue/${i}`}
                      className="min-w-0 flex-1 hover:opacity-75"
                    >
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <span
                          className={`text-sm font-medium ${
                            dimmed ? "text-stone-400 line-through" : "text-stone-900"
                          }`}
                        >
                          {issue.title}
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          {skillTag && (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${skillTag.cls}`}>
                              {skillTag.label}
                            </span>
                          )}
                          {done ? (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-400">
                              ✓ Complete
                            </span>
                          ) : isIgnored ? (
                            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-400">
                              Ignored
                            </span>
                          ) : (
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                              {style.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className={`text-xs leading-relaxed ${dimmed ? "text-stone-400" : "text-stone-600"}`}>
                        {issue.description}
                      </p>
                    </Link>

                    {/* Ignore / Undo */}
                    {!done && (
                      <div className="shrink-0 pt-0.5">
                        {isIgnored ? (
                          <button
                            onClick={() => handleUnignore(i)}
                            className="rounded px-2 py-1 text-xs text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            onClick={() => handleIgnore(i)}
                            className="rounded px-2 py-1 text-xs text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
                          >
                            Ignore
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
