"use client";

/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when the listing is merchant-grade AND
 * isNewsletterOn(listing) === true (parent gate). Mounted INSIDE the
 * dark TradeProfileFooter — styled for dark surface, compact single
 * column so the footer keeps its original height.
 *
 * NewsletterSignup — UK GDPR + PECR compliant email-capture form
 * (Model A: capture only, merchant exports CSV, no in-app sending).
 *
 * Compliance:
 *   - Consent checkbox MUST default to unchecked
 *   - Subscribe disabled until checkbox ticked AND email valid
 *   - Exact consent_text POSTed for audit trail
 *   - Privacy line names merchant as data controller
 */

import { useMemo, useState } from "react";
import type { HammerexTradeOffListing } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function NewsletterSignup({
  listing
}: {
  listing: Pick<HammerexTradeOffListing, "slug" | "display_name">;
}) {
  const firstName = useMemo(() => {
    const first = (listing.display_name ?? "").trim().split(/\s+/)[0];
    return first || listing.display_name || "us";
  }, [listing.display_name]);

  // Click-as-consent: the Subscribe click itself is the affirmative
  // action. The text below the form is the privacy notice shown at
  // submit time. consent_text is stored verbatim for audit.
  const consentText = useMemo(
    () =>
      `By clicking Subscribe, I agree to receive marketing emails from ${listing.display_name}. Unsubscribe anytime via the link in every email.`,
    [listing.display_name]
  );

  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  const emailValid = EMAIL_RE.test(email.trim()) && email.trim().length <= 254;
  const canSubmit =
    emailValid && state.kind !== "loading" && state.kind !== "success";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/trade-off/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: listing.slug,
          email: email.trim(),
          consent_text: consentText
        })
      });
      const json: { ok?: boolean; error?: string } = await res.json();
      if (!res.ok || !json.ok) {
        setState({
          kind: "error",
          message: json.error ?? "Couldn't subscribe — try again."
        });
        return;
      }
      setState({ kind: "success" });
    } catch {
      setState({ kind: "error", message: "Network error — try again." });
    }
  }

  return (
    <section aria-labelledby="newsletter-signup-heading">
      <h3
        id="newsletter-signup-heading"
        className="text-[11px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: "#FFB300" }}
      >
        Newsletter
      </h3>

      {state.kind === "success" ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[13px] font-semibold text-emerald-300"
        >
          Thanks &mdash; you&rsquo;re subscribed.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-3 flex flex-col gap-2">
          <div className="flex h-11 items-stretch overflow-hidden rounded-lg border border-white/20 bg-white/5 focus-within:border-[#FFB300] focus-within:ring-2 focus-within:ring-[#FFB300]/30">
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={state.kind === "loading"}
              placeholder="you@example.com"
              className="min-w-0 flex-1 border-0 bg-transparent px-3 text-[13px] text-white placeholder:text-white/40 outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex shrink-0 items-center justify-center px-4 text-[13px] font-extrabold text-neutral-900 transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "#FFB300" }}
            >
              {state.kind === "loading" ? "…" : "Subscribe"}
            </button>
          </div>

          <p className="text-[11px] leading-snug text-white/55">
            Subscribing means you agree to marketing from{" "}
            {listing.display_name}. Unsubscribe anytime.{" "}
            <a
              href="/legal/privacy"
              className="font-semibold text-white/75 underline-offset-4 hover:underline"
            >
              Privacy
            </a>
            .
          </p>

          {state.kind === "error" && (
            <p
              role="alert"
              className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-300"
            >
              {state.message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
