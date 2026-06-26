"use client";

// Vanity-slug picker for the Trade Off signup form. Live-prefixed with
// `xratedtrade.com/`, strips/lowercases to [a-z0-9-] as the tradie types,
// and shows a debounced availability check (green ✓ / red ✗) next to the
// input.
//
// Leaving the field blank is allowed — the create API falls back to the
// auto-generated displayName+city slug.

import { useEffect, useRef, useState } from "react";
import {
  slugifyXrated,
  validateXratedSlug,
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH
} from "@/lib/xratedSlug";

export type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

// Keep the in-field sanitiser permissive — the canonical strip happens
// on submit + on the server. This way the user sees "their" hyphen
// while still typing without having it eaten by aggressive normalisation.
function sanitize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(0, SLUG_MAX_LENGTH);
}
void slugifyXrated; // re-exported for callers that want it inline

export function SlugAvailabilityField({
  value,
  onChange,
  selfSlug,
  placeholder
}: {
  value: string;
  onChange: (next: string) => void;
  // selfSlug — when editing, the tradie's current slug shouldn't read as taken
  selfSlug?: string;
  placeholder?: string;
}) {
  const [status, setStatus] = useState<SlugStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      setStatus("idle");
      return;
    }
    if (validateXratedSlug(trimmed) !== null) {
      setStatus("invalid");
      return;
    }
    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      const id = ++reqIdRef.current;
      try {
        const qs = new URLSearchParams({ slug: trimmed });
        if (selfSlug) qs.set("self", selfSlug);
        const res = await fetch(`/api/trade-off/slug-available?${qs.toString()}`);
        const body = (await res.json().catch(() => ({}))) as {
          available?: boolean;
          reason?: string;
        };
        if (id !== reqIdRef.current) return;
        if (body.available) setStatus("available");
        else if (body.reason === "reserved") setStatus("invalid");
        else setStatus("taken");
      } catch {
        if (id !== reqIdRef.current) return;
        setStatus("idle");
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, selfSlug]);

  return (
    <div>
      <div className="flex items-stretch overflow-hidden rounded-lg border border-brand-line bg-brand-bg focus-within:border-[#FFB300]">
        <span className="inline-flex items-center bg-neutral-100 px-3 text-xs text-brand-muted">
          xratedtrade.com/
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(sanitize(e.target.value))}
          placeholder={placeholder ?? "your-trade-name"}
          maxLength={SLUG_MAX_LENGTH}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-xs text-brand-text placeholder:text-brand-muted focus:outline-none"
          autoComplete="off"
          spellCheck={false}
        />
        <span
          className="inline-flex w-10 items-center justify-center text-sm"
          aria-live="polite"
        >
          {status === "checking" && (
            <span className="text-brand-muted" aria-label="checking">…</span>
          )}
          {status === "available" && (
            <span className="text-brand-success" aria-label="available">✓</span>
          )}
          {status === "taken" && (
            <span className="text-red-600" aria-label="taken">✗</span>
          )}
          {status === "invalid" && (
            <span className="text-red-400" aria-label="invalid">✗</span>
          )}
        </span>
      </div>
      <p className="mt-1 text-xs text-brand-muted">
        {status === "taken" && "That URL is already taken — try another."}
        {status === "invalid" && `Use ${SLUG_MIN_LENGTH}–${SLUG_MAX_LENGTH} lowercase letters / numbers / single hyphens. No leading or trailing hyphens.`}
        {status === "available" && (
          <span className="text-brand-success">Great — that URL is yours.</span>
        )}
        {(status === "idle" || status === "checking") && (
          <>Leave blank and we'll generate one from your name and city.</>
        )}
      </p>
    </div>
  );
}
