"use client";

import { useState } from "react";

export function GuideShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const text = `${title} — ${url}`;
  const enc = encodeURIComponent;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <section
      aria-label="Share this guide"
      className="mt-10 rounded-2xl border border-brand-line bg-brand-surface p-4 sm:p-5"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
        Share this guide
      </p>
      <p className="mt-1 text-xs text-brand-muted">
        Send it to a mate on site — or post it where you talk shop.
      </p>
      <ul className="mt-3 flex flex-wrap items-center gap-2">
        <li>
          <button
            type="button"
            onClick={copyLink}
            aria-live="polite"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-line bg-black/40 px-3 py-2 text-xs font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5" />
            </svg>
            {copied ? "Link copied" : "Copy link"}
          </button>
        </li>
        <li>
          <a
            href={`https://wa.me/?text=${enc(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-line bg-black/40 px-3 py-2 text-xs font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Zm4.55-6.23c-.25-.13-1.47-.73-1.7-.82s-.39-.13-.55.13-.64.81-.78.97-.29.19-.54.06a6.84 6.84 0 0 1-2-1.24 7.55 7.55 0 0 1-1.4-1.74c-.15-.25 0-.39.11-.51s.25-.29.37-.43a1.6 1.6 0 0 0 .25-.41.46.46 0 0 0 0-.43c-.06-.13-.55-1.33-.76-1.82s-.4-.41-.55-.42h-.47a.91.91 0 0 0-.66.31 2.78 2.78 0 0 0-.87 2.07 4.83 4.83 0 0 0 1 2.55 11 11 0 0 0 4.21 3.73c.59.25 1 .4 1.4.52a3.41 3.41 0 0 0 1.55.1 2.55 2.55 0 0 0 1.66-1.17 2 2 0 0 0 .15-1.17c-.06-.11-.23-.18-.48-.31Z" />
            </svg>
            WhatsApp
          </a>
        </li>
        <li>
          <a
            href={`https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-line bg-black/40 px-3 py-2 text-xs font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z" />
            </svg>
            X
          </a>
        </li>
        <li>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-line bg-black/40 px-3 py-2 text-xs font-semibold text-brand-text transition hover:border-brand-accent hover:text-brand-accent active:scale-95"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46H15.2c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
            </svg>
            Facebook
          </a>
        </li>
      </ul>
    </section>
  );
}
