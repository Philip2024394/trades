"use client";

// Client form for /trade-off/set-password. Posts to
// /api/trade-off/set-password which verifies the edit_token, ensures
// no password is already set, then stores the bcrypt hash + mints a
// session cookie.

import { useState } from "react";

export function SetPasswordForm({
  initialWhatsapp
}: {
  initialWhatsapp: string;
}) {
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp);
  const [editToken, setEditToken] = useState("");
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
      const res = await fetch("/api/trade-off/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          whatsapp,
          edit_token: editToken,
          password
        })
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        slug?: string;
        error?: string;
      };
      if (!body.ok || !body.slug) {
        setErr(body.error || "Could not set your password.");
        return;
      }
      window.location.href = `/trade-off/edit/${encodeURIComponent(body.slug)}`;
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
        <span className="text-[13px] font-bold text-brand-text">Edit token</span>
        <input
          type="text"
          value={editToken}
          onChange={(e) => setEditToken(e.target.value)}
          autoComplete="off"
          required
          className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 font-mono text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
        />
        <span className="mt-1 block text-[12px] leading-snug text-brand-muted">
          The token from your original signup email (the long string after
          <code>?token=</code> in the edit URL).
        </span>
      </label>
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
        {submitting ? "Saving…" : "Set password"}
      </button>
      <p className="pt-2 text-[12px] text-brand-muted">
        Lost your edit token?{" "}
        <a href="/trade-off/login" className="font-semibold text-brand-accent hover:underline">
          Use Forgot password
        </a>{" "}
        on the login screen — our admin team will reissue.
      </p>
    </form>
  );
}
