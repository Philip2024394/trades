// NEX Storage · Headquarters dashboard for the Infrastructure Runtime.
//
// One page to answer "where is our data · is it healthy · what changes if we
// swap adapters." Composes overview + collection + health APIs. Sensitive
// values are always masked · reveal only in dev mode with an explicit click.
//
// Route: /nex-app/nex-brain/nex-storage
// Doctrine: constitution_nex_backend_provider_agnostic_2026_08_07.md

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// ── Shape shared with /api/nex/storage/overview ──────────────────────
type EnvVar =
  | { name: string; purpose: string; secret: boolean; present: false }
  | { name: string; purpose: string; secret: false; present: true; value: string | null }
  | { name: string; purpose: string; secret: true; present: true; last4: string; length: number; masked: true };

type Adapter = { id: string; label: string; status: "supported" | "planned"; swappable: boolean; note?: string; active: boolean };
type ObjectStore = { id: string; label: string; status: "supported" | "planned"; note?: string };

type Overview = {
  ok: boolean;
  backend: { primary: string; secondary: string | null; mode: "dual-write" | "single-backend"; configured_via: string };
  postgres: null | {
    healthy: boolean;
    detail: string | null;
    version: string | null;
    host: string | null;
    port: number | null;
    database: string | null;
    latency_ms: number | null;
    extensions: string[];
    nex_table_count: number;
  };
  env: EnvVar[];
  adapters: Adapter[];
  object_stores: ObjectStore[];
  object_storage_state: { manifest_rows: number; total_bytes: number | null; latest_upload_at: string | null; buckets: number; error: string | null };
  schema: { init_files: string[]; bootstrap_files: string[] };
  node_env: string;
  dev_mode: boolean;
  generated_at: string;
};

type CentreResponse = {
  ok: boolean;
  totals: { collections_declared: number; collections_with_data: number; total_records: number; storage_used_bytes: number; storage_used_mb: number };
  per_collection: Array<{ collection: string; total_records: number; latest_write_at: string | null; size_bytes: number; error: string | null }>;
  largest_collection: { collection: string; records: number } | null;
};

type HealthResponse = { ok: boolean; backend: string; results: Array<{ step: string; ok: boolean; detail?: string }>; contract_version: number };

// ── Theme tokens ─────────────────────────────────────────────────────
const T = {
  bg:       "#0b0d10",
  panel:    "#12161c",
  panelHi:  "#1a2028",
  border:   "#232b36",
  text:     "#e5e9ef",
  textDim:  "#8892a0",
  textFade: "#5c6572",
  accent:   "#4dd0a0",
  warning:  "#f0b45a",
  danger:   "#f0665a",
  info:     "#5aa6f0",
  purple:   "#b48cf0",
};

// ── Small building blocks ────────────────────────────────────────────
function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-lg border p-4" style={{ background: T.panel, borderColor: T.border }}>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[11px] font-black uppercase tracking-widest" style={{ color: T.textDim }}>{title}</h2>
        {badge ? <span className="text-[9px] font-mono" style={{ color: T.textFade }}>{badge}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, tone = "neutral", hint }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "bad" | "unset"; hint?: string }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : T.text;
  return (
    <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[18px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>{hint}</div> : null}
    </div>
  );
}

