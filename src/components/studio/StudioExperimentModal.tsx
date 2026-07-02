"use client";

// StudioExperimentModal — create + monitor + roll out A/B tests for a
// single section instance.
//
// Flow:
//   1. Modal opens with the selected section instance's config as the
//      baseline (variant A).
//   2. Merchant edits variant B: today that's a keyword-based text
//      edit (headline / subheadline / cta text). Deeper variant editing
//      lives in future modules — the important shape is that variantB
//      is a partial config overlay.
//   3. Start test → POST /api/studio/experiments.
//   4. While running: shows per-variant view / click / convert counts
//      streamed from GET /api/studio/analytics/page (filtered by
//      instance + bucket) and CTR delta.
//   5. Rollout: POST /api/studio/experiments/:id/rollout with the
//      chosen winner. The live layout is patched server-side.
//
// The modal intentionally uses cheap unstyled inputs for variant B —
// deep variant editing will grow into a full-fidelity split-view in a
// later module.

import { useCallback, useEffect, useState } from "react";

const YELLOW = "#FFB300";
const GREEN = "#10B981";
const RED = "#DC2626";
const BLUE = "#3B82F6";

type ExperimentRow = {
  id: string;
  page_id: string;
  instance_id: string;
  name: string;
  status: "running" | "stopped" | "rolled_out";
  winner: "A" | "B" | null;
  split_a: number;
  variant_a_config: Record<string, unknown>;
  variant_b_config: Record<string, unknown>;
  created_at: string;
  ended_at: string | null;
};

type SectionRow = {
  section_key: string | null;
  instance_id: string | null;
  views: number;
  clicks: number;
  converts: number;
  ctr: number;
  conversion_rate: number;
};

type Props = {
  pageId: string;
  instanceId: string;
  baselineConfig: Record<string, unknown>;
  onClose: () => void;
  onRollout?: (winner: "A" | "B") => void;
};

export function StudioExperimentModal({
  pageId,
  instanceId,
  baselineConfig,
  onClose,
  onRollout
}: Props) {
  const [experiments, setExperiments] = useState<ExperimentRow[] | null>(null);
  const [sections, setSections] = useState<SectionRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [expRes, anRes] = await Promise.all([
        fetch(`/api/studio/experiments?pageId=${encodeURIComponent(pageId)}`),
        fetch(`/api/studio/analytics/page?pageId=${encodeURIComponent(pageId)}&window=30d`)
      ]);
      const expJson = (await expRes.json()) as
        | { ok: true; experiments: ExperimentRow[] }
        | { ok: false; error: string };
      const anJson = (await anRes.json()) as
        | { ok: true; sections: SectionRow[] }
        | { ok: false; error: string };
      if (!expJson.ok) throw new Error(expJson.error);
      if (!anJson.ok) throw new Error(anJson.error);
      setExperiments(expJson.experiments.filter((e) => e.instance_id === instanceId));
      setSections(anJson.sections.filter((s) => s.instance_id === instanceId));
    } catch (err) {
      setError((err as Error)?.message ?? "load-failed");
    }
  }, [pageId, instanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const running = experiments?.find((e) => e.status === "running") ?? null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="A/B test"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-neutral-200 p-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-widest"
            style={{ color: YELLOW }}
          >
            ◇ A/B test
          </p>
          <h2 className="mt-1 text-[18px] font-extrabold text-neutral-900">
            {running ? "Test running on this section" : "Start an A/B test"}
          </h2>
          <p className="mt-1 font-mono text-[11px] text-neutral-500">
            {instanceId}
          </p>
        </header>

        <div className="p-5">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-xl px-3 py-2 text-[12px] font-bold"
              style={{ background: "rgba(220,38,38,0.08)", color: RED }}
            >
              {error}
            </p>
          )}

          {!experiments && (
            <p className="text-[13px] font-bold text-neutral-500">Loading…</p>
          )}

          {experiments && !running && (
            <NewExperimentForm
              pageId={pageId}
              instanceId={instanceId}
              baselineConfig={baselineConfig}
              busy={busy}
              setBusy={setBusy}
              onCreated={() => void load()}
            />
          )}

          {running && (
            <RunningExperimentPanel
              exp={running}
              variantStats={sections ?? []}
              busy={busy}
              setBusy={setBusy}
              onRolledOut={(winner) => {
                onRollout?.(winner);
                void load();
              }}
              onStopped={() => void load()}
            />
          )}

          {experiments && experiments.some((e) => e.status !== "running") && (
            <PastExperiments experiments={experiments.filter((e) => e.status !== "running")} />
          )}
        </div>

        <footer className="flex items-center justify-end border-t border-neutral-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-100"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── New experiment form ────────────────────────────────────

