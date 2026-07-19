// /store/membership — subscription signup page.
//
// Two tiers side-by-side (monthly / annual). Email input +
// tier selector → POST /api/store/membership → Stripe subscription
// checkout → membership-success page issues member cookie.

"use client";

import Link from "next/link";
import { useState } from "react";

type Tier = "monthly" | "annual";

export default function MembershipSignupPage() {
  const [tier, setTier]     = useState<Tier>("annual"); // annual selected by default (best value)
  const [email, setEmail]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/store/membership", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ tier, email: email.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      window.location.href = data.redirect;
    } catch (err) {
      setError((err as Error).message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
        Membership
      </div>
      <h1 className="text-center text-[30px] font-black text-neutral-900 md:text-[38px]">
        Unlimited downloads. Every image.
      </h1>
      <p className="mx-auto mt-3 max-w-lg text-center text-[13px] text-neutral-600">
        Every image in Site Interest, in all 4 ready-to-use crops (Instagram 1:1 /
        Website 16:9 / Mobile 9:16 / Full original), included in your plan. All
        future additions too. Cancel any time.
      </p>

      {/* Tier picker */}
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        <TierCard
          tier="monthly"
          active={tier === "monthly"}
          onClick={() => setTier("monthly")}
          price="£29"
          per="per month"
          note="Flexible — cancel any time"
        />
        <TierCard
          tier="annual"
          active={tier === "annual"}
          onClick={() => setTier("annual")}
          price="£249"
          per="per year"
          note="Save £99 vs monthly · best value"
          savings="Save 30%"
        />
      </div>

      {/* Email form */}
      <form onSubmit={submit} className="mx-auto mt-8 max-w-md space-y-3">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Your email
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
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 w-full items-center justify-center rounded-md bg-neutral-900 text-[13px] font-black uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Preparing checkout…" : `Start ${tier === "annual" ? "annual" : "monthly"} — ${tier === "annual" ? "£249/yr" : "£29/mo"}`}
        </button>
        <p className="text-center text-[10px] text-neutral-500">
          Secure Stripe checkout. Cancel from the customer portal any time.
        </p>
      </form>

      {/* What's included */}
      <div className="mt-10 rounded-2xl border p-6" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
          What&apos;s included
        </div>
        <ul className="mt-3 grid gap-2 text-[13px] text-neutral-700 md:grid-cols-2">
          <li className="flex items-start gap-2"><span className="text-green-600">✓</span> Unlimited downloads — every image, every size</li>
          <li className="flex items-start gap-2"><span className="text-green-600">✓</span> All future images added to the library</li>
          <li className="flex items-start gap-2"><span className="text-green-600">✓</span> Full commercial licence, always</li>
          <li className="flex items-start gap-2"><span className="text-green-600">✓</span> All 4 crops (Instagram · Website · Mobile · Full) for every image</li>
          <li className="flex items-start gap-2"><span className="text-green-600">✓</span> No per-image checkout — one tap to download</li>
          <li className="flex items-start gap-2"><span className="text-green-600">✓</span> Cancel any time — no lock-in</li>
        </ul>
        <p className="mt-4 text-[11px] text-neutral-500">
          Same licence as one-off purchases —{" "}
          <Link href="/legal/image-licence" className="underline">read the terms</Link>.
          Resale to stock libraries / redistribution never permitted.
        </p>
      </div>

      <div className="mt-6 text-center">
        <Link href="/store" className="text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900">
          ← Back to Site Interest
        </Link>
      </div>
    </div>
  );
}

function TierCard({
  tier, active, onClick, price, per, note, savings
}: {
  tier: Tier;
  active: boolean;
  onClick: () => void;
  price: string;
  per: string;
  note: string;
  savings?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative rounded-2xl border p-5 text-left transition"
      style={{
        borderColor: active ? "#0A0A0A" : "rgba(0,0,0,0.10)",
        boxShadow:   active ? "0 0 0 2px rgba(0,0,0,0.08)" : undefined
      }}
      aria-pressed={active}
    >
      {savings && (
        <span className="absolute right-4 top-4 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}>
          {savings}
        </span>
      )}
      <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
        {tier === "annual" ? "Annual" : "Monthly"}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <div className="text-[36px] font-black leading-none text-neutral-900">{price}</div>
        <div className="text-[11px] font-bold text-neutral-500">{per}</div>
      </div>
      <div className="mt-2 text-[11px] text-neutral-600">{note}</div>
      <div className="mt-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-wider">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px]"
          style={{
            borderColor:     active ? "#0A0A0A" : "rgba(0,0,0,0.20)",
            backgroundColor: active ? "#0A0A0A" : "#FFFFFF",
            color:           "#FFFFFF"
          }}
        >
          {active && "✓"}
        </span>
        {active ? "Selected" : "Choose"}
      </div>
    </button>
  );
}
