"use client";

// Affiliate reset-password form. POSTs to /api/affiliates/set-password
// which verifies the recovery code (constant-time, single-use, 24h
// expiry, queue-snooping guard).
import { useState } from "react";

export function SetPasswordForm({
  initialWhatsapp,
  recoveryCode
}: {
  initialWhatsapp: string;
  recoveryCode: string;
}) {
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/affiliates/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          whatsapp,
          recovery_code: recoveryCode,
          password
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        affiliate_id?: number;
        error?: string;
      };
      if (!body.ok) {
        setErr(body.error || "Could not reset your password.");
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
      <input type="hidden" name="recovery_code" value={recoveryCode} />
      <label className="block">
        <span className="text-[13px] font-bold text-brand-text">New password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={6}
          className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="text-[13px] font-bold text-brand-text">
          Confirm password
        </span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
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
        {submitting ? "Saving…" : "Reset password"}
      </button>
    </form>
  );
}
