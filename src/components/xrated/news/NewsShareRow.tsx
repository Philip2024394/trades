"use client";

// Newsroom share row — extracted from BusinessCardButton's share grid.
// Renders WhatsApp / Facebook / X / LinkedIn / Email / Copy-link as a
// stacked list of share buttons. Used at the bottom of every
// /news/<slug> page so readers can blast a piece into the right
// channel in one tap.
//
// Each share URL is the canonical news post permalink. Share text is
// pre-filled with the post title so receivers see context, not just a
// naked URL.

import { useState } from "react";

type Props = {
  url: string;
  title: string;
};

export function NewsShareRow({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedBody = encodeURIComponent(`${title} - ${url}`);

  const links = {
    whatsapp: `https://wa.me/?text=${encodedBody}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`
  };

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this URL:", url);
    }
  }

  return (
    <section className="mt-12 rounded-2xl border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
      <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        Share this piece
      </p>
      <h3 className="mt-1 text-base font-extrabold text-neutral-900 sm:text-lg">
        Spread it to the right people
      </h3>
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <li>
          <ShareLink
            href={links.whatsapp}
            label="Share on WhatsApp"
            chipColor="#25D366"
            icon={<WaIcon />}
          />
        </li>
        <li>
          <ShareLink
            href={links.facebook}
            label="Share on Facebook"
            chipColor="#1877F2"
            icon={<FbIcon />}
          />
        </li>
        <li>
          <ShareLink
            href={links.x}
            label="Share on X"
            chipColor="#000000"
            icon={<XIcon />}
          />
        </li>
        <li>
          <ShareLink
            href={links.linkedin}
            label="Share on LinkedIn"
            chipColor="#0A66C2"
            icon={<LiIcon />}
          />
        </li>
        <li>
          <ShareLink
            href={links.email}
            label="Share by Email"
            chipColor="#525252"
            icon={<MailIcon />}
          />
        </li>
        <li>
          <button
            type="button"
            onClick={onCopy}
            className="flex h-11 w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-900 transition hover:border-neutral-400"
          >
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-900"
              style={{ background: "#FFB300" }}
            >
              <LinkIcon />
            </span>
            {copied ? "Link copied" : "Copy link"}
          </button>
        </li>
      </ul>
    </section>
  );
}

function ShareLink({
  href,
  label,
  chipColor,
  icon
}: {
  href: string;
  label: string;
  chipColor: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-bold text-neutral-900 transition hover:border-neutral-400"
    >
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white"
        style={{ background: chipColor }}
      >
        {icon}
      </span>
      {label}
    </a>
  );
}

function WaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1c-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.8-.4-1.6-1-2.2-1.7-.6-.7-.9-1.4-1-1.8-.1-.3 0-.5.1-.6l.4-.5.3-.4c.1-.2 0-.4 0-.5-.1-.1-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4 0 1.4 1 2.8 1.2 3 .2.2 2 3.1 4.9 4.3 1.4.6 2.1.6 2.8.5.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.1-.5-.3M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z" />
    </svg>
  );
}
function FbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 22v-9h3l.5-3.5h-3.5V7c0-1 .3-1.7 1.8-1.7h1.8V2.2c-.3 0-1.4-.2-2.7-.2-2.7 0-4.5 1.6-4.5 4.6v2.9H7v3.5h2.9V22h3.6z" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.503 11.24h-6.65l-5.214-6.815L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.817l4.713 6.231 5.46-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z" />
    </svg>
  );
}
function LiIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.61 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.99 0 1.78-.77 1.78-1.72V1.72C24 .77 23.21 0 22.22 0z" />
    </svg>
  );
}
function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 6 10 7 10-7" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}
