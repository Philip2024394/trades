"use client";

import { useState } from "react";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy this:", text);
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-accent px-3 text-[13px] font-bold text-black hover:opacity-90"
    >
      {copied ? "Copied!" : label ?? "Copy link"}
    </button>
  );
}
