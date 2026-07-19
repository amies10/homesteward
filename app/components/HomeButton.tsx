import Link from "next/link";
import { HomeIcon } from "@/app/components/icons";

export default function HomeButton({ size = 20 }: { size?: number }) {
  return (
    <Link href="/" aria-label="Home" className="flex items-center justify-center p-1.5">
      <HomeIcon size={size} />
    </Link>
  );
}
