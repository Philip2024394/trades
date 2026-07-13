"use client";

import { useState } from "react";

export function AffiliateLoginForm() {
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliates/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ whatsapp, password })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        affiliate_id?: number;
        error?: string;
      };
      if (!body.ok) {
        setErr(body.error || "Invalid phone or password");
        return;
      }
      window.location.href = "/affiliates/dashboard";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-[13px] font-bold text-brand-text">
          WhatsApp number
        </span>
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="e.g. +44 7700 900000"
          autoComplete="tel"
          required
          className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="text-[13px] font-bold text-brand-text">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          minLength={6}
          className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
        />
      </label>
      {err && <p className="text-[13px] font-semibold text-red-500">{err}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-accent px-4 text-[13px] font-bold text-black transition hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Logging in…" : "Log in"}
      </button>

      {/* [DEV BUTTON] — remove on "remove dev buttons".
          Dev-only bypass: signs in as the first affiliate in the DB. */}
      <div className="flex justify-center pt-1">
        <a
          href="/api/affiliates/dev-signin"
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[9.5px] font-black uppercase tracking-wider shadow-sm"
          style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
          title="Dev-only bypass — signs in as the first affiliate with no password"
        >
          Dev · Pass
        </a>
      </div>
      {/* [/DEV BUTTON] */}
    </form>
  );
}
