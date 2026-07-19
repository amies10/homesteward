"use client";

import { useEffect, useState } from "react";
import AppHeader from "@/app/components/AppHeader";
import { PlusIcon, SearchIcon, TrashIcon, XIcon } from "@/app/components/icons";
import { loadToolbox, addTools, removeTool, type ToolboxItem } from "@/lib/toolbox";

export default function ToolboxPage() {
  const [tools, setTools] = useState<ToolboxItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newTool, setNewTool] = useState("");
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadToolbox().then((data) => {
      setTools(data);
      setLoaded(true);
    });
  }, []);

  async function handleAdd() {
    const name = newTool.trim();
    if (!name) return;
    setAdding(true);
    await addTools([name], "manual");
    setTools(await loadToolbox());
    setNewTool("");
    setAdding(false);
  }

  async function handleRemove(id: string) {
    setTools((prev) => prev.filter((t) => t.id !== id));
    await removeTool(id);
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

      {loaded && (
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
              className="flex-1 rounded-[10px] border border-porch-border-input bg-porch-surface px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
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
        </>
      )}
    </div>
  );
}
