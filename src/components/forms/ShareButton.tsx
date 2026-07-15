"use client";

// Share button for a Site Interest image.
//
// Uses the native Web Share API on capable devices (mobile Safari,
// Chrome Android, macOS Safari) which spawns the OS share sheet —
// exactly what Philip asked for ("WhatsApp / social media / copy
// link" options in a native popup).
//
// Falls back to a small in-page popover on desktop / older browsers,
// with the same set of destinations (WhatsApp / X / Facebook / Copy
// link). Every share link points at the search URL so the arriving
// visitor lands on the Site Interest surface that showcases the
// image, not a bare image file — protects the platform brand.

import { useCallback, useEffect, useRef, useState } from "react";
import { Share2, Check, Copy, ExternalLink } from "lucide-react";

const BRAND_BLACK = "#0A0A0A";

type Props = {
  /** Absolute URL to share. Rendered as the OS share sheet URL and
   *  the base for every fallback deep-link. Should point at the
   *  page that showcases the image, not the image file itself. */
  shareUrl: string;
  /** Short line pre-filled into WhatsApp / X ("Loft ladder install
   *  ideas on Thenetworkers"). Kept concise so it doesn't collide
   *  with each channel's character limit. */
  shareText: string;
  /** Visual style. `overlay` (default) is the on-image floating
   *  pill with white bg + shadow so it stays legible over any
   *  photo. `ghost` is the utility-row variant used when the
   *  button sits BELOW the image, alongside other neutral icon
   *  buttons — no shadow, transparent bg, matches its neighbours. */
  variant?: "overlay" | "ghost";
};

type ShareTarget = {
  label: string;
  href:  string;
};

function buildShareTargets(url: string, text: string): ShareTarget[] {
  const enc = encodeURIComponent;
  const combined = `${text} ${url}`;
  return [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(combined)}` },
    { label: "X (Twitter)", href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` }
  ];
}

export function ShareButton({ shareUrl, shareText, variant = "overlay" }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  const targets = buildShareTargets(shareUrl, shareText);

  const handleClick = useCallback(async () => {
    // Prefer the native share sheet where available — it hits every
    // installed app (WhatsApp / iMessage / Signal / Instagram / etc)
    // and is what users expect on mobile.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = typeof navigator !== "undefined" ? (navigator as any) : null;
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ url: shareUrl, text: shareText, title: shareText });
        return;
      } catch {
        // User dismissed the sheet or share failed — fall through to
        // the desktop popover so they still have a path.
      }
    }
    setOpen((v) => !v);
  }, [shareUrl, shareText]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked (rare — Safari private mode). Nothing to
      // fall back to that isn't user-hostile; keep the popover open.
    }
  }, [shareUrl]);

  // Close on outside click when the popover is open.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative inline-block" ref={popRef}>
      <button
        type="button"
        onClick={handleClick}
        className={
          variant === "ghost"
            ? "inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            : "inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-md backdrop-blur transition hover:bg-white"
        }
        aria-label="Share image"
        title="Share"
      >
        <Share2 size={13} strokeWidth={2.4}/>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border bg-white shadow-lg"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
          role="menu"
        >
          {targets.map((t) => (
            <a
              key={t.label}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-2 px-3 py-2 text-[12px] font-black text-neutral-800 hover:bg-neutral-50"
              onClick={() => setOpen(false)}
            >
              {t.label}
              <ExternalLink size={11} strokeWidth={2.4} className="text-neutral-400"/>
            </a>
          ))}
          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center justify-between gap-2 border-t px-3 py-2 text-left text-[12px] font-black hover:bg-neutral-50"
            style={{ borderColor: "rgba(139,69,19,0.10)", color: copied ? "#166534" : BRAND_BLACK }}
          >
            {copied ? "Link copied" : "Copy link"}
            {copied ? (
              <Check size={11} strokeWidth={2.6}/>
            ) : (
              <Copy size={11} strokeWidth={2.4} className="text-neutral-400"/>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
