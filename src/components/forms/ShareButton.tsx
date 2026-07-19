"use client";

// Share button for a Site Interest image.
//
// ALWAYS opens a custom in-page popup — never delegates to the OS
// share sheet (per Philip 2026-07-17: "not the computer outdated
// share system").
//
// The popup renders in a REACT PORTAL to `document.body` so it
// escapes the card's `overflow-hidden` (which otherwise clips the
// popover inside the rounded card boundary). Position is computed
// from the button's `getBoundingClientRect()` and applied as
// `position: fixed` on the portal element. Repositions on scroll
// + resize while open.
//
// Every share destination points at the search URL so the arriving
// visitor lands on the Site Interest surface that showcases the
// image, not a bare image file — protects the platform brand.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Share2, Check, Copy, X as XIcon } from "lucide-react";

const BRAND_BLACK = "#0A0A0A";
const POPOVER_WIDTH = 256; // must match the w-64 class below

type Props = {
  /** Absolute URL to share. Base for every deep-link. Should point at
   *  a page that showcases the image, not the raw file. */
  shareUrl: string;
  /** Short line pre-filled into WhatsApp / X / email subject. */
  shareText: string;
  /** Visual style. `overlay` (default) = floating pill on the image
   *  (white bg + shadow). `ghost` = utility-row variant (transparent
   *  bg, matches neighbours). */
  variant?: "overlay" | "ghost";
};

type ShareChannel = {
  key:   string;
  label: string;
  href:  string;
  bg:    string;
  fg:    string;
  glyph: string;
};

function buildChannels(url: string, text: string): ShareChannel[] {
  const enc = encodeURIComponent;
  const combined = `${text} ${url}`;
  return [
    { key: "whatsapp",  label: "WhatsApp",  href: `https://wa.me/?text=${enc(combined)}`,                                                    bg: "#166534", fg: "#FFF", glyph: "WA" },
    { key: "facebook",  label: "Facebook",  href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,                                bg: "#1877F2", fg: "#FFF", glyph: "f"  },
    { key: "x",         label: "X",         href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,                      bg: "#0A0A0A", fg: "#FFF", glyph: "𝕏"  },
    { key: "linkedin",  label: "LinkedIn",  href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,                         bg: "#0A66C2", fg: "#FFF", glyph: "in" },
    { key: "pinterest", label: "Pinterest", href: `https://pinterest.com/pin/create/button/?url=${enc(url)}&description=${enc(text)}`,       bg: "#E60023", fg: "#FFF", glyph: "P"  },
    { key: "email",     label: "Email",     href: `mailto:?subject=${enc(text)}&body=${enc(`${text}\n\n${url}`)}`,                           bg: "#4B5563", fg: "#FFF", glyph: "@"  }
  ];
}

export function ShareButton({ shareUrl, shareText, variant = "overlay" }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  const channels = buildChannels(shareUrl, shareText);

  // Recompute the popover position from the button's current
  // getBoundingClientRect. Called on open, and every scroll/resize
  // while open so the popover tracks its anchor.
  const reposition = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    // Prefer right-aligned to the button. If that would overflow the
    // left edge, clamp to a small margin. Vertical: below the button
    // with 6px gap. `position: fixed` = coords are viewport-relative.
    const right = r.right;
    const left = Math.max(8, Math.min(right - POPOVER_WIDTH, window.innerWidth - POPOVER_WIDTH - 8));
    const top = r.bottom + 6;
    setPos({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    function onScroll() { reposition(); }
    function onResize() { reposition(); }
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, reposition]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked (Safari private). Popover stays open. */
    }
  }, [shareUrl]);

  // Close on outside click / Escape when open. Outside = neither
  // the button nor the portalled popover.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          variant === "ghost"
            ? "inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            : "inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-md backdrop-blur transition hover:bg-white"
        }
        aria-label="Share image"
        aria-expanded={open}
        title="Share"
      >
        <Share2 size={13} strokeWidth={2.4}/>
      </button>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popRef}
            className="fixed z-[9999] w-64 overflow-hidden rounded-2xl border bg-white shadow-2xl"
            style={{
              top:         `${pos.top}px`,
              left:        `${pos.left}px`,
              borderColor: "rgba(0,0,0,0.10)"
            }}
            role="menu"
          >
            <div
              className="flex items-center justify-between border-b px-3 py-2"
              style={{ borderColor: "rgba(0,0,0,0.06)" }}
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                Share this image
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close share menu"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                <XIcon size={11} strokeWidth={2.6}/>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 p-3">
              {channels.map((c) => (
                <a
                  key={c.key}
                  href={c.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="group flex flex-col items-center gap-1.5"
                  title={`Share on ${c.label}`}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full font-black shadow-sm transition group-hover:scale-105"
                    style={{
                      backgroundColor: c.bg,
                      color:           c.fg,
                      fontSize:        c.glyph.length >= 2 ? 13 : 16,
                      lineHeight:      1
                    }}
                  >
                    {c.glyph}
                  </span>
                  <span className="text-[10px] font-bold text-neutral-700">
                    {c.label}
                  </span>
                </a>
              ))}
            </div>

            <button
              type="button"
              onClick={copyLink}
              className="flex w-full items-center justify-between gap-2 border-t px-3 py-2.5 text-left text-[12px] font-black transition hover:bg-neutral-50"
              style={{
                borderColor: "rgba(0,0,0,0.06)",
                color:       copied ? "#166534" : BRAND_BLACK
              }}
            >
              <span className="inline-flex items-center gap-2">
                {copied ? <Check size={13} strokeWidth={2.6}/> : <Copy size={13} strokeWidth={2.4} className="text-neutral-500"/>}
                {copied ? "Link copied" : "Copy link"}
              </span>
              <span className="max-w-[140px] truncate text-[10px] font-bold text-neutral-400">
                {shareUrl.replace(/^https?:\/\//, "")}
              </span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
