"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

const PUBLIC_PATHS = ["/login", "/signup"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

    // getSession() reads/refreshes the session from storage and can reject
    // (or, on some mobile browsers with restricted storage access, hang) —
    // without a .catch() and a timeout, that leaves `ready` false forever:
    // a blank page with no console output at all.
    const timeout = setTimeout(() => {
      if (!cancelled) {
        console.error("[AuthGuard] supabase.auth.getSession() did not resolve within 8s.");
        setAuthError("Couldn't verify your session (timed out). This can happen if your browser is blocking storage access.");
      }
    }, 8000);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        clearTimeout(timeout);
        if (!session && !isPublic) {
          router.replace("/login");
        } else if (session && isPublic) {
          router.replace("/");
        } else {
          setReady(true);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeout);
        console.error("[AuthGuard] supabase.auth.getSession() rejected:", err);
        setAuthError(err instanceof Error ? err.message : "Couldn't verify your session.");
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
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

  if (authError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-porch-bg px-6 text-center">
        <p className="text-sm font-semibold text-porch-text">Couldn&apos;t sign you in</p>
        <p className="max-w-sm text-xs leading-relaxed text-porch-text-secondary">{authError}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-press rounded-[10px] border-none bg-porch-accent px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!ready) return null;
  return <>{children}</>;
}
