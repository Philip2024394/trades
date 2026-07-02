"use client";

// BrandTokensEditor — Global panel for design tokens.
//
// Renders one card per token kind (Colours / Radius / Spacing / Fonts).
// Each row is inline-editable and autosaves on blur (or Enter for
// numeric / text inputs). Optimistic UI: local state updates
// immediately, POST fires in the background, indicator flashes.
//
// Live preview across pages is a Module 4 nice-to-have; the reload of
// any editor tab already pulls fresh tokens from the API. Future
// refinement will add BroadcastChannel sync across tabs so the pages
// editor repaints without a reload.

import { useState } from "react";
import type { BrandTokens } from "@/lib/studio/sectionTypes";
import { TOKEN_GROUPS, type TokenKind } from "@/lib/studio/tokens";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const BLUE = "#3B82F6";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

type Props = {
  initialTokens: BrandTokens;
  brandName: string;
};

export function BrandTokensEditor({ initialTokens, brandName }: Props) {
  const [tokens, setTokens] = useState<BrandTokens>(initialTokens);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [rowState, setRowState] = useState<Record<string, SaveState>>({});

  async function save(kind: TokenKind, key: string, value: unknown) {
    const tokenKey = `${kind}.${key}`;
    setSavingKey(tokenKey);
    setRowState((s) => ({ ...s, [tokenKey]: { kind: "saving" } }));
    setTokens((t) => ({ ...t, [tokenKey]: value }));
    try {
      const res = await fetch("/api/studio/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, key, value })
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setRowState((s) => ({
          ...s,
          [tokenKey]: {
            kind: "error",
            message: json.error ?? "save failed"
          }
        }));
      } else {
        setRowState((s) => ({ ...s, [tokenKey]: { kind: "saved" } }));
        window.setTimeout(() => {
          setRowState((s) =>
            s[tokenKey]?.kind === "saved"
              ? { ...s, [tokenKey]: { kind: "idle" } }
              : s
          );
        }, 1500);
      }
    } catch (err) {
      setRowState((s) => ({
        ...s,
        [tokenKey]: {
          kind: "error",
          message: (err as Error)?.message ?? "network"
        }
      }));
    } finally {
      setSavingKey((k) => (k === tokenKey ? null : k));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        {brandName} · Design tokens
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Global styles
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Colours, corner radius, spacing scale, and fonts. Change once —
        every button, card, and heading bound to a token repaints across
        every page under this brand.
      </p>

      <div className="mt-8 space-y-6">
        {TOKEN_GROUPS.map((group) => (
          <section
            key={group.kind}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4">
              <p
                className="text-[10px] font-extrabold uppercase tracking-widest"
                style={{ color: YELLOW }}
              >
                {group.label}
              </p>
              <p className="mt-0.5 text-[12px] text-neutral-500">
                {group.description}
              </p>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2">
              {group.keys.map((key) => {
                const tokenKey = `${group.kind}.${key}`;
                const value = tokens[tokenKey];
                const state = rowState[tokenKey] ?? { kind: "idle" };
                return (
                  <li key={tokenKey}>
                    <TokenRow
                      kind={group.kind}
                      keyName={key}
                      value={value}
                      state={state}
                      busy={savingKey === tokenKey}
                      onSave={(v) => save(group.kind, key, v)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function TokenRow({
  kind,
  keyName,
  value,
  state,
  busy,
  onSave
}: {
  kind: TokenKind;
  keyName: string;
  value: unknown;
  state: SaveState;
  busy: boolean;
  onSave: (v: unknown) => void;
}) {
  const [local, setLocal] = useState(value);
  const { dot, label } = describeState(state);
  const tokenKey = `${kind}.${keyName}`;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          {keyName}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-neutral-400">
          {tokenKey}
        </p>
      </div>

      <div className="shrink-0">
        {kind === "color" ? (
          <ColorInput
            value={typeof local === "string" ? local : "#000000"}
            onCommit={(v) => {
              setLocal(v);
              onSave(v);
            }}
          />
        ) : kind === "radius" || kind === "spacing" ? (
          <NumberInput
            value={typeof local === "number" ? local : 0}
            onCommit={(v) => {
              setLocal(v);
              onSave(v);
            }}
          />
        ) : (
          <FontInput
            value={typeof local === "string" ? local : ""}
            onCommit={(v) => {
              setLocal(v);
              onSave(v);
            }}
          />
        )}
      </div>

      <span
        aria-live="polite"
        title={label}
        className="grid h-5 w-5 shrink-0 place-items-center"
      >
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: dot, opacity: busy || state.kind !== "idle" ? 1 : 0.3 }}
        />
      </span>
    </div>
  );
}

function ColorInput({
  value,
  onCommit
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="color"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onCommit(local)}
        className="h-8 w-10 cursor-pointer rounded-md border border-neutral-300 bg-white p-0.5"
      />
      <span className="font-mono text-[11px] font-bold text-neutral-700">
        {local}
      </span>
    </label>
  );
}

function NumberInput({
  value,
  onCommit
}: {
  value: number;
  onCommit: (v: number) => void;
}) {
  const [local, setLocal] = useState<string>(String(value));
  return (
    <label className="inline-flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        max={999}
        step={1}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const n = Number(local);
          if (Number.isFinite(n)) onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const n = Number(local);
            if (Number.isFinite(n)) onCommit(n);
          }
        }}
        className="h-8 w-16 rounded-md border border-neutral-300 bg-white px-2 text-right font-mono text-[12px] font-bold"
      />
      <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
        px
      </span>
    </label>
  );
}

function FontInput({
  value,
  onCommit
}: {
  value: string;
  onCommit: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className="h-8 w-64 truncate rounded-md border border-neutral-300 bg-white px-2 font-mono text-[11px]"
      placeholder="system-ui, sans-serif"
    />
  );
}

function describeState(s: SaveState): { dot: string; label: string } {
  switch (s.kind) {
    case "idle":
      return { dot: "#A3A3A3", label: "Idle" };
    case "saving":
      return { dot: BLUE, label: "Saving…" };
    case "saved":
      return { dot: GREEN, label: "Saved" };
    case "error":
      return { dot: RED, label: `Error: ${s.message}` };
  }
}
