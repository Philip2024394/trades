"use client";

// Client shell for /trade-off/yard/canteens/[slug]/post — the
// full-screen hero + bottom composer overlay.

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { X, Send } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";
import { CANTEEN_CONTENT_SAVED_EVENT } from "@/components/xrated/yard/CanteenMobileAppShowcase";

const MAX_BODY = 4000;

export function CanteenComposeOverlay({
  canteenSlug,
  canteenName,
  tradeLabel,
  hostDisplayName,
  headerBgUrl,
  replyToId
}: {
  canteenSlug: string;
  canteenName: string;
  tradeLabel: string;
  hostDisplayName: string;
  headerBgUrl: string | null;
  replyToId: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backHref = `/trade-off/yard/canteens/${canteenSlug}`;

  async function submit() {
    if (submitting) return;
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Type something before posting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/canteens/${encodeURIComponent(canteenSlug)}/posts/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "chat",
          body: trimmed,
          photoUrls: [] as string[],
          replyToId
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        if (data.error === "not-authenticated") setError("Log in to post.");
        else if (data.error === "not-a-member") setError("Join the canteen to post.");
        else setError(data.error ?? "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }
      // Success — canteen page will re-fetch the feed via router.refresh()
      // on landing so the rotator picks up the new post. Also fires the
      // save event so any open CanteenMobileAppShowcase in edit mode
      // remounts its iframe and shows the new post in the phone preview.
      window.dispatchEvent(new CustomEvent(CANTEEN_CONTENT_SAVED_EVENT));
      router.push(backHref);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="fixed inset-0 z-[70] overflow-hidden" style={{ backgroundColor: BRAND_BLACK }}>
      {/* Full-screen hero image */}
      {headerBgUrl ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${headerBgUrl}')`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          }}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 20% 30%, ${BRAND_YELLOW}22 0%, transparent 55%), radial-gradient(circle at 80% 70%, ${BRAND_YELLOW}18 0%, transparent 55%)`
          }}
        />
      )}
      {/* Darker gradient so text over the image is legible */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.30) 40%, rgba(0,0,0,0.85) 100%)"
        }}
      />

      {/* Top strip — close + canteen context */}
      <header className="relative flex items-center justify-between px-4 pt-4">
        <Link
          href={backHref}
          aria-label="Close and return to canteen"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white shadow-md backdrop-blur transition active:scale-[0.95]"
        >
          <X size={16} strokeWidth={2.5}/>
        </Link>
        <div className="text-right">
          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/60">
            {tradeLabel}
          </div>
          <div className="text-[13px] font-black text-white drop-shadow-md">
            {canteenName}
          </div>
        </div>
      </header>

      {/* Middle prompt — invites the user */}
      <section className="relative flex flex-col items-center px-4 pt-8 text-center">
        {replyToId ? (
          <>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
              Replying in {canteenName}
            </div>
            <h1 className="mt-2 text-[24px] font-black leading-tight text-white drop-shadow-md">
              Say your piece
            </h1>
          </>
        ) : (
          <>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/60">
              Posting to {canteenName}
            </div>
            <h1 className="mt-2 text-[24px] font-black leading-tight text-white drop-shadow-md">
              What are you on?
            </h1>
            <p className="mt-1 text-[12px] leading-snug text-white/80">
              Ask {hostDisplayName.split(/\s+/)[0]} or any of the crew — everyone posting here works this trade.
            </p>
          </>
        )}
      </section>

      {/* Bottom composer card — 20% of the viewport height */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col justify-end"
        style={{ height: "20vh", minHeight: "180px" }}
      >
        <div className="mx-3 mb-3 rounded-2xl bg-white p-3 shadow-2xl">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
            placeholder={replyToId ? "Your reply…" : "Type your post…"}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-lg border p-3 text-[13px] leading-relaxed text-neutral-800 focus:outline-none focus:ring-2"
            style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FAFAFA" }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-[10.5px] text-neutral-500">
              {body.length}/{MAX_BODY}
            </div>
            <div className="flex items-center gap-2">
              {error && (
                <span className="text-[10.5px] font-black uppercase tracking-wider text-red-600">
                  {error}
                </span>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={submitting || body.trim().length === 0}
                className="inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[12px] font-black uppercase tracking-wider text-white shadow-sm transition active:scale-[0.97] disabled:opacity-60"
                style={{ backgroundColor: BRAND_GREEN_DARK }}
              >
                <Send size={12} strokeWidth={2.5}/>
                {submitting ? "Posting…" : replyToId ? "Reply" : "Post"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
