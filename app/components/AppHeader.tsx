import Link from "next/link";
import { ChevronLeftIcon } from "@/app/components/icons";
import HomeButton from "@/app/components/HomeButton";
import CalendarButton from "@/app/components/CalendarButton";

interface Props {
  backHref: string;
  backLabel: string;
  right?: React.ReactNode;
  showHome?: boolean;
}

export default function AppHeader({ backHref, backLabel, right, showHome = true }: Props) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-porch-border bg-porch-surface px-5 py-[18px]">
      <Link href={backHref} className="flex min-w-0 items-center gap-1.5 text-sm text-porch-text-secondary no-underline">
        <ChevronLeftIcon />
        <span className="truncate">{backLabel}</span>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        {right}
        {showHome && (
          <>
            <CalendarButton />
            <HomeButton />
          </>
        )}
      </div>
    </header>
  );
}
