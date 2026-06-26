"use client";

// Celebratory upgrade-nudge modal — rendered at the top of the dashboard
// when a trial-tier tradie has accrued real WhatsApp leads. Inputs are
// computed server-side; this component is purely the modal shell.
//
// The dashboard decides whether to mount the modal at all (gating on tier
// === 'app_trial', whatsapp_click_count >= 3, and dismissed_at >= 7 days
// ago or null). When mounted, the modal opens on mount and stays modal
// until the tradie taps Upgrade or Remind-me-later.

import { useEffect, useState } from "react";
import Link from "next/link";

export function WhatsappLeadsNudge({
  slug,
  editToken,
  clickCount,
  upgradeHref
}: {
  slug: string;
  editToken: string;
  clickCount: number;
  upgradeHref: string;
}) {
  const [open, setOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") void dismiss();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function dismiss() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/trade-off/dismiss-upgrade-nudge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, edit_token: editToken })
      });
    } catch {
      // best-effort — the modal still closes either way
    }
    setOpen(false);
    setSubmitting(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="WhatsApp leads upgrade nudge"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur"
      onClick={() => void dismiss()}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border-2 border-brand-accent bg-brand-bg p-5 text-brand-text shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => void dismiss()}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-brand-text hover:bg-white/20"
        >
          ×
        </button>

        <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
          Conversion alert
        </p>
        <h2 className="mt-2 text-xl font-extrabold leading-tight sm:text-2xl">
          <span aria-hidden="true">🎉</span> Your profile got {clickCount} WhatsApp leads.
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-brand-text">
          Customers tapped your Contact button {clickCount} times. The premium
          features you&rsquo;re on right now — animated hero, custom CTA
          effects, verified work gallery, Hammerex Standard tier badge — are
          what made them tap.
        </p>
        <p className="mt-3 text-[13px] font-semibold leading-relaxed text-brand-text">
          Lock them in: upgrade to annual <span className="text-brand-accent">£80/yr</span> and{" "}
          <span className="text-brand-accent">keep 5% off Hammerex tools forever</span> as a thank-you.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={upgradeHref}
            className="grid h-12 place-items-center rounded-xl bg-brand-accent px-4 text-sm font-extrabold text-black transition hover:opacity-90"
          >
            Upgrade to annual — £80/yr
          </Link>
          <button
            type="button"
            onClick={() => void dismiss()}
            disabled={submitting}
            className="grid h-12 place-items-center rounded-xl border border-brand-line bg-brand-surface px-4 text-sm font-semibold text-brand-text transition hover:border-brand-accent disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Remind me later"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WhatsappLeadsNudge;