function NewExperimentForm({
  pageId,
  instanceId,
  baselineConfig,
  busy,
  setBusy,
  onCreated
}: {
  pageId: string;
  instanceId: string;
  baselineConfig: Record<string, unknown>;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onCreated: () => void;
}) {
  // Editable copy fields — the most common variant axis for A/B tests.
  // Only edit these three; anything else is inherited from baseline.
  const editableKeys = ["headline", "subheadline", "primaryCtaLabel"] as const;
  const [name, setName] = useState("Untitled A/B test");
  const [splitA, setSplitA] = useState(50);
  const [overlay, setOverlay] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const k of editableKeys) {
      const v = baselineConfig[k];
      out[k] = typeof v === "string" ? v : "";
    }
    return out;
  });
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const variantBConfig: Record<string, unknown> = {};
      for (const k of editableKeys) {
        const nextVal = overlay[k];
        if (nextVal && nextVal !== baselineConfig[k]) variantBConfig[k] = nextVal;
      }
      if (Object.keys(variantBConfig).length === 0) {
        setErr("Change at least one field in Variant B before starting.");
        setBusy(false);
        return;
      }
      const res = await fetch("/api/studio/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          instanceId,
          name,
          variantAConfig: {},
          variantBConfig,
          splitA
        })
      });
      const json = (await res.json()) as
        | { ok: true }
        | { ok: false; error: string };
      if (!res.ok || !json.ok) {
        setErr("error" in json ? json.error : `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      onCreated();
    } catch (e) {
      setErr((e as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className="block">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Test name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-medium"
        />
      </label>

      <div className="mt-4">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Variant B overrides (Variant A = current)
        </p>
        <div className="mt-2 space-y-2">
          {(["headline", "subheadline", "primaryCtaLabel"] as const).map((k) => (
            <label key={k} className="block">
              <span className="font-mono text-[11px] text-neutral-500">{k}</span>
              <input
                type="text"
                value={overlay[k] ?? ""}
                onChange={(e) =>
                  setOverlay((prev) => ({ ...prev, [k]: e.target.value }))
                }
                placeholder={
                  typeof baselineConfig[k] === "string"
                    ? String(baselineConfig[k])
                    : "(not set)"
                }
                className="mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-[13px] font-medium"
              />
            </label>
          ))}
        </div>
      </div>

      <label className="mt-4 block">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Traffic split: {splitA}% A / {100 - splitA}% B
        </span>
        <input
          type="range"
          min={10}
          max={90}
          value={splitA}
          onChange={(e) => setSplitA(Number(e.target.value))}
          className="mt-2 w-full"
        />
      </label>

      {err && (
        <p
          role="alert"
          className="mt-3 rounded-xl px-3 py-2 text-[12px] font-bold"
          style={{ background: "rgba(220,38,38,0.08)", color: RED }}
        >
          {err}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={start}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
          style={{ background: GREEN }}
        >
          {busy ? "Starting…" : "Start test →"}
        </button>
      </div>
    </div>
  );
}

// ─── Running experiment panel ───────────────────────────────

function RunningExperimentPanel({
  exp,
  variantStats,
  busy,
  setBusy,
  onRolledOut,
  onStopped
}: {
  exp: ExperimentRow;
  variantStats: SectionRow[];
  busy: boolean;
  setBusy: (v: boolean) => void;
  onRolledOut: (winner: "A" | "B") => void;
  onStopped: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  // MVP: Aggregated totals only — a per-variant split needs the
  // analytics API to return bucket-aware rollups. For now show combined
  // section stats plus the config overlays so the merchant can eyeball
  // which variant they're testing.
  const total = variantStats[0] ?? {
    section_key: null,
    instance_id: null,
    views: 0,
    clicks: 0,
    converts: 0,
    ctr: 0,
    conversion_rate: 0
  };

  async function rollout(winner: "A" | "B") {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/studio/experiments/${exp.id}/rollout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winner })
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      onRolledOut(winner);
    } catch (e) {
      setErr((e as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/studio/experiments/${exp.id}/stop`, {
        method: "POST"
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErr(json.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      onStopped();
    } catch (e) {
      setErr((e as Error)?.message ?? "network");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        className="rounded-xl border p-3"
        style={{
          borderColor: "rgba(16,185,129,0.30)",
          background: "rgba(16,185,129,0.06)"
        }}
      >
        <p className="text-[13px] font-extrabold" style={{ color: GREEN }}>
          Live · {exp.name}
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-500">
          {exp.split_a}% A / {100 - exp.split_a}% B · started{" "}
          {new Date(exp.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <VariantCard
          label="Variant A (current)"
          overlay={exp.variant_a_config}
        />
        <VariantCard label="Variant B" overlay={exp.variant_b_config} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatBlock label="Views" value={total.views} colour={BLUE} />
        <StatBlock label="Clicks" value={total.clicks} colour={YELLOW} />
        <StatBlock label="CTR" value={`${total.ctr}%`} colour={GREEN} />
      </div>

      {err && (
        <p
          role="alert"
          className="mt-3 rounded-xl px-3 py-2 text-[12px] font-bold"
          style={{ background: "rgba(220,38,38,0.08)", color: RED }}
        >
          {err}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void rollout("A")}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
          style={{ background: "#0A0A0A" }}
        >
          Roll out A →
        </button>
        <button
          type="button"
          onClick={() => void rollout("B")}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest text-white transition disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:brightness-110"
          style={{ background: GREEN }}
        >
          Roll out B →
        </button>
        <button
          type="button"
          onClick={() => void stop()}
          disabled={busy}
          className="ml-auto inline-flex h-10 items-center rounded-xl border border-neutral-300 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Stop test
        </button>
      </div>
    </div>
  );
}

// ─── Small building blocks ─────────────────────────────────

function VariantCard({
  label,
  overlay
}: {
  label: string;
  overlay: Record<string, unknown>;
}) {
  const entries = Object.entries(overlay);
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      {entries.length === 0 ? (
        <p className="mt-1 text-[12px] italic text-neutral-500">
          (inherits from live)
        </p>
      ) : (
        <ul className="mt-1 space-y-1">
          {entries.map(([k, v]) => (
            <li key={k} className="text-[11px]">
              <span className="font-mono text-neutral-500">{k}:</span>{" "}
              <span className="font-bold text-neutral-900">
                {typeof v === "string" ? v : JSON.stringify(v)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatBlock({
  label,
  value,
  colour
}: {
  label: string;
  value: number | string;
  colour: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 text-center">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-[18px] font-extrabold" style={{ color: colour }}>
        {value}
      </p>
    </div>
  );
}

function PastExperiments({
  experiments
}: {
  experiments: ExperimentRow[];
}) {
  return (
    <div className="mt-6">
      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        Past tests on this section
      </p>
      <ul className="mt-2 space-y-1">
        {experiments.map((exp) => (
          <li
            key={exp.id}
            className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2"
          >
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
              {exp.status === "rolled_out"
                ? `Rolled out · ${exp.winner ?? "?"}`
                : "Stopped"}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-neutral-900">
              {exp.name}
            </span>
            <span className="shrink-0 text-[10px] text-neutral-400">
              {new Date(exp.created_at).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
