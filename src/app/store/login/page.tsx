// /store/login — magic-link sign-in for members who cleared cookies
// or are on a new device. Email in → link sent (or shown inline in
// dev). No password.

"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function StoreLoginPage() {
  const params = useSearchParams();
  const err    = params?.get("error") ?? "";

  const [email, setEmail]   = useState("");
  const [busy,  setBusy]    = useState(false);
  const [sent,  setSent]    = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(errorLabel(err));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email"); return; }
    setBusy(true);
    setError(null);
    setSent(null);
    setDevLink(null);
    try {
      const res = await fetch("/api/store/login/request", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setSent(data.message ?? "If that email has an active membership, we've sent a sign-in link.");
      if (data.dev_link) setDevLink(data.dev_link);
    } catch (err) {
      setError((err as Error).message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        Sign in
      </div>
      <h1 className="text-center text-[28px] font-black text-neutral-900">
        Members sign in
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-center text-[12px] text-neutral-600">
        Enter your email. If you have an active membership we&apos;ll send you a
        sign-in link. No password.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.uk"
            required
            className="mt-1 block w-full rounded-md border px-3 py-3 text-[14px] text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            style={{ borderColor: "rgba(0,0,0,0.12)" }}
          />
        </label>
        {error && (
          <div className="rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700">
            {error}
          </div>
        )}
        {sent && (
          <div className="rounded-md bg-green-50 px-2 py-2 text-[11px] font-bold text-green-800">
            {sent}
          </div>
        )}
        {devLink && (
          <div className="rounded-md bg-yellow-50 p-2 text-[10px] leading-snug text-neutral-700">
            <div className="mb-1 font-black uppercase tracking-wider text-neutral-600">
              Dev-only sign-in link:
            </div>
            <a href={devLink} className="break-all font-mono text-[10px] text-neutral-700 underline">
              {devLink}
            </a>
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-neutral-900 text-[13px] font-black uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send sign-in link"}
        </button>
      </form>

      <div className="mt-8 text-center text-[11px] text-neutral-500">
        Not a member yet?{" "}
        <Link href="/store/membership" className="font-black text-neutral-900 underline">
          Start a membership
        </Link>
      </div>
    </div>
  );
}

function errorLabel(code: string): string | null {
  switch (code) {
    case "missing-token":       return "Sign-in link is missing its token.";
    case "invalid-or-expired":  return "Sign-in link is invalid or expired. Request a new one.";
    case "inactive":            return "That membership isn't active. Renew or start a new plan.";
    default:                    return null;
  }
}
