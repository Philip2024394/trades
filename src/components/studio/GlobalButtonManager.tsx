"use client";

// Studio Global Button Manager — merchant-facing.
//
// 7 role slots (primary, secondary, outline, ghost, danger, success,
// cta). Each row shows the current variant + preview + a picker for
// swapping variants scoped to that role's compatible category.
// Changing a global fires PUT /api/studio/global-buttons and every
// section instance bound to the same role repaints on next render.

import { useEffect, useMemo, useState } from "react";
import { buttonRegistry } from "@/platform/buttons";
import "@/platform/buttons";
import { fetchWithRetry } from "@/lib/studio/fetchWithRetry";
import type { BrandTokens, MerchantData } from "@/lib/studio/sectionTypes";
import type { ButtonRole } from "@/platform/buttons/types";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";
const GREEN = "#10B981";
const RED = "#DC2626";

type GlobalSlot = {
  role: string;
  label: string;
  description: string;
  eligibleRoles: ButtonRole[];
};

const SLOTS: GlobalSlot[] = [
  {
    role: "primary",
    label: "Primary",
    description: "Your loudest CTA. Book, buy, get started.",
    eligibleRoles: ["primary_action", "cta_book", "cta_buy", "cta_join", "cta_subscribe"]
  },
  {
    role: "secondary",
    label: "Secondary",
    description: "Sits beside the primary. Learn more, browse, portfolio.",
    eligibleRoles: ["secondary_action", "cta_learn_more"]
  },
  {
    role: "outline",
    label: "Outline",
    description: "Ringed, quiet, versatile.",
    eligibleRoles: ["secondary_action"]
  },
  {
    role: "ghost",
    label: "Ghost",
    description: "Type-only, chrome-free.",
    eligibleRoles: ["cta_learn_more"]
  },
  {
    role: "danger",
    label: "Danger",
    description: "Delete, cancel, remove.",
    eligibleRoles: ["util_delete", "danger_action"]
  },
  {
    role: "success",
    label: "Success",
    description: "Confirm, save, mark complete.",
    eligibleRoles: ["success_action", "util_save"]
  },
  {
    role: "cta",
    label: "WhatsApp CTA",
    description: "One-tap message on WhatsApp.",
    eligibleRoles: ["cta_whatsapp"]
  }
];

