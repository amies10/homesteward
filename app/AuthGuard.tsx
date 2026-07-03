"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

const PUBLIC_PATHS = ["/login", "/signup"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !isPublic) {
        router.replace("/login");
      } else if (session && isPublic) {
        router.replace("/");
      } else {
        setReady(true);
      }
    });
  }, [pathname, router]);

  // Handle sign-out events (e.g. from another tab)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setReady(false);
        router.replace("/login");
      }
    });
    return () => subscription.unsubscribe();
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