function StatusDot({ ok, label }: { ok: boolean | null; label: string }) {
  const color = ok === null ? T.textFade : ok ? T.accent : T.danger;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function NexStoragePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [centre, setCentre] = useState<CentreResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthAt, setHealthAt] = useState<string | null>(null);
  const [healthRunning, setHealthRunning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  const loadAll = useCallback(async () => {
    try {
      const [o, c] = await Promise.all([
        fetch("/api/nex/storage/overview", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/nex/storage/centre", { cache: "no-store" }).then((r) => r.json()),
      ]);
      if (o.ok) setOverview(o);
      if (c.ok) setCentre(c);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch_failed");
    }
  }, []);

  const runHealth = useCallback(async () => {
    setHealthRunning(true);
    try {
      const res = await fetch("/api/nex/storage/health", { cache: "no-store" });
      const json = (await res.json()) as HealthResponse;
      setHealth(json);
      setHealthAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "health_failed");
    } finally {
      setHealthRunning(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
    const t = setInterval(loadAll, 15_000);
    return () => clearInterval(t);
  }, [loadAll]);

  const collectionCount = (name: string) =>
    centre?.per_collection.find((c) => c.collection === name)?.total_records ?? 0;

  return (
    <div className="min-h-screen p-4" style={{ background: T.bg, color: T.text, fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif" }}>
      {/* HEADER ─────────────────────────────────────────────── */}
      <div className="mb-5 flex items-baseline gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>NEX Headquarters</div>
          <h1 className="mt-0.5 text-[24px] font-black leading-none">NEX Storage</h1>
          <div className="mt-1 text-[11px]" style={{ color: T.textDim }}>
            Infrastructure Runtime dashboard · one place for storage · health · adapters · config
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Last update</div>
          <div className="font-mono text-[11px]" style={{ color: T.text }}>{lastUpdate || "—"}</div>
          {error ? <div className="text-[10px]" style={{ color: T.danger }}>Error: {error}</div> : null}
          <button
            type="button"
            onClick={loadAll}
            className="mt-1 rounded border px-2 py-1 text-[10px] font-semibold"
            style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
          >
            Refresh now
          </button>
        </div>
      </div>

      {!overview ? (
        <div className="rounded-lg border p-6 text-center text-[13px]" style={{ background: T.panel, borderColor: T.border, color: T.textFade }}>
          Loading storage state…
        </div>
      ) : (
        <>
          {/* 1 · STORAGE OVERVIEW ─────────────────────────────────── */}
          <Section title="Storage Overview">
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <Metric
                label="Backend"
                value={overview.backend.primary}
                tone="good"
                hint={overview.backend.mode === "dual-write" ? `→ ${overview.backend.secondary}` : "single-backend"}
              />
              <Metric
                label="Mode"
                value={overview.backend.mode}
                hint={`via ${overview.backend.configured_via}`}
              />
              <Metric
                label="Adapter health"
                value={overview.postgres ? (overview.postgres.healthy ? "healthy" : "unhealthy") : "n/a"}
                tone={overview.postgres ? (overview.postgres.healthy ? "good" : "bad") : "unset"}
                hint={overview.postgres?.detail ?? undefined}
              />
              <Metric
                label="Last check"
                value={new Date(overview.generated_at).toLocaleTimeString()}
                hint={overview.node_env}
              />
            </div>
          </Section>

          {/* 2 · DATABASE INFORMATION ─────────────────────────────── */}
          <Section title="Database Information" badge={overview.postgres ? "postgres adapter" : "no postgres adapter active"}>
            {overview.postgres ? (
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <Metric label="Database" value={overview.postgres.database ?? "—"} />
                <Metric label="Host" value={overview.postgres.host ?? "—"} />
                <Metric label="Port" value={overview.postgres.port ?? "—"} />
                <Metric label="Server version" value={overview.postgres.version?.split(" ")[1] ?? "—"} hint={overview.postgres.version ?? undefined} />
                <Metric label="Active adapter" value={overview.backend.primary} tone="good" />
                <Metric label="Connection" value={overview.postgres.healthy ? "connected" : "failed"} tone={overview.postgres.healthy ? "good" : "bad"} />
                <Metric label="Latency" value={`${overview.postgres.latency_ms ?? 0}ms`} tone={((overview.postgres.latency_ms ?? 0) < 100) ? "good" : "warn"} />
                <Metric label="nex.* tables" value={overview.postgres.nex_table_count} hint={`schema files: ${overview.schema.init_files.length} init + ${overview.schema.bootstrap_files.length} bootstrap`} />
              </div>
            ) : (
              <div className="text-[11px]" style={{ color: T.textFade }}>
                Postgres adapter is not active. Set <code>NEX_STORAGE_BACKEND=postgres</code> or <code>=dual-write</code> to see database details here.
              </div>
            )}
          </Section>

          {/* 3 · STORAGE STATISTICS ───────────────────────────────── */}
          <Section title="Storage Statistics" badge={centre ? `${centre.totals.collections_with_data}/${centre.totals.collections_declared} collections have data` : ""}>
            {centre ? (
              <>
                <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                  <Metric label="Total records" value={centre.totals.total_records.toLocaleString()} tone="good" />
                  <Metric label="Storage used" value={`${centre.totals.storage_used_mb} MB`} hint={`${centre.totals.storage_used_bytes.toLocaleString()} bytes`} />
                  <Metric label="Events" value={collectionCount("events").toLocaleString()} />
                  <Metric label="Brain memories" value={collectionCount("brain_memories").toLocaleString()} />
                  <Metric label="Jobs" value={collectionCount("jobs").toLocaleString()} />
                  <Metric label="Contacts" value={collectionCount("contacts").toLocaleString()} />
                  <Metric label="KPE chunks" value={collectionCount("kpe_chunks").toLocaleString()} />
                  <Metric label="Automation runs" value={collectionCount("automation_runs").toLocaleString()} />
                </div>
                <div className="text-[10px] italic" style={{ color: T.textFade }}>
                  For per-collection breakdown, latest write times, and dual-write parity, open the{" "}
                  <Link href="/nex-app/nex-brain/data-platform-centre" className="underline" style={{ color: T.info }}>Data Platform Centre</Link>.
                </div>
              </>
            ) : (
              <div className="text-[11px]" style={{ color: T.textFade }}>Loading collection stats…</div>
            )}
          </Section>

          {/* 4 · FILES & OBJECTS ──────────────────────────────────── */}
          <Section title="Files & Objects" badge="object_manifest collection">
            <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
              <Metric
                label="Tracked files"
                value={overview.object_storage_state.manifest_rows.toLocaleString()}
                hint={overview.object_storage_state.error ? "read failed" : undefined}
                tone={overview.object_storage_state.error ? "bad" : "neutral"}
              />
              <Metric label="Buckets" value={overview.object_storage_state.buckets} />
              <Metric
                label="Latest upload"
                value={overview.object_storage_state.latest_upload_at ? new Date(overview.object_storage_state.latest_upload_at).toLocaleString() : "—"}
                tone="unset"
              />
              <Metric label="Total bytes" value="—" tone="unset" hint="not instrumented — needs SUM(size_bytes)" />
            </div>
            <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
              <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Object storage providers</div>
              <div className="grid gap-2 text-[11px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {overview.object_stores.map((s) => (
                  <div key={s.id} className="flex items-baseline gap-2">
                    <span style={{ color: s.status === "supported" ? T.text : T.textFade }}>{s.label}</span>
                    <span className="ml-auto text-[9px] uppercase tracking-widest" style={{ color: s.status === "supported" ? T.accent : T.textFade }}>
                      {s.status}
                    </span>
                    {s.note ? <div className="basis-full text-[9.5px] italic" style={{ color: T.textFade }}>{s.note}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* 5 · CREDENTIALS & CONFIGURATION ──────────────────────── */}
          <Section title="Credentials & Configuration" badge={overview.dev_mode ? "dev mode · reveal available" : "production · reveal blocked"}>
            <div className="mb-2 text-[10.5px]" style={{ color: T.textDim }}>
              Secrets are never returned in cleartext by the API. When set, the last 4 characters are shown and only the length is revealed.
              {overview.dev_mode ? " In dev mode a per-row reveal control shows the last-4 tail; the API never sends the full secret." : ""}
            </div>
            <div className="space-y-1">
              {overview.env.map((e) => {
                const dev = overview.dev_mode;
                if (!e.present) {
                  return (
                    <div key={e.name} className="grid items-center gap-2 rounded-md border p-2 text-[11px]" style={{ background: T.panelHi, borderColor: T.border, gridTemplateColumns: "260px 90px 1fr" }}>
                      <code style={{ color: T.textDim }}>{e.name}</code>
                      <span className="text-[10px] uppercase tracking-widest" style={{ color: T.textFade }}>not set</span>
                      <span className="text-[10px] italic" style={{ color: T.textFade }}>{e.purpose}</span>
                    </div>
                  );
                }
                if (e.secret) {
                  const isRevealed = dev && reveal[e.name];
                  return (
                    <div key={e.name} className="grid items-center gap-2 rounded-md border p-2 text-[11px]" style={{ background: T.panelHi, borderColor: T.border, gridTemplateColumns: "260px 200px 1fr auto" }}>
                      <code style={{ color: T.text }}>{e.name}</code>
                      <span className="font-mono text-[10px]" style={{ color: T.warning }}>
                        {isRevealed ? `••••••••${e.last4} (${e.length} chars)` : `•••• (${e.length} chars)`}
                      </span>
                      <span className="text-[10px] italic" style={{ color: T.textFade }}>{e.purpose}</span>
                      {dev ? (
                        <button
                          type="button"
                          onClick={() => setReveal((r) => ({ ...r, [e.name]: !r[e.name] }))}
                          className="rounded border px-2 py-0.5 text-[9.5px] font-semibold"
                          style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
                        >
                          {isRevealed ? "Hide last 4" : "Reveal last 4"}
                        </button>
                      ) : (
                        <span className="text-[9px]" style={{ color: T.textFade }}>reveal disabled in prod</span>
                      )}
                    </div>
                  );
                }
                return (
                  <div key={e.name} className="grid items-center gap-2 rounded-md border p-2 text-[11px]" style={{ background: T.panelHi, borderColor: T.border, gridTemplateColumns: "260px 1fr 1fr" }}>
                    <code style={{ color: T.text }}>{e.name}</code>
                    <span className="font-mono text-[10.5px]" style={{ color: T.info }}>{e.value ?? "—"}</span>
                    <span className="text-[10px] italic" style={{ color: T.textFade }}>{e.purpose}</span>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 6 · STORAGE PROVIDERS ────────────────────────────────── */}
          <Section title="Storage Providers" badge={`current: ${overview.backend.primary}`}>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {overview.adapters.map((a) => (
                <div
                  key={a.id}
                  className="rounded-md border p-3"
                  style={{
                    background: a.active ? T.accent + "10" : T.panelHi,
                    borderColor: a.active ? T.accent : T.border,
                  }}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-[12px] font-black" style={{ color: a.active ? T.accent : T.text }}>{a.label}</span>
                    {a.active ? <span className="text-[9px] font-mono uppercase tracking-widest" style={{ color: T.accent }}>active</span> : null}
                    <span className="ml-auto text-[9px] uppercase tracking-widest" style={{ color: a.status === "supported" ? T.accent : T.textFade }}>
                      {a.status}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[9.5px]" style={{ color: T.textFade }}>id: {a.id}</div>
                  {a.note ? <div className="mt-1 text-[10px] italic" style={{ color: T.textDim }}>{a.note}</div> : null}
                </div>
              ))}
            </div>
          </Section>

          {/* 7 · HEALTH DASHBOARD ─────────────────────────────────── */}
          <Section title="Health Dashboard" badge={healthAt ? `checked at ${healthAt}` : "not yet checked this session"}>
            <div className="mb-3 flex flex-wrap gap-3">
              <StatusDot ok={overview.postgres?.healthy ?? null} label={`Postgres: ${overview.postgres?.healthy ? "healthy" : overview.postgres === null ? "not active" : "unhealthy"}`} />
              <StatusDot ok={overview.object_storage_state.error === null} label={`Object manifest: ${overview.object_storage_state.error ?? "readable"}`} />
              <StatusDot ok={health?.ok ?? null} label={`Abstraction self-test: ${health ? (health.ok ? "PASS" : "FAIL") : "not run yet"}`} />
              <StatusDot ok={null} label="Last backup: not instrumented" />
            </div>
            {health ? (
              <div className="mt-2 space-y-1">
                {health.results.map((r) => (
                  <div key={r.step} className="flex items-baseline gap-2 rounded border p-2 text-[10.5px]" style={{ background: T.panelHi, borderColor: T.border }}>
                    <span style={{ color: r.ok ? T.accent : T.danger }}>{r.ok ? "✓" : "✗"}</span>
                    <span className="font-mono" style={{ color: T.text }}>{r.step}</span>
                    {r.detail ? <span className="ml-auto font-mono text-[9.5px]" style={{ color: T.danger }}>{r.detail}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px]" style={{ color: T.textFade }}>Run the abstraction self-test from Developer Tools ↓ to fill this section.</div>
            )}
          </Section>

          {/* 8 · DEVELOPER TOOLS ──────────────────────────────────── */}
          <Section title="Developer Tools">
            <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <button
                type="button"
                onClick={runHealth}
                disabled={healthRunning}
                className="rounded-md border p-3 text-left transition-colors hover:opacity-80"
                style={{ background: T.panelHi, borderColor: T.accent, color: T.accent }}
              >
                <div className="text-[11px] font-black">{healthRunning ? "Running…" : "Run abstraction self-test"}</div>
                <div className="mt-1 text-[9.5px]" style={{ color: T.textDim }}>Exercises save · load · latestPerKey · query · count · stats on _storage_health</div>
              </button>
              <a
                href="/api/nex/storage/health"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border p-3 text-left transition-colors hover:opacity-80"
                style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
              >
                <div className="text-[11px] font-black">Health JSON (raw)</div>
                <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>Opens /api/nex/storage/health in new tab</div>
              </a>
              <a
                href="/api/nex/storage/parity"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border p-3 text-left transition-colors hover:opacity-80"
                style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
              >
                <div className="text-[11px] font-black">Parity JSON (raw)</div>
                <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>Primary vs. secondary comparison (dual-write only)</div>
              </a>
              <a
                href="/api/nex/storage/overview"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border p-3 text-left transition-colors hover:opacity-80"
                style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
              >
                <div className="text-[11px] font-black">Export diagnostics (JSON)</div>
                <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>Full overview payload — save as file when investigating</div>
              </a>
            </div>
            <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
              <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>CLI commands (run in trades/ directory)</div>
              <div className="space-y-1 font-mono text-[10.5px]" style={{ color: T.text }}>
                <div><span style={{ color: T.textFade }}>#</span> Bootstrap local Postgres roles (once)</div>
                <div style={{ color: T.accent }}>$ npm run nex:bootstrap-postgres</div>
                <div><span style={{ color: T.textFade }}>#</span> Apply canonical schema</div>
                <div style={{ color: T.accent }}>$ npm run nex:apply-storage-schema</div>
                <div><span style={{ color: T.textFade }}>#</span> Round-trip verification (jsonl · postgres · dual-write)</div>
                <div style={{ color: T.accent }}>$ npm run nex:verify-roundtrip</div>
                <div><span style={{ color: T.textFade }}>#</span> Dual-write parity check</div>
                <div style={{ color: T.accent }}>$ npm run nex:verify-parity</div>
              </div>
            </div>
            <div className="mt-3 rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
              <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Schema files on disk</div>
              <div className="grid gap-1 text-[10px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div>
                  <div className="mb-1 text-[9.5px] uppercase tracking-widest" style={{ color: T.info }}>bootstrap ({overview.schema.bootstrap_files.length})</div>
                  {overview.schema.bootstrap_files.map((f) => (<div key={f} className="font-mono" style={{ color: T.textDim }}>{f}</div>))}
                </div>
                <div>
                  <div className="mb-1 text-[9.5px] uppercase tracking-widest" style={{ color: T.accent }}>init ({overview.schema.init_files.length})</div>
                  {overview.schema.init_files.map((f) => (<div key={f} className="font-mono" style={{ color: T.textDim }}>{f}</div>))}
                </div>
              </div>
            </div>
          </Section>

          {/* FOOTER ─────────────────────────────────────────────── */}
          <div className="text-center text-[9px] italic" style={{ color: T.textFade }}>
            Auto-refreshes every 15 seconds · /api/nex/storage/overview + /api/nex/storage/centre · run health test manually to populate Section 7
          </div>
        </>
      )}
    </div>
  );
}
