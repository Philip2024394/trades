"use client";

// Client form for right-to-removal. Submits to
// /api/trade-off/projects/request-removal. On success swaps to a thank-you
// screen; the API has already soft-hidden the project before we render
// the success state.

import { useState } from "react";

export function RemovalRequestForm({
  slug,
  projectId,
  projectTitle
}: {
  slug: string;
  projectId: string;
  projectTitle: string;
}) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    reason.trim().length >= 20 &&
    !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setErr(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/trade-off/projects/request-removal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          project_id: projectId,
          requester_email: email,
          reason
        })
      });
      const j = await res.json();
      if (!j.ok) {
        setErr(j.error ?? "Could not submit — try again.");
        return;
      }
      setSubmitted(true);
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border-2 p-6" style={{ borderColor: "#FFB300", background: "rgba(255,179,0,0.06)" }}>
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Request received
        </p>
        <h2 className="mt-2 text-xl font-extrabold text-neutral-900 sm:text-2xl">
          Thank you.
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
          The project has been hidden while we review your request.
          We&rsquo;ll respond to <strong>{email}</strong> within 24 hours.
          Reference: removal of &ldquo;{projectTitle}&rdquo;.
        </p>
        <a
          href={`/${slug}`}
          className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300]"
        >
          Back to profile
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
      <label className="block">
        <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
          Your email *
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="block h-12 w-full rounded-md border border-neutral-300 bg-white px-3 text-[13px] text-neutral-900 outline-none focus:border-[#FFB300] sm:text-sm"
          placeholder="you@example.com"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
          Why should this be removed? *
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={5}
          required
          minLength={20}
          maxLength={2000}
          className="block w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-[#FFB300] sm:text-sm"
          placeholder="Tell us briefly — what's in the post that shouldn't be public?"
        />
        <p className="mt-1 text-[10px] uppercase tracking-widest text-neutral-400">
          {reason.length}/2000 &middot; min 20 chars
        </p>
      </label>

      {err && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
          {err}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
        style={{ background: "#FFB300" }}
      >
        {submitting ? "Submitting…" : "Hide this project & request removal"}
      </button>
      <p className="text-[10px] text-neutral-500">
        Submitting hides the project immediately. The tradesperson and our
        admin team are notified.
      </p>
    </form>
  );
}
