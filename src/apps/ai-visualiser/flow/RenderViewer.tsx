// RenderViewer — the "wow" screen after a render completes.
//
// Shows a before/after slider (reuses the existing platform component)
// with the original photo on one side and the AI render on the other,
// a summary of the design choices, and two calls to action:
//
//   • "Try another look" — returns to the design tree with the current
//     source photo retained (cheap, no new upload).
//   • "Send to merchant" — flags the lead as hot and confirms the
//     merchant will be in touch. The merchant is already notified by
//     email on first render; this button gives the homeowner a sense
//     of intent + agency.

"use client";

import { useState } from "react";
import { Loader2, Send, Wand2 } from "lucide-react";
import { SurfaceCard } from "@/platform/ui";
import { BeforeAfterSlider } from "@/apps/before-after/BeforeAfterSlider";
import type { BeforeAfterPair } from "@/lib/before-after/types";

export type RenderViewerProps = {
  renderId: string;
  homeownerId: string;
  sourcePhotoUrl: string;
  renderUrl: string;
  designSummary: string;
  merchantDisplayName?: string;
  onTryAnother: () => void;
  onSendToMerchant?: () => void;
  className?: string;
};

export function RenderViewer({
  renderId,
  sourcePhotoUrl,
  renderUrl,
  designSummary,
  merchantDisplayName = "us",
  onTryAnother,
  onSendToMerchant,
  className = ""
}: RenderViewerProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/apps/ai-visualiser/leads/promote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ renderId })
      });
      const data: { ok: boolean; error?: string } = await res.json();
      if (!data.ok) {
        setError(data.error || "Could not notify the merchant. Try again.");
        return;
      }
      setSent(true);
      onSendToMerchant?.();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const pair: BeforeAfterPair = {
    id: renderId,
    mode: "dual",
    before_url: sourcePhotoUrl,
    after_url: renderUrl,
    orientation: "horizontal",
    before_label: "Your space",
    after_label: "New design"
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`.trim()}>
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Your render
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-neutral-900 md:text-3xl">
          Drag to compare.
        </h2>
        <p className="mt-1 text-[13px] text-neutral-600">{designSummary}</p>
      </header>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950">
        <BeforeAfterSlider pair={pair} />
      </div>

      <SurfaceCard variant="secondary" padding="md">
        <div className="text-[13px] text-neutral-700">
          Watermarked preview. HD download unlocks when {merchantDisplayName}{" "}
          quotes for your project.
        </div>
      </SurfaceCard>

      {error ? (
        <p className="text-[13px] text-red-600">{error}</p>
      ) : null}

      {sent ? (
        <SurfaceCard variant="success" padding="md">
          <div className="text-[13px] font-semibold">
            Sent — {merchantDisplayName} will be in touch soon.
          </div>
          <div className="text-[13px]">
            They'll message you on WhatsApp with a quote and next steps.
          </div>
        </SurfaceCard>
      ) : null}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <button
          type="button"
          onClick={onTryAnother}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-5 text-[14px] font-semibold text-neutral-900 transition hover:border-neutral-400"
        >
          <Wand2 className="h-4 w-4" aria-hidden />
          Try another look
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || sent}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-neutral-900 px-5 text-[14px] font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-60"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Sending…
            </>
          ) : sent ? (
            "Sent"
          ) : (
            <>
              <Send className="h-4 w-4" aria-hidden />
              Send to {merchantDisplayName}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
