"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import Logo from "@/app/components/Logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery link's token is exchanged for a session client-side
    // (detectSessionInUrl: true) — that can take a beat after this page
    // mounts, so watch auth state rather than checking getSession() once.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => router.replace("/login"), 2000);
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-porch-bg px-5 py-16">
      <div className="mb-2.5 flex flex-col items-center">
        <Logo size={40} wordmarkSize={26} />
      </div>
      <p className="mb-9 max-w-[300px] text-center text-[15px] leading-relaxed text-porch-text-secondary">
        Set a new password for your account.
      </p>

      <div className="w-full max-w-[380px] rounded-[18px] border border-porch-border bg-porch-surface px-6 py-[26px] shadow-[0_2px_10px_rgba(38,34,32,0.04)]">
        {done ? (
          <p className="text-center text-[14px] leading-relaxed text-porch-text-secondary">
            Password updated. Redirecting you to sign in…
          </p>
        ) : hasSession === false ? (
          <div className="text-center">
            <p className="mb-4 text-[14px] leading-relaxed text-porch-text-secondary">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Link href="/login" className="text-[13.5px] font-semibold text-porch-accent underline underline-offset-2">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className="mb-1.5 block text-[13.5px] font-semibold text-porch-text">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your new password"
              className="mb-[18px] w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
            />

            <label className="mb-1.5 block text-[13.5px] font-semibold text-porch-text">Confirm password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="mb-5 w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
            />

            {error && (
              <p className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || hasSession === null}
              className="btn-press block w-full rounded-[10px] border-none bg-porch-accent py-[13px] text-center text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Saving…" : "Set new password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
