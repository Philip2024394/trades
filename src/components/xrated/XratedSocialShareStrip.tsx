"use client";

// Xrated Trades — horizontal share strip: Copy / WhatsApp / Facebook /
// Instagram / TikTok. IG/TikTok don't have public share intents from
// the web — IG falls back to clipboard copy, TikTok uses the upload URL.

import { useState } from "react";

export function XratedSocialShareStrip({
  url,
  displayName
}: {
  url: string;
  displayName: string;
}) {
  const [copied, setCopied] = useState<"link" | "ig" | null>(null);
  const text = `${displayName} — ${url}`;
  const enc = encodeURIComponent;

  async function copy(kind: "link" | "ig") {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  const btnClass =
    "inline-flex h-11 items-center gap-2 rounded-lg border border-brand-line bg-white px-3 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] hover:text-[#FFB300] active:scale-95";

  return (
    <section aria-label="Share this tradesperson" className="mt-6 rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
        Share this trade off
      </p>
      <p className="mt-1 text-xs text-brand-muted">
        Send it to a mate — or post it where you talk shop.
      </p>
      <ul className="mt-3 flex flex-wrap items-center gap-2">
        <li>
          <button
            type="button"
            onClick={() => copy("link")}
            aria-live="polite"
            className={btnClass}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5" />
            </svg>
            {copied === "link" ? "Link copied" : "Copy link"}
          </button>
        </li>
        <li>
          <a
            href={`https://api.whatsapp.com/send?text=${enc(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={btnClass}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Zm4.55-6.23c-.25-.13-1.47-.73-1.7-.82s-.39-.13-.55.13-.64.81-.78.97-.29.19-.54.06a6.84 6.84 0 0 1-2-1.24 7.55 7.55 0 0 1-1.4-1.74c-.15-.25 0-.39.11-.51s.25-.29.37-.43a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.43c-.06-.13-.55-1.33-.76-1.82s-.4-.41-.55-.42h-.47a.91.91 0 0 0-.66.31 2.78 2.78 0 0 0-.87 2.07 4.83 4.83 0 0 0 1 2.55 11 11 0 0 0 4.21 3.73c.59.25 1 .4 1.4.52a3.41 3.41 0 0 0 1.55.1 2.55 2.55 0 0 0 1.66-1.17 2 2 0 0 0 .15-1.17c-.06-.11-.23-.18-.48-.31Z" />
            </svg>
            WhatsApp
          </a>
        </li>
        <li>
          <a
            href={`https://facebook.com/sharer/sharer.php?u=${enc(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={btnClass}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46H15.2c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
            </svg>
            Facebook
          </a>
        </li>
        <li>
          <button
            type="button"
            onClick={() => copy("ig")}
            aria-live="polite"
            className={btnClass}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.77.13 4.9.32 4.14.61c-.79.31-1.46.72-2.13 1.39A5.86 5.86 0 0 0 .61 4.14C.32 4.9.13 5.77.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.25 2.15.54 2.91.31.79.72 1.46 1.39 2.13.67.67 1.34 1.08 2.13 1.39.76.29 1.63.48 2.91.54C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.25 2.91-.54.79-.31 1.46-.72 2.13-1.39a5.86 5.86 0 0 0 1.39-2.13c.29-.76.48-1.63.54-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.25-2.15-.54-2.91a5.86 5.86 0 0 0-1.39-2.13A5.86 5.86 0 0 0 19.86.61C19.1.32 18.23.13 16.95.07 15.67.01 15.26 0 12 0Zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84Zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4Zm6.41-11.84a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44Z" />
            </svg>
            {copied === "ig" ? "Link copied for IG" : "Instagram"}
          </button>
        </li>
        <li>
          <a
            href={`https://www.tiktok.com/upload?url=${enc(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={btnClass}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.94A8.16 8.16 0 0 0 22 10.6V7.13a4.85 4.85 0 0 1-2.41-.44Z" />
            </svg>
            TikTok
          </a>
        </li>
      </ul>
    </section>
  );
}

export default XratedSocialShareStrip;
