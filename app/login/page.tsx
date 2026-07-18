"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import Logo from "@/app/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.replace("/");
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email address above, then click Forgot password.");
      return;
    }
    setResetLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-porch-bg px-5 py-16">
      <div className="mb-2.5 flex flex-col items-center">
        <Logo size={40} wordmarkSize={26} />
      </div>
      <p className="mb-9 max-w-[300px] text-center text-[15px] leading-relaxed text-porch-text-secondary">
        Welcome back. Let&apos;s see how your home&apos;s doing.
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[380px] rounded-[18px] border border-porch-border bg-porch-surface px-6 py-[26px] shadow-[0_2px_10px_rgba(38,34,32,0.04)]"
      >
        <label className="mb-1.5 block text-[13.5px] font-semibold text-porch-text">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mb-[18px] w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
        />

        <label className="mb-1.5 block text-[13.5px] font-semibold text-porch-text">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="mb-2 w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
        />
        <div className="mb-5 text-right">
          {resetSent ? (
            <span className="text-[13px] text-porch-text-secondary">Check your email for a reset link.</span>
          ) : (
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={resetLoading}
              className="text-[13px] text-porch-accent no-underline disabled:opacity-60"
            >
              {resetLoading ? "Sending…" : "Forgot password?"}
            </button>
          )}
        </div>

        {error && (
          <p className="mb-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-press block w-full rounded-[10px] border-none bg-porch-accent py-[13px] text-center text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-[14px] text-porch-text-secondary">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-porch-accent underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </div>
  );
}
