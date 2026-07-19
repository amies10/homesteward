import Link from "next/link";
import { CalendarIcon } from "@/app/components/icons";

export default function CalendarButton({ size = 20 }: { size?: number }) {
  return (
    <Link href="/maintenance" aria-label="Maintenance Calendar" className="flex items-center justify-center p-1.5">
      <CalendarIcon size={size} color="#6B5F55" strokeWidth={1.6} />
    </Link>
  );
}
