"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import Logo from "@/app/components/Logo";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.replace("/");
    } else {
      setCheckEmail(true);
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-porch-bg px-5">
        <Logo size={40} wordmarkSize={26} className="mb-6" />
        <div className="w-full max-w-[380px] rounded-[18px] border border-porch-border bg-porch-surface px-6 py-[26px] text-center shadow-[0_2px_10px_rgba(38,34,32,0.04)]">
          <h1 className="font-display text-xl font-semibold text-porch-text">Check your email</h1>
          <p className="mt-3 text-[14px] leading-relaxed text-porch-text-secondary">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-porch-text">{email}</span>. Click it to activate your
            account, then log in.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-[14px] font-semibold text-porch-accent underline underline-offset-2"
          >
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-porch-bg px-5 py-16">
      <div className="mb-2.5 flex flex-col items-center">
        <Logo size={40} wordmarkSize={26} />
      </div>
      <p className="mb-9 max-w-[300px] text-center text-[15px] leading-relaxed text-porch-text-secondary">
        Create your account and let&apos;s get your home taken care of.
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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="mb-[18px] w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
        />

        <label className="mb-1.5 block text-[13.5px] font-semibold text-porch-text">Confirm password</label>
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          className="mb-5 w-full rounded-[10px] border border-porch-border-input bg-porch-bg px-3.5 py-3 text-[14.5px] text-porch-text placeholder:text-porch-text-tertiary focus:outline-none"
        />

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
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-[14px] text-porch-text-secondary">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-porch-accent underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}
