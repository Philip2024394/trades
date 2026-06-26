"use client";

// Xrated Trades — single round share-icon button on the banner top-right.
// On tap, opens a small floating popover with share targets:
//   WhatsApp · Facebook · X · Telegram · Copy link
// Each target opens the platform's share endpoint in a new tab; Copy link
// uses navigator.clipboard with a transient "Copied" confirmation.

import { useEffect, useRef, useState } from "react";

export function ShareIconButton({
  shareUrl,
  shareTitle,
  themeColor
}: {
  shareUrl: string;
  shareTitle: string;
  themeColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Click-outside closes the popover.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Old browser fallback — open prompt() so they can copy.
      window.prompt("Copy this URL:", shareUrl);
    }
  }

  const t = encodeURIComponent(shareTitle);
  const u = encodeURIComponent(shareUrl);
  const targets: Array<{
    key: string;
    label: string;
    href?: string;
    onClick?: () => void;
    icon: React.ReactNode;
    bg: string;
  }> = [
    {
      key: "wa",
      label: "WhatsApp",
      href: `https://wa.me/?text=${t}%20${u}`,
      bg: "#25D366",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
        </svg>
      )
    },
    {
      key: "fb",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      bg: "#1877F2",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.46H15.2c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
        </svg>
      )
    },
    {
      key: "x",
      label: "X",
      href: `https://x.com/intent/tweet?text=${t}&url=${u}`,
      bg: "#0F1419",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.61 10.46 22.06 1h-2L13 9.04 6.91 1H1l8.83 11.66L1 23h2.01l7.55-8.56L17 23h5.06ZM4.05 2.51h2.85L19.95 21.5h-2.85Z" />
        </svg>
      )
    },
    {
      key: "tg",
      label: "Telegram",
      href: `https://t.me/share/url?url=${u}&text=${t}`,
      bg: "#229ED9",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9.78 15.27 9.41 20a1 1 0 0 0 1.63.6l3.21-2.65 5 3.66c.92.5 1.57.24 1.83-.85L23.5 4.18c.32-1.43-.52-2.07-1.6-1.66L2.32 9.92c-1.3.51-1.29 1.23-.23 1.56l5.11 1.59 11.86-7.48c.56-.33 1.07-.15.65.18Z" />
        </svg>
      )
    },
    {
      key: "copy",
      label: copied ? "Copied!" : "Copy link",
      onClick: copyLink,
      bg: "#374151",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )
    }
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Share this profile"
        aria-expanded={open}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/75 sm:h-12 sm:w-12"
        style={{ color: "#FFFFFF" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Share options"
          className="absolute right-0 top-12 z-30 min-w-[200px] rounded-2xl border border-white/10 bg-black/95 p-3 shadow-2xl backdrop-blur-sm sm:top-14"
        >
          <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-white/60">
            Share via
          </p>
          <ul className="grid grid-cols-3 gap-2">
            {targets.map((tgt) => {
              const inner = (
                <>
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white"
                    style={{ background: tgt.bg }}
                  >
                    {tgt.icon}
                  </span>
                  <span className="mt-1 text-[10px] font-semibold text-white">
                    {tgt.label}
                  </span>
                </>
              );
              return (
                <li key={tgt.key}>
                  {tgt.href ? (
                    <a
                      href={tgt.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => window.setTimeout(() => setOpen(false), 50)}
                      className="flex flex-col items-center rounded-xl p-1.5 transition hover:bg-white/10"
                    >
                      {inner}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={tgt.onClick}
                      className="flex w-full flex-col items-center rounded-xl p-1.5 transition hover:bg-white/10"
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ShareIconButton;