type ServerGlobal = {
  role: string;
  variantKey: string;
  config: Record<string, unknown>;
  version: number;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving"; role: string }
  | { kind: "success"; role: string }
  | { kind: "error"; role: string; message: string };

export function GlobalButtonManager({
  merchantTokens,
  merchantData
}: {
  merchantTokens: BrandTokens;
  merchantData: MerchantData;
}) {
  const [globals, setGlobals] = useState<Record<string, ServerGlobal | null>>(
    Object.fromEntries(SLOTS.map((s) => [s.role, null]))
  );
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/studio/global-buttons");
        const json = (await res.json()) as
          | { ok: true; globals: ServerGlobal[] }
          | { ok: false; error: string };
        if (!json.ok) throw new Error(json.error);
        const next: Record<string, ServerGlobal | null> = {};
        for (const s of SLOTS) next[s.role] = null;
        for (const g of json.globals) next[g.role] = g;
        setGlobals(next);
        setLoadState("ready");
      } catch {
        setLoadState("error");
      }
    })();
  }, []);

  const candidatesByRole = useMemo(() => {
    const out: Record<string, ReturnType<typeof buttonRegistry.list>> = {};
    for (const s of SLOTS) {
      out[s.role] = buttonRegistry
        .list()
        .filter((v) => s.eligibleRoles.includes(v.role));
    }
    return out;
  }, []);

  async function saveGlobal(role: string, variantKey: string) {
    setSaveState({ kind: "saving", role });
    const reg = buttonRegistry.require(variantKey);
    try {
      const res = await fetchWithRetry("/api/studio/global-buttons", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          variantKey,
          config: reg.defaultConfig(),
          states: reg.states,
          motion: reg.motion,
          shape: reg.shape,
          size: reg.size
        })
      });
      const json = (await res.json()) as
        | { ok: true }
        | { ok: false; error: string };
      if (!json.ok) throw new Error(json.error);
      setGlobals((prev) => ({
        ...prev,
        [role]: {
          role,
          variantKey,
          config: reg.defaultConfig(),
          version: (prev[role]?.version ?? 0) + 1
        }
      }));
      setSaveState({ kind: "success", role });
      window.setTimeout(() => setSaveState({ kind: "idle" }), 2000);
    } catch (err) {
      setSaveState({
        kind: "error",
        role,
        message: (err as Error).message ?? "network"
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 sm:py-14">
      <p
        className="text-[10px] font-extrabold uppercase tracking-widest"
        style={{ color: YELLOW }}
      >
        Global Buttons
      </p>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight text-neutral-900 sm:text-4xl">
        Set them once. Update everywhere.
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-neutral-600">
        Every section on every page that renders a role-bound button
        inherits from this brand's globals. Change the primary variant
        below and every hero's primary CTA repaints on next preview.
      </p>

      {loadState === "loading" && (
        <p className="mt-8 text-[13px] text-neutral-500">Loading…</p>
      )}
      {loadState === "error" && (
        <p role="alert" className="mt-8 text-[13px] text-red-600">
          Couldn't load your globals. Refresh to try again.
        </p>
      )}
      {loadState === "ready" && (
        <ul className="mt-8 flex flex-col gap-4">
          {SLOTS.map((slot) => {
            const current = globals[slot.role];
            const state =
              saveState.kind !== "idle" && saveState.role === slot.role
                ? saveState
                : null;
            const candidates = candidatesByRole[slot.role];
            return (
              <li key={slot.role}>
                <GlobalSlotRow
                  slot={slot}
                  current={current}
                  candidates={candidates}
                  merchantTokens={merchantTokens}
                  merchantData={merchantData}
                  saveState={state}
                  onPick={(variantKey) => saveGlobal(slot.role, variantKey)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GlobalSlotRow({
  slot,
  current,
  candidates,
  merchantTokens,
  merchantData,
  saveState,
  onPick
}: {
  slot: GlobalSlot;
  current: ServerGlobal | null;
  candidates: ReturnType<typeof buttonRegistry.list>;
  merchantTokens: BrandTokens;
  merchantData: MerchantData;
  saveState: SaveState | null;
  onPick: (variantKey: string) => void;
}) {
  const activeVariantKey = current?.variantKey ?? candidates[0]?.id;

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            {slot.role}
          </p>
          <h2 className="mt-0.5 text-[16px] font-extrabold text-neutral-900">
            {slot.label}
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-600">
            {slot.description}
          </p>
        </div>
        {saveState?.kind === "saving" && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white"
            style={{ background: "#525252" }}
          >
            Saving…
          </span>
        )}
        {saveState?.kind === "success" && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white"
            style={{ background: GREEN }}
          >
            Saved ✓
          </span>
        )}
        {saveState?.kind === "error" && (
          <span
            role="alert"
            className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-white"
            style={{ background: RED }}
          >
            {saveState.message}
          </span>
        )}
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {candidates.map((reg) => {
          const Renderer = reg.renderer;
          const isActive = activeVariantKey === reg.id;
          return (
            <li key={reg.id}>
              <button
                type="button"
                onClick={() => onPick(reg.id)}
                className="w-full overflow-hidden rounded-xl border p-4 text-left transition"
                style={{
                  background: isActive ? "rgba(255,179,0,0.06)" : "#FFFFFF",
                  borderColor: isActive ? "#0A0A0A" : "#E5E5E5"
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: isActive ? BLACK : "#D4D4D4" }}
                  />
                  <p className="text-[11px] font-extrabold text-neutral-900">
                    {reg.name}
                  </p>
                </div>
                <div className="mb-2 flex justify-center">
                  <Renderer
                    instanceId={`global-preview-${slot.role}-${reg.id}`}
                    config={reg.defaultConfig()}
                    state="default"
                    tokens={merchantTokens}
                    role={reg.role}
                    size={reg.size}
                    shape={reg.shape}
                    motion={reg.motion}
                    data={merchantData}
                    mode="preview"
                  />
                </div>
                <p className="line-clamp-2 text-[10px] text-neutral-500">
                  {reg.shortPitch}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
