"use client";

// Client form for /trade-off/login.
//
// We POST to /api/trade-off/login with the WhatsApp number + password.
// The API normalises the number to digits-only server-side, so users
// can paste their number however they like — with or without dial code,
// spaces, dashes.

import { useState } from "react";

export function TradeLoginForm({ next }: { next?: string | null }) {
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotPending, setForgotPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/trade-off/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ whatsapp, password })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        slug?: string;
        requires_first_login?: boolean;
        error?: string;
      };
      if (body.requires_first_login && body.slug) {
        // Legacy user with no password set — bounce them to the
        // set-password flow with the number pre-filled.
        window.location.href = `/trade-off/set-password?wa=${encodeURIComponent(
          whatsapp
        )}`;
        return;
      }
      if (!body.ok || !body.slug) {
        setErr(body.error || "Invalid phone or password");
        return;
      }
      // Honour ?next=/trade-off/... if provided (e.g. the Sell hub nudge
      // bounces here so the merchant lands back where they were).
      // sanitizeNext on the server has already validated the prefix.
      // Default landing is /trade-off/yard — the merchant's home surface
      // that shows every workflow (Products / Canteen / Yard feed /
      // Trade Center) as entry cards. Answers "what would you like to
      // do today?" implicitly, without a chooser modal.
      window.location.href = next ?? "/trade-off/yard";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onForgot() {
    setErr(null);
    setForgotMessage(null);
    if (whatsapp.replace(/\D/g, "").length < 7) {
      setErr("Type your WhatsApp number first, then tap Forgot password.");
      return;
    }
    setForgotPending(true);
    try {
      const res = await fetch("/api/trade-off/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ whatsapp })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        whatsapp_url?: string;
        manual_admin_step?: string;
        error?: string;
      };
      if (!body.ok || !body.whatsapp_url) {
        setErr(body.error || "Could not start recovery — try again.");
        return;
      }
      setForgotMessage(
        body.manual_admin_step ||
          "We've routed your request to our admin team. They'll reply with a link."
      );
      window.open(body.whatsapp_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setForgotPending(false);
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
      {err && (
        <p className="text-[13px] font-semibold text-red-500">{err}</p>
      )}
      {forgotMessage && (
        <p className="rounded-lg border border-brand-line bg-brand-surface p-3 text-[13px] text-brand-text">
          {forgotMessage}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-accent px-4 text-[13px] font-bold text-black transition hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Logging in…" : "Log in"}
      </button>

      {/* [DEV BUTTON] — remove on "remove dev buttons".
          Explicit demo-merchant chips so the target is unambiguous.
          Each lands on /trade-off/yard — the merchant's home surface
          which shows Products / Canteen / Yard feed / Trade Center as
          entry cards (the implicit "what would you like to do today"
          answer). Auto-seeds the row if it doesn't exist. */}
      <div className="flex flex-col items-center gap-1.5 pt-1">
        <span className="text-[9.5px] font-black uppercase tracking-[0.18em] text-neutral-500">
          Dev · Pass sign-in
        </span>
        <div className="flex flex-wrap justify-center gap-1.5">
          <a
            href={`/api/dev/impersonate?slug=demo-mike-watson-drywall-manchester&next=${encodeURIComponent(next ?? "/trade-off/yard")}`}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            title="Dev-only bypass — sign in as Mike Watson"
          >
            Mike Watson
          </a>
          <a
            href={`/api/dev/impersonate?slug=demo-stuart-kingsley-building-merchant-hull&next=${encodeURIComponent(next ?? "/trade-off/yard")}`}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider shadow-sm"
            style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
            title="Dev-only bypass — sign in as Stuart Kingsley"
          >
            Stuart Kingsley
          </a>
          <a
            href={`/api/dev/impersonate?next=${encodeURIComponent(next ?? "/trade-off/yard")}`}
            className="inline-flex items-center gap-1 rounded-full border border-neutral-300 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
            title="Dev-only bypass — default demo merchant"
          >
            Default
          </a>
        </div>
      </div>
      {/* [/DEV BUTTON] */}
      <div className="flex flex-col gap-2 pt-2 text-[13px] sm:flex-row sm:justify-between">
        <a
          href={`/trade-off/set-password?wa=${encodeURIComponent(whatsapp)}`}
          className="font-semibold text-brand-accent hover:underline"
        >
          First time logging in? Set your password →
        </a>
        <button
          type="button"
          onClick={onForgot}
          disabled={forgotPending}
          className="text-left font-semibold text-brand-muted hover:text-brand-text hover:underline disabled:opacity-60 sm:text-right"
        >
          {forgotPending ? "Opening WhatsApp…" : "Forgot password"}
        </button>
      </div>
    </form>
  );
}
