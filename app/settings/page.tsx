"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { ChevronLeftIcon, ChevronRightIcon } from "@/app/components/icons";
import HomeButton from "@/app/components/HomeButton";
import CalendarButton from "@/app/components/CalendarButton";
import Modal from "@/app/components/Modal";

const TILES = [
  { href: "/profile", label: "Profile", desc: "Name, photo, skill level, and location" },
  { href: "/property", label: "Property Details", desc: "Year built, systems, and specs" },
  { href: "/toolbox", label: "Toolbox", desc: "Tools you already own" },
  { href: "/report", label: "Home Reports", desc: "Inspection reports and other assessments" },
  { href: "/documents", label: "Document Vault", desc: "Manuals, warranties, invoices, and permits" },
] as const;

export default function SettingsPage() {
  const [showNotifyInfo, setShowNotifyInfo] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
  }

  return (
    <div className="mx-auto min-h-screen max-w-[430px] bg-porch-bg pb-10 text-porch-text">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-porch-border bg-porch-surface px-5 py-3.5">
        <Link href="/" className="flex items-center gap-1.5 text-[13.5px] text-porch-text-secondary no-underline">
          <ChevronLeftIcon size={15} />
          Dashboard
        </Link>
        <div className="flex items-center gap-1">
          <CalendarButton size={18} />
          <HomeButton size={18} />
        </div>
      </header>

      <div className="px-5 pb-1 pt-5">
        <span className="font-display text-[22px] font-semibold text-porch-text">Settings</span>
      </div>

      <div className="space-y-2.5 px-5 pt-[18px]">
        {TILES.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="btn-press flex items-center justify-between rounded-2xl border border-porch-border bg-porch-surface px-4 py-4 no-underline"
          >
            <div className="min-w-0">
              <div className="text-[14.5px] font-semibold text-porch-text">{tile.label}</div>
              <div className="mt-0.5 truncate text-[12.5px] text-porch-text-secondary">{tile.desc}</div>
            </div>
            <ChevronRightIcon />
          </Link>
        ))}

        <button
          onClick={() => setShowNotifyInfo(true)}
          className="btn-press flex w-full items-center justify-between rounded-2xl border border-porch-border bg-porch-surface px-4 py-4 text-left"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[14.5px] font-semibold text-porch-text">Notifications</span>
              <span className="rounded-full bg-porch-accent-tint px-2 py-0.5 text-[10.5px] font-semibold text-porch-accent">
                Soon
              </span>
            </div>
            <div className="mt-0.5 text-[12.5px] text-porch-text-secondary">Reminders for maintenance tasks</div>
          </div>
          <ChevronRightIcon />
        </button>
      </div>

      <div className="px-5 pt-8">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="btn-press w-full rounded-2xl border-[1.5px] border-red-200 bg-red-50 py-3.5 text-[14.5px] font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign Out"}
        </button>
      </div>

      {showNotifyInfo && (
        <Modal onClose={() => setShowNotifyInfo(false)}>
          <p className="mb-1 text-sm font-semibold text-porch-text">Notifications</p>
          <p className="text-sm leading-relaxed text-porch-text-secondary">
            You can already flag individual maintenance tasks to remind you when they&apos;re due — look for the
            toggle in the Maintenance Calendar. Reminders will be delivered once Porchlight is added to your home
            screen; broader notification preferences will land here after that.
          </p>
          <button
            onClick={() => setShowNotifyInfo(false)}
            className="btn-press mt-5 w-full rounded-[10px] border-none bg-porch-accent py-2.5 text-sm font-semibold text-white"
          >
            Got it
          </button>
        </Modal>
      )}
    </div>
  );
}
