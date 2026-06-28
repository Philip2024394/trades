"use client";

// Client form for /trade-off/login.
//
// We POST to /api/trade-off/login with the WhatsApp number + password.
// The API normalises the number to digits-only server-side, so users
// can paste their number however they like — with or without dial code,
// spaces, dashes.

import { useState } from "react";

export function TradeLoginForm() {
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
      window.location.href = `/trade-off/edit/${encodeURIComponent(body.slug)}`;
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
