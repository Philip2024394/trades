"use client";

import { useState } from "react";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

export function ForemanWaitlistForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const f = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/foreman/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: String(f.get("email") ?? "").trim().toLowerCase(),
          company_name: String(f.get("company") ?? "").trim() || null,
          team_size: String(f.get("team_size") ?? ""),
          primary_use_case: String(f.get("use_case") ?? ""),
          note: String(f.get("note") ?? "").trim() || null
        })
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(
          data.error === "invalid_email"
            ? "Enter a valid email."
            : "Could not add you to the waitlist."
        );
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — try again.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div
        className="rounded-2xl p-5 text-[14px] leading-[1.55]"
        style={{
          backgroundColor: "rgba(15,122,61,0.15)",
          color: "#B7F0CA",
          border: "1px solid rgba(15,122,61,0.35)"
        }}
      >
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            You&apos;re on the list. When Foreman Mode opens, you&apos;ll be
            among the first invited in. No spam in the meantime.
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <input
        name="email"
        type="email"
        required
        placeholder="you@company.co.uk"
        className="min-h-[48px] w-full rounded-xl border-0 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
      />
      <input
        name="company"
        type="text"
        placeholder="Company name (optional)"
        className="min-h-[48px] w-full rounded-xl border-0 bg-white/10 px-4 text-[15px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          name="team_size"
          required
          defaultValue=""
          className="min-h-[48px] w-full appearance-none rounded-xl border-0 bg-white/10 px-4 text-[15px] text-white focus:outline-none focus:ring-2 focus:ring-amber-400/60"
        >
          <option value="" disabled className="text-black">
            Team size…
          </option>
          <option value="1-5" className="text-black">
            1–5 people
          </option>
          <option value="6-20" className="text-black">
            6–20 people
          </option>
          <option value="21-50" className="text-black">
            21–50 people
          </option>
          <option value="50+" className="text-black">
            50+ people
          </option>
        </select>
        <select
          name="use_case"
          required
          defaultValue=""
          className="min-h-[48px] w-full appearance-none rounded-xl border-0 bg-white/10 px-4 text-[15px] text-white focus:outline-none focus:ring-2 focus:ring-amber-400/60"
        >
          <option value="" disabled className="text-black">
            Mostly work on…
          </option>
          <option value="domestic" className="text-black">
            Domestic renovation
          </option>
          <option value="new_build" className="text-black">
            New builds
          </option>
          <option value="commercial" className="text-black">
            Commercial
          </option>
          <option value="mixed" className="text-black">
            Mixed
          </option>
        </select>
      </div>
      <textarea
        name="note"
        rows={2}
        placeholder="Anything specific you want us to solve? (optional)"
        maxLength={600}
        className="w-full rounded-xl border-0 bg-white/10 px-4 py-3 text-[14px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
      />
      <button
        type="submit"
        disabled={submitting}
        className="mt-1 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-amber-400 px-6 text-[15px] font-bold text-neutral-900 hover:bg-amber-300 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Adding…
          </>
        ) : (
          <>
            Join Foreman waitlist
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>
      {error ? (
        <p className="text-[13px] text-red-300">{error}</p>
      ) : null}
    </form>
  );
}
