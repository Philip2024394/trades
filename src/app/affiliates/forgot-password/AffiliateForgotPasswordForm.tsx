"use client";

// Affiliate forgot-password form. Posts to /api/affiliates/forgot-password
// and renders a generic success state regardless of which delivery
// channel the backend picked.
import { useState } from "react";

export function AffiliateForgotPasswordForm() {
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [delivery, setDelivery] = useState<string>("");
  const [waUrl, setWaUrl] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliates/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ whatsapp })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivery?: string;
        whatsapp_url?: string;
        error?: string;
      };
      if (!body.ok) {
        setErr(body.error || "Could not start recovery.");
        return;
      }
      setDone(true);
      setDelivery(body.delivery ?? "");
      setWaUrl(body.whatsapp_url ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4 text-[13px] text-brand-text">
          <p className="font-bold text-brand-accent">Reset on the way.</p>
          <p className="mt-1">{delivery}</p>
        </div>
        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-brand-line bg-brand-surface px-4 text-[13px] font-bold text-brand-text hover:bg-brand-line"
          >
            Also message admin on WhatsApp
          </a>
        )}
      </div>
    );
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
      {err && <p className="text-[13px] font-semibold text-red-500">{err}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-brand-accent px-4 text-[13px] font-bold text-black transition hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
