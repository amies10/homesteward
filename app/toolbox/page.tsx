"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import { PageSkeleton } from "@/app/components/Skeleton";
import { PlusIcon, SearchIcon, TrashIcon, XIcon } from "@/app/components/icons";
import { loadToolbox, addTools, removeTool, type ToolboxItem } from "@/lib/toolbox";
import { loadReports, loadAllIssueDetailsForUser } from "@/lib/data";
import { mergeReports } from "@/lib/sections";
import { findReadyFixes, type OpenIssueRef } from "@/lib/toolbox-match";

export default function ToolboxPage() {
  const [tools, setTools] = useState<ToolboxItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newTool, setNewTool] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [readyFixes, setReadyFixes] = useState<Array<{ ref: OpenIssueRef; missingCount: number }>>([]);

  async function loadReadyFixes(currentTools: ToolboxItem[]) {
    const [reports, detailsRows] = await Promise.all([loadReports(), loadAllIssueDetailsForUser()]);
    const openRefs: OpenIssueRef[] = mergeReports(reports).flatMap((section) =>
      section.issues.filter((ref) => !ref.issue.deleted).map((ref) => ({ ...ref, slug: section.slug }))
    );
    setReadyFixes(findReadyFixes(currentTools.map((t) => t.toolName), detailsRows, openRefs));
  }

  useEffect(() => {
    loadToolbox().then((data) => {
      setTools(data);
      setLoaded(true);
      loadReadyFixes(data);
    });
  }, []);

  async function handleAdd() {
    const name = newTool.trim();
    if (!name) return;
    setAdding(true);
    await addTools([name], "manual");
    const updated = await loadToolbox();
    setTools(updated);
    setNewTool("");
    setAdding(false);
    loadReadyFixes(updated);
  }

  async function handleRemove(id: string) {
    const updated = tools.filter((t) => t.id !== id);
    setTools(updated);
    await removeTool(id);
    loadReadyFixes(updated);
  }

  const query = search.trim().toLowerCase();
  const visibleTools = query ? tools.filter((t) => t.toolName.toLowerCase().includes(query)) : tools;

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <AppHeader backHref="/profile" backLabel="Profile" />

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Your Toolbox</span>
        <p className="mt-1 text-[13.5px] text-porch-text-secondary">
          Tools you own — DIY plans won&apos;t tell you to buy what you already have.
        </p>
      </div>

      {!loaded ? (
        <PageSkeleton />
      ) : (
        <>
          {tools.length > 0 && (
            <div className="mx-5 mt-4">
              <div className="flex items-center gap-2 rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-2.5">
                <SearchIcon size={15} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search tools..."
                  className="flex-1 border-none bg-transparent text-sm text-porch-text outline-none placeholder:text-porch-text-tertiary"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="flex items-center p-0.5 text-porch-text-tertiary"
                  >
                    <XIcon size={14} color="#A99C8B" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="mx-5 mt-2.5 space-y-2">
            {tools.length === 0 ? (
              <div className="rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
                <p className="text-sm text-porch-text-secondary">No tools yet. Add one below.</p>
              </div>
            ) : visibleTools.length === 0 ? (
              <div className="rounded-2xl border border-porch-border bg-porch-surface px-6 py-10 text-center">
                <p className="text-sm text-porch-text-secondary">No tools match &quot;{search.trim()}&quot;.</p>
              </div>
            ) : (
              visibleTools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center justify-between rounded-2xl border border-porch-border bg-porch-surface px-4 py-3.5"
                >
                  <span className="text-[14.5px] text-porch-text">{tool.toolName}</span>
                  <button onClick={() => handleRemove(tool.id)} aria-label="Remove" className="p-1">
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mx-5 mt-4 flex gap-2">
            <input
              type="text"
              value={newTool}
              onChange={(e) => setNewTool(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Add a tool (e.g. Cordless drill)"
              className="flex-1 rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-porch-accent focus-visible:ring-offset-1"
            />
            <button
              onClick={handleAdd}
              disabled={!newTool.trim() || adding}
              aria-label="Add tool"
              className="btn-press flex shrink-0 items-center justify-center rounded-[10px] border-none bg-porch-accent px-4 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PlusIcon color="#FFFFFF" />
            </button>
          </div>

          {readyFixes.length > 0 && (
            <div className="mx-5 mt-5 rounded-2xl border border-porch-success-border bg-porch-success-bg p-[18px]">
              <p className="text-[13.5px] font-semibold text-porch-success">
                You already own everything needed for {readyFixes.length} fix{readyFixes.length !== 1 ? "es" : ""}
              </p>
              <div className="mt-2.5 space-y-1.5">
                {readyFixes.map(({ ref }) => (
                  <Link
                    key={`${ref.reportId}-${ref.slug}-${ref.issueIndex}`}
                    href={`/section/${ref.slug}/issue/${ref.issueIndex}?r=${ref.reportId}`}
                    className="block text-[13.5px] font-medium text-porch-success underline underline-offset-2"
                  >
                    {ref.issue.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
