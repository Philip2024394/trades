"use client";

// src/app/nex-native/_copy-nex-link-button.tsx
//
// Wave 4 · Client-side "Copy your NEX link" affordance · sealed 2026-09-25.
// Founder acquisition-loop doctrine: owner needs one-tap ability to copy
// their `philip.nex` / `cakeshopjogja.nex` address from every relevant
// surface so they can paste it into Instagram bios, email signatures, QR
// codes, etc.
//
// This component is intentionally tiny · zero deps beyond React. It writes
// the FULL shareable URL (with origin) to the clipboard so the paste lands
// as a real clickable link everywhere.

import React, { useCallback, useState } from "react";

interface CopyNexLinkButtonProps {
  /** The path or full URL to copy. If relative, prepends window.location.origin. */
  url: string;
  /** The pretty display (e.g. "cakeshopjogja.nex") shown in the button. */
  display: string;
  /** Optional CSS class overrides for outer wrapper. */
  className?: string;
}

export function CopyNexLinkButton({ url, display, className }: CopyNexLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const onClick = useCallback(async () => {
    try {
      const absolute = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be blocked in some browsers · fall back to prompt.
      const absolute = url.startsWith("http") ? url : `${window.location.origin}${url}`;
      window.prompt("Copy your NEX link", absolute);
    }
  }, [url]);
  return (
    <button
      type="button"
      onClick={onClick}
      data-nex-copy-link
      data-nex-copy-target={url}
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--nex-accent-100)] bg-white/80 px-3 py-1.5 text-sm text-[var(--nex-accent-700)] transition hover:border-[var(--nex-accent-600)] hover:bg-[var(--nex-accent-50)] ${className ?? ""}`}
    >
      <span aria-hidden="true">🔗</span>
      <span className="font-medium">{copied ? "Copied ✓" : display}</span>
      <span className="text-[10px] text-[var(--nex-neutral-500)]">{copied ? "" : "· copy"}</span>
    </button>
  );
}
