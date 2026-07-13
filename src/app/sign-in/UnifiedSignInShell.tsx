"use client";

// Unified sign-in shell — one page, two tabs.
//   - "Trades merchant" tab: WhatsApp number + password (reuses the
//     existing TradeLoginForm which already handles the login POST +
//     the [DEV BUTTON] chips + forgot-password link).
//   - "Homeowner" tab: email → magic link sent via /api/home/sign-in
//     (same endpoint the old /home/sign-in page used).
//
// Chooser sits at the top; the state defaults to Merchant (the primary
// audience of Thenetworkers) but the URL `?role=customer` seeds the
// homeowner tab so an "I'm signing in as a homeowner" nudge from the
// marketing site opens the right tab automatically.

import { useState } from "react";
import Link from "next/link";
import { TradeLoginForm } from "@/app/trade-off/login/TradeLoginForm";

const BRAND_YELLOW = "#FFB300";

type Role = "merchant" | "customer";

export function UnifiedSignInShell({
  next,
  initialRole,
  initialFlow
}: {
  next: string | null;
  initialRole: Role | null;
  initialFlow: "recovery" | null;
}) {
  const [role, setRole] = useState<Role>(initialRole ?? "merchant");

  return (
    <div>
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-neutral-900/10 bg-white px-3 py-1 shadow-sm">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#166534" }}/>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-700">Sign in</span>
      </div>
      <h1 className="text-[32px] font-black leading-tight text-neutral-900 sm:text-[38px]">
        Welcome back.
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-neutral-600 sm:text-[14px]">
        {role === "merchant"
          ? "Sign in with the WhatsApp number you signed up with and your password."
          : "Enter your email — we&apos;ll send you a one-time sign-in link."}
      </p>

      {/* Role tabs */}
      <div
        role="tablist"
        aria-label="Choose account type"
        className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-neutral-900/10 bg-white p-1 shadow-sm"
      >
        <button
          role="tab"
          type="button"
          aria-selected={role === "merchant"}
          onClick={() => setRole("merchant")}
          className={`inline-flex h-10 items-center justify-center rounded-full text-[12.5px] font-black uppercase tracking-wider transition ${
            role === "merchant"
              ? "text-neutral-900 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
          style={role === "merchant" ? { backgroundColor: BRAND_YELLOW } : undefined}
        >
          Trades merchant
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={role === "customer"}
          onClick={() => setRole("customer")}
          className={`inline-flex h-10 items-center justify-center rounded-full text-[12.5px] font-black uppercase tracking-wider transition ${
            role === "customer"
              ? "text-neutral-900 shadow-sm"
              : "text-neutral-500 hover:text-neutral-800"
          }`}
          style={role === "customer" ? { backgroundColor: BRAND_YELLOW } : undefined}
        >
          Homeowner
        </button>
      </div>

      <div className="mt-6">
        {role === "merchant" ? (
          <TradeLoginForm next={next} />
        ) : (
          <CustomerEmailForm next={next} />
        )}
      </div>

      {/* Cross-sell to Create account */}
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-4 text-center text-[12.5px] text-neutral-700">
        No account yet?{" "}
        <Link href="/join" className="font-black text-neutral-900 underline underline-offset-2">
          Create one here →
        </Link>
      </div>

      {/* [DEV BUTTON] — remove on "remove dev buttons".
          Small dev-only admin bypass so Dev · Pass access stays one
          tap away from the canonical /sign-in page. Wrapped in
          NODE_ENV check both here and at the endpoint level. */}
      {process.env.NODE_ENV !== "production" && (
        <div className="mt-4 flex flex-col items-center gap-1.5">
          <span className="text-[9.5px] font-black uppercase tracking-[0.18em] text-neutral-400">
            Dev · Admin bypass
          </span>
          <a
            href="/api/admin/dev-signin?next=/admin/payments"
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
            title="Dev-only bypass — signs in as admin with no password"
          >
            Admin dashboard →
          </a>
        </div>
      )}
      {/* [/DEV BUTTON] */}

      {initialFlow === "recovery" && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-center text-[12px] font-bold text-amber-900">
          Reset arriving on WhatsApp — check your messages, then sign in with your new password.
        </p>
      )}
    </div>
  );
}

function CustomerEmailForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      // Reuse the existing home sign-in endpoint. It emails a magic
      // link that lands the customer back on this URL (with a token
      // that server-side auth consumes on redirect).
      const res = await fetch("/api/home/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, next })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? "Couldn't send the link — try again.");
        return;
      }
      setSent(true);
    } catch {
      setErr("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-[13px] text-emerald-900">
        <div className="font-black">Check your inbox.</div>
        <p className="mt-1 leading-relaxed">
          We sent a one-time sign-in link to <b>{email}</b>. It expires in 30 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-[13px] font-bold text-neutral-800">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 block h-12 w-full rounded-xl border border-neutral-300 bg-white px-3 text-[14px] text-neutral-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-300/40"
        />
      </label>
      {err && <p className="text-[13px] font-semibold text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl px-4 text-[13.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        style={{ backgroundColor: BRAND_YELLOW }}
      >
        {submitting ? "Sending…" : "Send me a link"}
      </button>
      <p className="text-[12px] leading-snug text-neutral-500">
        No password, no callback fee. Every link expires in 30 minutes.
      </p>
    </form>
  );
}
