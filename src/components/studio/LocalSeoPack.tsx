"use client";

// Local SEO Pack — GMB-ready content generator.
//
// Deterministic templates (no LLM) fed by the merchant's actual
// blueprint + credentials + coverage. Every block has a copy-to-
// clipboard button, a char-count where GMB has a limit, and a hint
// telling the merchant exactly where to paste it in Google Business
// Profile.

import { useEffect, useState } from "react";
import type { LocalSeoBlock, LocalSeoSection } from "@/lib/studio/localSeo/types";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const NEUTRAL = "#525252";

type PackResponse =
  | {
      ok: true;
      context: {
        merchantName: string;
        tradeLabel: string;
        city: string;
        coveragePostcode: string | null;
        coverageRadiusMi: number | null;
        verifiedCredentials: string[];
        blueprintSlug: string | null;
      };
      pack: Record<LocalSeoSection, LocalSeoBlock[]>;
    }
  | { ok: false; error: string };

const TABS: { key: LocalSeoSection; label: string; hint: string }[] = [
  { key: "description", label: "Description", hint: "One paragraph, 750 chars max" },
  { key: "services", label: "Services", hint: "One paste per service" },
  { key: "posts", label: "Weekly posts", hint: "Rotate through the month" },
  { key: "reviews", label: "Review requests", hint: "Email · SMS · WhatsApp" }
];

export function LocalSeoPack() {
  const [data, setData] = useState<PackResponse | null>(null);
  const [tab, setTab] = useState<LocalSeoSection>("description");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/studio/local-seo");
        const json = (await res.json()) as PackResponse;
        setData(json);
      } catch (err) {
        setData({ ok: false, error: (err as Error).message ?? "network" });
      }
    })();
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Local SEO pack
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Ready-to-paste content for Google Business Profile.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Everything's generated from your live blueprint, verified
        credentials, and coverage. Copy any block, paste into Google
        Business Profile. Nothing gets sent anywhere unless you paste it.
      </p>
      <p className="mt-2 max-w-2xl text-[11px] text-neutral-500">
        Honest scope note: Google's Business Profile write API is
        allowlist-gated. Rather than fake it, we generate the content
        and let you paste directly. Auto-sync layers on later.
      </p>

      {data === null && (
        <p className="mt-8 text-[13px] text-neutral-500">Generating pack…</p>
      )}
      {data && !data.ok && (
        <p
          role="alert"
          className="mt-8 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700"
        >
          {data.error}
        </p>
      )}

      {data && data.ok && (
        <>
          {/* Context strip */}
          <div className="mt-8 grid grid-cols-2 gap-3 rounded-2xl border border-neutral-200 bg-white p-4 sm:grid-cols-4">
            <ContextChip label="Business" value={data.context.merchantName} />
            <ContextChip label="Trade" value={data.context.tradeLabel} />
            <ContextChip
              label="Coverage"
              value={
                data.context.coveragePostcode
                  ? `${data.context.coveragePostcode} · ${data.context.coverageRadiusMi ?? 15} mi`
                  : "National"
              }
            />
            <ContextChip
              label="Verified"
              value={
                data.context.verifiedCredentials.length > 0
                  ? `${data.context.verifiedCredentials.length} badge${data.context.verifiedCredentials.length === 1 ? "" : "s"}`
                  : "None yet"
              }
              accent={
                data.context.verifiedCredentials.length > 0 ? GREEN : NEUTRAL
              }
            />
          </div>

          {/* Tabs */}
          <div className="mt-6 flex flex-wrap gap-1 border-b border-neutral-200">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className="relative px-3 py-2 text-[12px] font-extrabold uppercase tracking-widest transition"
                  style={{
                    color: on ? "#0A0A0A" : NEUTRAL
                  }}
                >
                  {t.label}
                  {on && (
                    <span
                      className="absolute inset-x-0 -bottom-px h-0.5"
                      style={{ background: YELLOW }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Blocks */}
          <div className="mt-4 space-y-3">
            {(data.pack[tab] ?? []).map((block) => (
              <BlockCard key={block.id} block={block} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ContextChip({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0">
      <p
        className="text-[9px] font-extrabold uppercase tracking-widest"
        style={{ color: accent ?? NEUTRAL }}
      >
        {label}
      </p>
      <p className="mt-0.5 truncate text-[12px] font-extrabold text-neutral-900">
        {value}
      </p>
    </div>
  );
}

function BlockCard({ block }: { block: LocalSeoBlock }) {
  const [copied, setCopied] = useState(false);
  const len = block.content.length;
  const overLimit = block.charLimit ? len > block.charLimit : false;

  async function copy() {
    try {
      await navigator.clipboard.writeText(block.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard may be blocked — silently ignore
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 bg-neutral-50 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-extrabold text-neutral-900">
            {block.label}
          </p>
          {block.hint && (
            <p className="mt-0.5 text-[10px] text-neutral-500">{block.hint}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {block.charLimit && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white"
              style={{ background: overLimit ? RED : GREEN }}
            >
              {len} / {block.charLimit}
            </span>
          )}
          <button
            type="button"
            onClick={copy}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-white transition hover:brightness-95"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="whitespace-pre-wrap break-words px-4 py-3 text-[13px] leading-relaxed text-neutral-800" style={{ fontFamily: "inherit" }}>
        {block.content}
      </pre>
    </div>
  );
}
