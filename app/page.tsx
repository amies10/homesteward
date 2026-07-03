"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sections, normalize, type ParsedReport, type Issue } from "@/lib/sections";
import {
  saveReport,
  loadLatestReport,
  loadCompletions,
  loadIgnored,
  loadUserProfile,
  clearLocalReport,
} from "@/lib/data";
import { supabase } from "@/lib/supabase-client";

const SEVERITY_ORDER: Record<Issue["severity"], number> = {
  safety: 0, repair: 1, maintenance: 2, improvement: 3, fyi: 4,
};

const SEVERITY_STYLE: Record<Issue["severity"], { badge: string; label: string }> = {
  safety: { badge: "bg-red-100 text-red-700", label: "Safety" },
  repair: { badge: "bg-orange-100 text-orange-700", label: "Repair" },
  maintenance: { badge: "bg-amber-100 text-amber-700", label: "Maintenance" },
  improvement: { badge: "bg-blue-100 text-blue-700", label: "Improvement" },
  fyi: { badge: "bg-stone-100 text-stone-500", label: "FYI" },
};

export default function Dashboard() {
  const router = useRouter();
  const [profileChecked, setProfileChecked] = useState(false);
  const [report, setReport] = useState<ParsedReport | null>(null);
  const [completions, setCompletions] = useState<Record<string, unknown>>({});
  const [ignored, setIgnored] = useState<Record<string, true>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUserProfile().then((profile) => {
      if (!profile?.onboardingCompleted) {
        router.replace("/onboarding");
        return;
      }
      setProfileChecked(true);
      Promise.all([loadLatestReport(), loadCompletions(), loadIgnored()]).then(
        ([report, completions, ignored]) => {
          if (report) setReport(report);
          setCompletions(completions);
          setIgnored(ignored);
        }
      );
    });
  }, [router]);

  function issueCountFor(label: string, slug: string): number {
    if (!report) return 0;
    const target = normalize(label);
    const section = report.sections.find((s) => normalize(s.name) === target);
    if (!section) return 0;
    return section.issues.filter(
      (_, i) => !completions[`${slug}-${i}`] && !ignored[`${slug}-${i}`]
    ).length;
  }

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setReport(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/parse-report", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setReport(data);
      await saveReport(data, file.name);
      setShowSummaryModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const totalIssues = report?.sections.reduce(
    (sum, s) => sum + s.issues.length,
    0
  );

  if (!profileChecked) return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                HomeSteward
              </h1>
              <span className="text-sm text-stone-400">property overview</span>
            </div>
            <div className="flex items-center gap-5">
              <Link
                href="/completed"
                className="text-sm text-stone-500 transition-colors hover:text-stone-800"
              >
                Completed Fixes
              </Link>
              <Link
                href="/settings"
                className="text-sm text-stone-500 transition-colors hover:text-stone-800"
              >
                Settings
              </Link>
              <button
                onClick={() => supabase.auth.signOut()}
                className="text-sm text-stone-400 transition-colors hover:text-stone-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        {/* Upload area */}
        <div className="rounded-lg border border-stone-200 bg-white px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-stone-900">
                Inspection Report
              </p>
              <p className="mt-0.5 text-xs text-stone-400">
                Upload a PDF inspection report to extract and categorize issues
                by section.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {loading && (
                <span className="text-xs text-stone-500">Parsing report…</span>
              )}
              {error && (
                <span className="max-w-xs text-xs text-red-600">{error}</span>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
              {report && !loading && (
                <>
                  <button
                    onClick={() => setShowSummaryModal(true)}
                    className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
                  >
                    View Summary
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-400 transition-colors hover:bg-stone-50 hover:text-stone-600"
                  >
                    Clear
                  </button>
                </>
              )}
              <button
                onClick={() => inputRef.current?.click()}
                disabled={loading}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Parsing…" : "Upload PDF"}
              </button>
            </div>
          </div>

          {report && (
            <div className="mt-4 border-t border-stone-100 pt-3">
              <p className="text-xs text-stone-500">
                Found{" "}
                <span className="font-medium text-stone-700">
                  {totalIssues} issue{totalIssues !== 1 ? "s" : ""}
                </span>{" "}
                across{" "}
                <span className="font-medium text-stone-700">
                  {report.sections.length} section
                  {report.sections.length !== 1 ? "s" : ""}
                </span>
                .
              </p>
            </div>
          )}
        </div>

        {/* Section cards */}
        <div>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
              Home Sections
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Select a section to view maintenance history, upcoming tasks, and
              notes.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => {
              const count = issueCountFor(section.label, section.slug);
              return (
                <Link
                  key={section.slug}
                  href={`/section/${section.slug}`}
                  className="group flex flex-col gap-1 rounded-lg border border-stone-200 bg-white px-5 py-4 transition-colors hover:border-stone-300 hover:bg-stone-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-stone-900 group-hover:text-stone-700">
                      {section.label}
                    </span>
                    {count > 0 && (
                      <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
                        {count} issue{count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-xs leading-relaxed text-stone-400">
                    {section.description}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      {showSummaryModal && report && (() => {
        const allIssues = report.sections.flatMap((s) => s.issues);
        const severityCounts = { safety: 0, repair: 0, maintenance: 0, improvement: 0, fyi: 0 } as Record<Issue["severity"], number>;
        for (const issue of allIssues) severityCounts[issue.severity]++;
        const top3 = [...allIssues]
          .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
          .slice(0, 3);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-lg border border-stone-200 bg-white shadow-lg">
              <div className="border-b border-stone-100 px-6 py-5">
                <p className="text-base font-semibold text-stone-900">Report Parsed Successfully</p>
                {report.propertyAddress && (
                  <p className="mt-1 text-sm text-stone-500">{report.propertyAddress}</p>
                )}
              </div>

              <div className="border-b border-stone-100 px-6 py-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-stone-400">Summary</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md bg-stone-50 px-4 py-3">
                    <p className="text-2xl font-semibold tracking-tight text-stone-900">{allIssues.length}</p>
                    <p className="mt-0.5 text-xs text-stone-500">Total issues</p>
                  </div>
                  <div className="rounded-md bg-stone-50 px-4 py-3">
                    <p className="text-2xl font-semibold tracking-tight text-stone-900">{report.sections.length}</p>
                    <p className="mt-0.5 text-xs text-stone-500">Sections affected</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["safety", "repair", "maintenance", "improvement", "fyi"] as const).map((sev) => {
                    const count = severityCounts[sev];
                    if (!count) return null;
                    const style = SEVERITY_STYLE[sev];
                    return (
                      <span key={sev} className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.badge}`}>
                        {count} {style.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {top3.length > 0 && (
                <div className="border-b border-stone-100 px-6 py-5">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-stone-400">Top Priority Issues</p>
                  <ul className="space-y-2.5">
                    {top3.map((issue, i) => {
                      const style = SEVERITY_STYLE[issue.severity];
                      return (
                        <li key={i} className="flex items-start justify-between gap-3">
                          <span className="text-sm leading-snug text-stone-700">{issue.title}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                            {style.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="px-6 py-5">
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="w-full rounded-md border border-stone-800 bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                >
                  View My Home
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white px-6 py-5 shadow-lg">
            <p className="mb-1 text-sm font-semibold text-stone-900">Clear report?</p>
            <p className="mb-5 text-sm leading-relaxed text-stone-500">
              This will remove your uploaded report and all section data. Completed fixes will not be affected.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearLocalReport();
                  setReport(null);
                  setError(null);
                  setShowClearConfirm(false);
                }}
                className="rounded-md border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Yes, Clear Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
