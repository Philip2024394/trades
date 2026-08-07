// Communications Centre · NEX Email Mission Control panel.
//
// Single operational dashboard for every email-related surface — provider ·
// queue · delivery · compliance · audit · templates. Composes /api/nex/email/
// config + /api/nex/email/audit. Sections that need Phase 3+ data show
// honest "—" instead of fabricated numbers.
//
// Doctrine: constitution_nex_infrastructure_runtime_services_pattern_2026_08_07.md
//           constitution_nex_email_runtime_8_phase_roadmap_2026_08_07.md

"use client";

import { useCallback, useEffect, useState } from "react";
import { ImportWizard } from "./ImportWizard";

// ── API shapes ───────────────────────────────────────────────────────
type EnvVar =
  | { name: string; purpose: string; secret: boolean; present: false }
  | { name: string; purpose: string; secret: false; present: true; value: string | null }
  | { name: string; purpose: string; secret: true; present: true; last4: string; length: number; masked: true };

type Adapter = { id: string; label: string; status: "supported" | "planned"; active: boolean; note?: string };

type ConfigResponse = {
  ok: boolean;
  runtime: string;
  active_provider: string;
  active_capabilities: {
    supportsHtml: boolean; supportsText: boolean; supportsAttachments: boolean;
    supportsTemplating: boolean; supportsOpenTracking: boolean; supportsClickTracking: boolean;
  };
  adapters: Adapter[];
  health: { healthy: boolean; detail?: string; provider: string };
  queue: { sent: number; blocked: number; failed: number; in_flight: number; waiting: number };
  env: EnvVar[];
  dev_mode: boolean;
  generated_at: string;
};

type AuditEvent = {
  event_id?: string;
  event_type?: string;
  timestamp?: string;
  outcome?: string;
  payload?: {
    to_email?: string;
    kind?: "marketing" | "transactional";
    caller?: string;
    provider?: string;
    provider_message_id?: string;
    latency_ms?: number;
    reason?: string;
    detail?: string;
  };
};

type AuditResponse = {
  ok: boolean;
  window: { total_rows: number; oversample_scanned: number; since: string | null };
  today: { sent: number; blocked: number; failed: number };
  totals: { sent: number; blocked: number; failed: number };
  success_rate_pct: number | null;
  avg_latency_ms: number | null;
  kinds: { marketing: number; transactional: number };
  top_blocked_reasons: Array<{ key: string; count: number }>;
  top_failure_reasons: Array<{ key: string; count: number }>;
  top_callers: Array<{ key: string; count: number }>;
  top_providers: Array<{ key: string; count: number }>;
  last_sent: AuditEvent | null;
  last_failure: AuditEvent | null;
  recent: AuditEvent[];
};

type ConnectorEntry = {
  id: string;
  label: string;
  source_type: string;
  status: "supported" | "planned" | "disabled";
  mode: "pull" | "push" | "upload";
  description: string;
  built: boolean;
  scheduled: false | { cron: string };
  last_run: null | {
    timestamp?: string;
    outcome?: string;
    payload?: {
      records_processed?: number;
      new_contacts?: number;
      updated_contacts?: number;
      errors?: number;
      duration_ms?: number;
      triggered_by?: string;
      dry_run?: boolean;
    };
  };
  total_runs: number;
  total_records_processed: number;
};

type ConnectorsResponse = { ok: boolean; connectors: ConnectorEntry[] };

type ImportRun = {
  event_id: string | null;
  connector: string;
  file_name: string | null;
  admin_actor: string | null;
  triggered_by: string | null;
  dry_run: boolean;
  started_at: string | null;
  duration_ms: number;
  records_processed: number;
  created: number;
  updated: number;
  skipped_no_email: number;
  errors: number;
  duplicate_suggestions: number;
  outcome: string;
  error_samples: string[];
};

type ImportsResponse = { ok: boolean; total_returned: number; imports: ImportRun[] };

type ContactsOverview = {
  ok: boolean;
  health?: { healthy: boolean; detail: string };
  total_contacts?: number;
  by_source?: Array<{ source_type: string; count: number }>;
  by_country?: Array<{ country: string; count: number }>;
  by_lifecycle?: Array<{ lifecycle_stage: string; count: number }>;
  by_consent?: {
    marketing_yes: number; marketing_no: number; marketing_unknown: number;
    transactional_yes: number; transactional_no: number; transactional_unknown: number;
    never_contact: number; unsubscribed: number;
  };
  top_tags?: Array<{ tag: string; count: number }>;
  duplicates_pending?: number;
  merges_all_time?: number;
  recently_added?: Array<{ contact_id: string; name: string | null; email: string | null; source: string | null; first_seen_at: string | null }>;
  recently_contacted?: Array<{ contact_id: string; name: string | null; email: string | null; last_contacted_at: string | null }>;
  growth?: Array<{ day: string; added: number }>;
  reason?: string;
};

// ── Theme (dark · matches NexStoragePanel · shared Runtime aesthetic) ───
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

// ── Building blocks ──────────────────────────────────────────────────
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

function HonestEmpty({ title, body, phase }: { title: string; body: string; phase?: string }) {
  return (
    <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="flex items-baseline gap-2">
        <div className="text-[11px] font-black" style={{ color: T.warning }}>{title}</div>
        {phase ? <span className="ml-auto text-[9px] font-mono uppercase tracking-widest" style={{ color: T.textFade }}>{phase}</span> : null}
      </div>
      <div className="mt-1 text-[10.5px]" style={{ color: T.textDim }}>{body}</div>
    </div>
  );
}

function relTime(iso?: string | null): string {
  if (!iso) return "—";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const s = Math.round((now - then) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

// Group transactional callers into families (best-effort · from event caller prefix)
function transactionalFamilies(top: Array<{ key: string; count: number }>): Array<{ family: string; count: number; callers: string[] }> {
  const families: Record<string, { count: number; callers: Set<string> }> = {};
  const bucket = (caller: string): string => {
    if (/receipt|order|payment/i.test(caller))          return "Receipts";
    if (/invite|invitation/i.test(caller))              return "Invitations";
    if (/verify|verification|magic|session/i.test(caller)) return "Verification / Magic Links";
    if (/reset|password/i.test(caller))                 return "Password Resets";
    if (/notif|notify/i.test(caller))                    return "Notifications";
    if (/quote|review|referral|affiliate/i.test(caller)) return "Workflow (quotes · reviews · referrals)";
    if (/contact|form/i.test(caller))                    return "Contact form";
    return "Other";
  };
  for (const row of top) {
    const family = bucket(row.key);
    if (!families[family]) families[family] = { count: 0, callers: new Set() };
    families[family].count += row.count;
    families[family].callers.add(row.key);
  }
  return Object.entries(families)
    .map(([family, { count, callers }]) => ({ family, count, callers: Array.from(callers) }))
    .sort((a, b) => b.count - a.count);
}

// ── Panel ────────────────────────────────────────────────────────────
export function CommunicationsCentrePanel() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [contacts, setContacts] = useState<ContactsOverview | null>(null);
  const [connectors, setConnectors] = useState<ConnectorsResponse | null>(null);
  const [imports, setImports] = useState<ImportsResponse | null>(null);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [wizardOpen, setWizardOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, a, k, cn, im] = await Promise.all([
        fetch("/api/nex/email/config", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/nex/email/audit", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/nex/contacts/overview", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ ok: false, reason: "fetch_failed" })),
        fetch("/api/nex/contacts/connectors", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ ok: false, connectors: [] })),
        fetch("/api/nex/contacts/imports?limit=25", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ ok: false, imports: [] })),
      ]);
      if (c.ok) setConfig(c);
      if (a.ok) setAudit(a);
      setContacts(k);
      setConnectors(cn);
      setImports(im);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "fetch_failed");
    }
  }, []);

  const syncConnector = useCallback(async (id: string, opts: { dry_run?: boolean } = {}) => {
    setSyncing((s) => ({ ...s, [id]: true }));
    try {
      await fetch(`/api/nex/contacts/connectors/${id}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ triggered_by: "manual", ...opts }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "sync_failed");
    } finally {
      setSyncing((s) => ({ ...s, [id]: false }));
    }
  }, [load]);


  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="rounded-xl p-4" style={{ background: T.bg, color: T.text, fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif" }}>
      {/* HEADER */}
      <div className="mb-5 flex items-baseline gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>NEX Headquarters · Growth Floor</div>
          <h1 className="mt-0.5 text-[24px] font-black leading-none">Communications Centre</h1>
          <div className="mt-1 text-[11px]" style={{ color: T.textDim }}>
            Mission Control for the NEX Email Runtime · providers · queue · compliance · audit
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Last update</div>
          <div className="font-mono text-[11px]" style={{ color: T.text }}>{lastUpdate || "—"}</div>
          {error ? <div className="text-[10px]" style={{ color: T.danger }}>Error: {error}</div> : null}
          <button
            type="button"
            onClick={load}
            className="mt-1 rounded border px-2 py-1 text-[10px] font-semibold"
            style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
          >
            Refresh now
          </button>
        </div>
      </div>

      {!config ? (
        <div className="rounded-lg border p-6 text-center text-[13px]" style={{ background: T.panel, borderColor: T.border, color: T.textFade }}>
          Loading Runtime state…
        </div>
      ) : (
        <>
          {/* 1 · OVERVIEW ─────────────────────────────────────────── */}
          <Section title="Overview" badge="live · from /api/nex/email/config + /audit">
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <Metric label="Provider" value={config.active_provider} tone="good" />
              <Metric label="Health" value={config.health.healthy ? "healthy" : "unhealthy"} tone={config.health.healthy ? "good" : "bad"} hint={config.health.detail} />
              <Metric label="Queue in-flight" value={config.queue.in_flight} tone={config.queue.in_flight > 0 ? "warn" : "neutral"} hint={`${config.queue.waiting} waiting`} />
              <Metric label="Emails today" value={audit?.today.sent ?? "—"} tone={audit && audit.today.sent > 0 ? "good" : "unset"} hint={audit ? `${audit.today.blocked} blocked · ${audit.today.failed} failed` : ""} />
              <Metric label="Success rate" value={audit?.success_rate_pct === null || audit?.success_rate_pct === undefined ? "—" : `${audit.success_rate_pct}%`} tone={audit && audit.success_rate_pct !== null && audit.success_rate_pct >= 95 ? "good" : audit && audit.success_rate_pct !== null && audit.success_rate_pct < 80 ? "bad" : "neutral"} hint={audit ? `${audit.totals.sent + audit.totals.failed} attempts` : ""} />
              <Metric label="Avg latency" value={audit?.avg_latency_ms ? `${audit.avg_latency_ms}ms` : "—"} tone={audit && audit.avg_latency_ms && audit.avg_latency_ms < 500 ? "good" : "neutral"} />
              <Metric label="Last send" value={relTime(audit?.last_sent?.timestamp)} tone={audit?.last_sent ? "neutral" : "unset"} hint={audit?.last_sent?.payload?.provider} />
              <Metric label="Last failure" value={relTime(audit?.last_failure?.timestamp)} tone={audit?.last_failure ? "warn" : "unset"} hint={audit?.last_failure?.payload?.reason?.slice(0, 40)} />
            </div>
          </Section>

          {/* 2 · CONTACTS ────────────────────────────────────────── */}
          <Section title="Contacts" badge={contacts?.ok ? `live · registry v1 · from /api/nex/contacts/overview` : contacts?.reason === "registry not reachable · aggregates unavailable" ? "registry unreachable" : "loading"}>
            {contacts && contacts.ok ? (
              <>
                <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                  <Metric label="Total contacts" value={contacts.total_contacts?.toLocaleString() ?? "0"} tone={contacts.total_contacts ? "good" : "unset"} hint="canonical rows · deleted excluded" />
                  <Metric label="Trades (source)" value={contacts.by_source?.find((s) => s.source_type === "trades")?.count ?? 0} tone="neutral" />
                  <Metric label="Newsletter (source)" value={contacts.by_source?.find((s) => s.source_type === "newsletter")?.count ?? 0} tone="neutral" />
                  <Metric label="Form (source)" value={contacts.by_source?.find((s) => s.source_type === "form")?.count ?? 0} tone="neutral" />
                  <Metric label="Manual (source)" value={contacts.by_source?.find((s) => s.source_type === "manual")?.count ?? 0} tone="neutral" />
                  <Metric label="Countries" value={contacts.by_country?.length ?? 0} tone="neutral" hint={contacts.by_country && contacts.by_country.length > 0 ? contacts.by_country.slice(0, 3).map((c) => `${c.country} (${c.count})`).join(" · ") : undefined} />
                  <Metric label="Duplicates pending" value={contacts.duplicates_pending ?? 0} tone={(contacts.duplicates_pending ?? 0) > 0 ? "warn" : "neutral"} />
                  <Metric label="Merges (all-time)" value={contacts.merges_all_time ?? 0} tone="neutral" />
                </div>

                {contacts.by_consent ? (
                  <div className="mb-3 rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
                    <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Consent overview</div>
                    <div className="grid grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Marketing</div>
                        <div className="mt-1 font-mono">
                          <span style={{ color: T.accent }}>{contacts.by_consent.marketing_yes}</span>
                          <span style={{ color: T.textFade }}> / </span>
                          <span style={{ color: T.danger }}>{contacts.by_consent.marketing_no}</span>
                          <span style={{ color: T.textFade }}> / </span>
                          <span style={{ color: T.textFade }}>{contacts.by_consent.marketing_unknown}</span>
                        </div>
                        <div className="text-[9px]" style={{ color: T.textFade }}>yes / no / unknown</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Transactional</div>
                        <div className="mt-1 font-mono">
                          <span style={{ color: T.accent }}>{contacts.by_consent.transactional_yes}</span>
                          <span style={{ color: T.textFade }}> / </span>
                          <span style={{ color: T.danger }}>{contacts.by_consent.transactional_no}</span>
                          <span style={{ color: T.textFade }}> / </span>
                          <span style={{ color: T.textFade }}>{contacts.by_consent.transactional_unknown}</span>
                        </div>
                        <div className="text-[9px]" style={{ color: T.textFade }}>yes / no / unknown</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Never-contact</div>
                        <div className="mt-1 font-mono text-[14px]" style={{ color: (contacts.by_consent.never_contact ?? 0) > 0 ? T.warning : T.text }}>{contacts.by_consent.never_contact}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Unsubscribed</div>
                        <div className="mt-1 font-mono text-[14px]" style={{ color: (contacts.by_consent.unsubscribed ?? 0) > 0 ? T.warning : T.text }}>{contacts.by_consent.unsubscribed}</div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {contacts.top_tags && contacts.top_tags.length > 0 ? (
                  <div className="mb-3 rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
                    <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Top tags</div>
                    <div className="flex flex-wrap gap-1">
                      {contacts.top_tags.map((t) => (
                        <span key={t.tag} className="rounded-full border px-2 py-0.5 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.text }}>
                          {t.tag} <span style={{ color: T.textFade }}>· {t.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {contacts.recently_added && contacts.recently_added.length > 0 ? (
                  <div className="mb-3 rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
                    <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Recently added</div>
                    <div className="space-y-1">
                      {contacts.recently_added.slice(0, 5).map((c) => (
                        <div key={c.contact_id} className="grid items-center gap-2 rounded border p-2 text-[10.5px]" style={{ background: T.panel, borderColor: T.border, gridTemplateColumns: "180px 220px 100px 1fr" }}>
                          <span style={{ color: T.text }}>{c.name ?? "—"}</span>
                          <span className="font-mono" style={{ color: T.info }}>{c.email ?? "—"}</span>
                          <span className="text-[9.5px] uppercase tracking-widest" style={{ color: T.accent }}>{c.source ?? "—"}</span>
                          <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{c.first_seen_at ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="text-[10px] italic" style={{ color: T.textFade }}>
                  Registry health: <span style={{ color: contacts.health?.healthy ? T.accent : T.danger }}>{contacts.health?.healthy ? "healthy" : "unhealthy"}</span> · {contacts.health?.detail} · Contact explorer + merge UI arrive in Phase 3c · source importers (trades · newsletter · CRM · form · CSV) in Phase 3b.
                </div>
              </>
            ) : contacts && !contacts.ok ? (
              <HonestEmpty
                phase="Registry not reachable"
                title="Contact Registry not responding"
                body={`Reason: ${contacts.reason ?? "unknown"}. Ensure NEX_POSTGRES_URL is set and the schema is applied (npm run nex:apply-storage-schema).`}
              />
            ) : (
              <div className="text-[11px]" style={{ color: T.textFade }}>Loading contact registry state…</div>
            )}
          </Section>

          {/* 2b · CONNECTORS ───────────────────────────────────── */}
          <Section title="Connectors" badge={connectors ? `${connectors.connectors.filter((c) => c.built).length} built · ${connectors.connectors.filter((c) => !c.built).length} planned` : ""}>
            <div className="mb-2 text-[10.5px]" style={{ color: T.textDim }}>
              Every source is a long-lived sync surface · never a one-time import. Each connector calls only <code>upsertContact()</code>. Registry remains the single authority.
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {connectors?.connectors.map((c) => {
                const last = c.last_run;
                const isSyncing = !!syncing[c.id];
                const outcomeTone = last?.outcome === "ok" ? T.accent : last?.outcome === "partial" ? T.warning : last?.outcome === "failed" ? T.danger : T.textFade;
                return (
                  <div
                    key={c.id}
                    className="rounded-md border p-3"
                    style={{
                      background: c.built ? T.panelHi : T.panel,
                      borderColor: c.built ? T.border : T.border,
                    }}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] font-black" style={{ color: c.built ? T.text : T.textFade }}>{c.label}</span>
                      <span className="ml-auto text-[9px] uppercase tracking-widest" style={{ color: c.built ? T.accent : T.textFade }}>{c.status}</span>
                    </div>
                    <div className="mt-1 font-mono text-[9.5px]" style={{ color: T.textFade }}>id: {c.id} · source_type: {c.source_type}</div>
                    <div className="mt-1 text-[10px] italic" style={{ color: T.textDim }}>{c.description}</div>

                    {c.built ? (
                      <div className="mt-2 space-y-1 text-[10.5px]">
                        <div className="flex justify-between" style={{ color: T.textDim }}>
                          <span>{c.mode === "push" ? "Last received" : "Last sync"}</span>
                          <span className="font-mono" style={{ color: outcomeTone }}>
                            {last ? `${last.outcome ?? "—"} · ${relTime(last.timestamp)}` : "never"}
                          </span>
                        </div>
                        <div className="flex justify-between" style={{ color: T.textDim }}>
                          <span>{c.mode === "push" ? "Records received (last event)" : "Records processed"}</span>
                          <span className="font-mono" style={{ color: T.text }}>{last?.payload?.records_processed ?? 0}</span>
                        </div>
                        <div className="flex justify-between" style={{ color: T.textDim }}>
                          <span>New / updated</span>
                          <span className="font-mono">
                            <span style={{ color: T.accent }}>{last?.payload?.new_contacts ?? 0}</span>
                            <span style={{ color: T.textFade }}> / </span>
                            <span style={{ color: T.info }}>{last?.payload?.updated_contacts ?? 0}</span>
                          </span>
                        </div>
                        <div className="flex justify-between" style={{ color: T.textDim }}>
                          <span>Errors</span>
                          <span className="font-mono" style={{ color: (last?.payload?.errors ?? 0) > 0 ? T.danger : T.text }}>{last?.payload?.errors ?? 0}</span>
                        </div>
                        <div className="flex justify-between" style={{ color: T.textDim }}>
                          <span>{c.mode === "push" ? "Events received (all-time)" : "Total runs (all-time)"}</span>
                          <span className="font-mono" style={{ color: T.text }}>{c.total_runs}</span>
                        </div>
                        <div className="flex justify-between" style={{ color: T.textDim }}>
                          <span>Mode</span>
                          <span className="font-mono uppercase tracking-widest" style={{ color: c.mode === "push" ? T.purple : T.info }}>{c.mode}</span>
                        </div>
                        {c.mode === "pull" ? (
                          <div className="mt-2 flex gap-1">
                            <button
                              type="button"
                              onClick={() => syncConnector(c.id, { dry_run: true })}
                              disabled={isSyncing}
                              className="flex-1 rounded border px-2 py-1 text-[10px] font-semibold disabled:opacity-50"
                              style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
                            >
                              Dry-run
                            </button>
                            <button
                              type="button"
                              onClick={() => syncConnector(c.id)}
                              disabled={isSyncing}
                              className="flex-1 rounded border px-2 py-1 text-[10px] font-semibold disabled:opacity-50"
                              style={{ background: T.panel, borderColor: T.accent, color: T.accent }}
                            >
                              {isSyncing ? "Syncing…" : "Sync now"}
                            </button>
                          </div>
                        ) : c.mode === "upload" ? (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => setWizardOpen(true)}
                              className="w-full rounded border px-2 py-1.5 text-[10px] font-semibold"
                              style={{ background: T.panel, borderColor: T.accent, color: T.accent }}
                            >
                              Open Import Wizard
                            </button>
                            <div className="mt-1 text-[9px] italic" style={{ color: T.textFade }}>
                              4-step flow · Upload → Mapping → Dry-run → Report · preview + duplicate detection + compliance warnings before any write
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 rounded border px-2 py-1.5 text-center text-[10px]" style={{ background: T.panel, borderColor: T.purple, color: T.purple }}>
                            <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: T.purple }} />
                            Listening · event-driven
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-[10px]" style={{ color: T.textFade }}>Planned · not yet built · mode: {c.mode}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* 2c · IMPORT HISTORY ───────────────────────────────── */}
          <Section title="Imports" badge={imports ? `last ${imports.total_returned} runs across all connectors` : ""}>
            <div className="mb-2 text-[10.5px]" style={{ color: T.textDim }}>
              Every connector run (pull · push · upload) writes an audit event · this section is the flight recorder. Wizard v1 will add richer per-file drill-downs, duplicate previews, and mapping saved-state.
            </div>
            {imports && imports.imports.length > 0 ? (
              <div className="space-y-1">
                <div className="grid gap-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade, gridTemplateColumns: "120px 100px 90px 60px 60px 60px 60px 60px 1fr" }}>
                  <div>Connector</div>
                  <div>File / label</div>
                  <div>Started</div>
                  <div>Duration</div>
                  <div>Records</div>
                  <div>Created</div>
                  <div>Updated</div>
                  <div>Errors</div>
                  <div>Actor</div>
                </div>
                {imports.imports.map((r) => (
                  <div
                    key={r.event_id ?? `${r.connector}-${r.started_at}`}
                    className="grid gap-2 rounded border p-2 text-[10.5px]"
                    style={{ background: T.panelHi, borderColor: T.border, gridTemplateColumns: "120px 100px 90px 60px 60px 60px 60px 60px 1fr" }}
                  >
                    <div className="font-mono" style={{ color: T.text }}>{r.connector}{r.dry_run ? " (dry)" : ""}</div>
                    <div className="truncate font-mono text-[9.5px]" style={{ color: T.textDim }} title={r.file_name ?? ""}>{r.file_name ?? "—"}</div>
                    <div className="font-mono" style={{ color: T.textFade }}>{relTime(r.started_at)}</div>
                    <div className="font-mono text-right" style={{ color: T.textDim }}>{r.duration_ms}ms</div>
                    <div className="font-mono text-right" style={{ color: T.text }}>{r.records_processed}</div>
                    <div className="font-mono text-right" style={{ color: T.accent }}>{r.created}</div>
                    <div className="font-mono text-right" style={{ color: T.info }}>{r.updated}</div>
                    <div className="font-mono text-right" style={{ color: r.errors > 0 ? T.danger : T.textFade }}>{r.errors}</div>
                    <div className="truncate font-mono text-[9.5px]" style={{ color: r.outcome === "ok" ? T.accent : r.outcome === "partial" ? T.warning : T.danger }} title={r.error_samples.join(" · ")}>
                      {r.outcome} · {r.admin_actor ?? r.triggered_by ?? "—"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px]" style={{ color: T.textFade }}>
                No imports yet · run any connector (Trades · Newsletter · fs-store · Contact Form · Manual · CSV Upload) to populate this history.
              </div>
            )}
          </Section>

          {/* 3 · MARKETING ──────────────────────────────────────── */}
          <Section title="Marketing" badge="awaiting Phase 4 · Campaign Builder">
            <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <Metric label="Marketing sent (all-time)" value={audit?.kinds.marketing ?? "—"} tone={audit?.kinds.marketing ? "neutral" : "unset"} />
              <Metric label="Active campaigns" value="—" tone="unset" />
              <Metric label="Recipient lists" value="—" tone="unset" />
              <Metric label="Drafts" value="—" tone="unset" />
              <Metric label="Scheduled" value="—" tone="unset" />
            </div>
            <HonestEmpty
              phase="Phase 4"
              title="Campaign builder not yet built"
              body="Phase 4 delivers: recipient selection (filter by country / trade / tag / consent), save recipient groups, preview recipients before sending, campaign lifecycle (draft → scheduled → sending → completed)."
            />
          </Section>

          {/* 4 · TRANSACTIONAL ─────────────────────────────────── */}
          <Section title="Transactional" badge={audit ? `live · from audit callers · ${audit.kinds.transactional} sent all-time` : ""}>
            {audit && audit.top_callers.length > 0 ? (
              <div className="space-y-1">
                {transactionalFamilies(audit.top_callers).map((f) => (
                  <div key={f.family} className="grid items-center gap-2 rounded-md border p-2 text-[11px]" style={{ background: T.panelHi, borderColor: T.border, gridTemplateColumns: "220px 80px 1fr" }}>
                    <span className="font-semibold" style={{ color: T.text }}>{f.family}</span>
                    <span className="font-mono" style={{ color: T.accent }}>{f.count.toLocaleString()}</span>
                    <span className="text-[9.5px] font-mono" style={{ color: T.textFade }}>{f.callers.join(" · ")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px]" style={{ color: T.textFade }}>No transactional sends recorded yet — categories will populate as callers use the Runtime.</div>
            )}
          </Section>

          {/* 5 · QUEUE ─────────────────────────────────────────── */}
          <Section title="Queue" badge="live · from Runtime queue">
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
              <Metric label="Waiting" value={config.queue.waiting} tone={config.queue.waiting > 0 ? "warn" : "neutral"} />
              <Metric label="Sending" value={config.queue.in_flight} tone={config.queue.in_flight > 0 ? "warn" : "neutral"} />
              <Metric label="Retrying" value="—" tone="unset" hint="not yet surfaced" />
              <Metric label="Failed (all-time)" value={config.queue.failed} tone={config.queue.failed > 0 ? "bad" : "neutral"} />
              <Metric label="Completed (all-time)" value={config.queue.sent} tone="good" />
            </div>
            <div className="mt-2 text-[9.5px] italic" style={{ color: T.textFade }}>
              Queue is in-memory (per-process) in Phase 1. Persistent queue backed by nex.jobs lands in Phase 6 · Delivery Engine.
            </div>
          </Section>

          {/* 6 · PROVIDER ──────────────────────────────────────── */}
          <Section title="Provider" badge={`active: ${config.active_provider}`}>
            <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <Metric label="Active adapter" value={config.active_provider} tone="good" />
              <Metric label="Health" value={config.health.healthy ? "healthy" : "unhealthy"} tone={config.health.healthy ? "good" : "bad"} hint={config.health.detail?.slice(0, 60)} />
              <Metric label="Avg latency" value={audit?.avg_latency_ms ? `${audit.avg_latency_ms}ms` : "—"} tone={audit && audit.avg_latency_ms && audit.avg_latency_ms < 500 ? "good" : "neutral"} />
              <Metric label="Sends via this provider" value={audit?.top_providers.find((p) => p.key === config.active_provider)?.count ?? 0} />
            </div>
            <div className="mb-3 rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
              <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Capabilities</div>
              <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-3">
                <StatusDot ok={config.active_capabilities.supportsHtml} label="HTML body" />
                <StatusDot ok={config.active_capabilities.supportsText} label="Plain text body" />
                <StatusDot ok={config.active_capabilities.supportsAttachments} label="Attachments" />
                <StatusDot ok={config.active_capabilities.supportsTemplating} label="Provider templates" />
                <StatusDot ok={config.active_capabilities.supportsOpenTracking} label="Open tracking" />
                <StatusDot ok={config.active_capabilities.supportsClickTracking} label="Click tracking" />
              </div>
            </div>
            <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
              <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Environment configuration</div>
              <div className="space-y-1">
                {config.env.map((e) => {
                  if (!e.present) {
                    return (
                      <div key={e.name} className="grid items-center gap-2 rounded-md border p-2 text-[11px]" style={{ background: T.panel, borderColor: T.border, gridTemplateColumns: "240px 90px 1fr" }}>
                        <code style={{ color: T.textDim }}>{e.name}</code>
                        <span className="text-[10px] uppercase tracking-widest" style={{ color: T.textFade }}>not set</span>
                        <span className="text-[10px] italic" style={{ color: T.textFade }}>{e.purpose}</span>
                      </div>
                    );
                  }
                  if (e.secret) {
                    return (
                      <div key={e.name} className="grid items-center gap-2 rounded-md border p-2 text-[11px]" style={{ background: T.panel, borderColor: T.border, gridTemplateColumns: "240px 200px 1fr" }}>
                        <code style={{ color: T.text }}>{e.name}</code>
                        <span className="font-mono text-[10px]" style={{ color: T.warning }}>•••• ({e.length} chars)</span>
                        <span className="text-[10px] italic" style={{ color: T.textFade }}>{e.purpose}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={e.name} className="grid items-center gap-2 rounded-md border p-2 text-[11px]" style={{ background: T.panel, borderColor: T.border, gridTemplateColumns: "240px 1fr 1fr" }}>
                      <code style={{ color: T.text }}>{e.name}</code>
                      <span className="font-mono text-[10.5px]" style={{ color: T.info }}>{e.value ?? "—"}</span>
                      <span className="text-[10px] italic" style={{ color: T.textFade }}>{e.purpose}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* 7 · COMPLIANCE ────────────────────────────────────── */}
          <Section title="Compliance" badge="live · from audit blocked-events">
            <div className="mb-3 text-[10.5px]" style={{ color: T.textDim }}>
              Every send passes through the Runtime compliance gate. Blocks are recorded to <code>nex.events</code> with the reason.
              Legal floors: UK PECR · GDPR · Australian Spam Act · Canadian CASL · US CAN-SPAM.
            </div>
            <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <Metric
                label="Blocked · marketing consent"
                value={audit?.top_blocked_reasons.find((r) => r.key === "no_marketing_consent")?.count ?? 0}
                tone="warn"
              />
              <Metric
                label="Blocked · transactional consent"
                value={audit?.top_blocked_reasons.find((r) => r.key === "no_transactional_consent")?.count ?? 0}
                tone="warn"
              />
              <Metric
                label="Blocked · never-contact"
                value={audit?.top_blocked_reasons.find((r) => r.key === "never_contact")?.count ?? 0}
                tone="warn"
              />
              <Metric
                label="Blocked · unsubscribed"
                value={audit?.top_blocked_reasons.find((r) => r.key === "unsubscribed")?.count ?? 0}
                tone="warn"
              />
              <Metric
                label="Blocked · invalid email"
                value={audit?.top_blocked_reasons.find((r) => r.key === "invalid_email")?.count ?? 0}
                tone="bad"
              />
            </div>
            <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
              <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Country compliance summary</div>
              <div className="text-[10.5px]" style={{ color: T.textFade }}>Awaiting per-recipient country tagging (Phase 3 unified contact model).</div>
            </div>
          </Section>

          {/* 8 · AUDIT ─────────────────────────────────────────── */}
          <Section title="Audit" badge={audit ? `${audit.recent.length} recent · window scanned ${audit.window.oversample_scanned}` : ""}>
            {audit && audit.recent.length > 0 ? (
              <div className="space-y-1">
                {audit.recent.slice(0, 20).map((e) => {
                  const isFailed = e.event_type === "email.failed";
                  const isBlocked = e.event_type === "email.blocked";
                  const color = isFailed ? T.danger : isBlocked ? T.warning : T.accent;
                  const symbol = isFailed ? "✗" : isBlocked ? "⊘" : "✓";
                  return (
                    <div key={e.event_id} className="grid items-center gap-2 rounded border p-2 text-[10.5px]" style={{ background: T.panelHi, borderColor: T.border, gridTemplateColumns: "16px 90px 220px 100px 1fr" }}>
                      <span style={{ color }}>{symbol}</span>
                      <span className="font-mono" style={{ color: T.textFade }}>{relTime(e.timestamp)}</span>
                      <span className="font-mono truncate" style={{ color: T.text }}>{e.payload?.to_email ?? "—"}</span>
                      <span className="text-[9.5px] uppercase tracking-widest" style={{ color: e.payload?.kind === "marketing" ? T.purple : T.info }}>{e.payload?.kind ?? "—"}</span>
                      <span className="text-[10px] truncate" style={{ color: isFailed || isBlocked ? T.danger : T.textDim }}>
                        {isFailed || isBlocked ? (e.payload?.reason ?? e.payload?.detail ?? "unknown") : (e.payload?.caller ?? "—")}
                      </span>
                    </div>
                  );
                })}
                <div className="mt-2 text-[9.5px] italic" style={{ color: T.textFade }}>
                  Search + filter UI coming in Phase 7. Direct API access today: <a href="/api/nex/email/audit" target="_blank" rel="noreferrer" className="underline" style={{ color: T.info }}>/api/nex/email/audit</a> · supports ?kind=marketing · ?caller=orders · ?event=email.blocked · ?since=&lt;iso&gt;
                </div>
              </div>
            ) : (
              <div className="text-[11px]" style={{ color: T.textFade }}>
                No email events recorded yet. Every send through <code>sendEmail(...)</code> writes one row to <code>nex.events</code>. Events surface here as soon as sends happen.
              </div>
            )}
          </Section>

          {/* 9 · TEMPLATES ─────────────────────────────────────── */}
          <Section title="Templates" badge="awaiting Phase 5 · Compose">
            <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <Metric label="Installed" value="—" tone="unset" />
              <Metric label="With variables" value="—" tone="unset" />
              <Metric label="Preview count" value="—" tone="unset" />
              <Metric label="Latest version" value="—" tone="unset" />
            </div>
            <HonestEmpty
              phase="Phase 5"
              title="Template system not yet built"
              body="Phase 5 delivers: rich text · HTML · templates with variables · attachments · scheduling · preview · test-send. Templates will live under NEX-side management, provider-side template APIs are not used (adapter isolation)."
            />
          </Section>

          {/* 10 · FUTURE PROVIDERS ─────────────────────────────── */}
          <Section title="Available adapters" badge={`${config.adapters.filter((a) => a.status === "supported").length} supported · ${config.adapters.filter((a) => a.status === "planned").length} planned`}>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {config.adapters.map((a) => (
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
                    <span className="ml-auto text-[9px] uppercase tracking-widest" style={{ color: a.status === "supported" ? T.accent : T.textFade }}>{a.status}</span>
                  </div>
                  <div className="mt-1 font-mono text-[9.5px]" style={{ color: T.textFade }}>id: {a.id}</div>
                  {a.note ? <div className="mt-1 text-[10px] italic" style={{ color: T.textDim }}>{a.note}</div> : null}
                </div>
              ))}
            </div>
            <div className="mt-2 text-[9.5px] italic" style={{ color: T.textFade }}>
              Switching provider: set <code>NEX_EMAIL_PROVIDER</code> in <code>.env.local</code> and restart. No application code changes required.
            </div>
          </Section>

          {/* FOOTER */}
          <div className="text-center text-[9px] italic" style={{ color: T.textFade }}>
            Auto-refreshes every 15 seconds · single Mission Control page for every email surface · doctrine: `constitution_nex_email_runtime_8_phase_roadmap_2026_08_07`
          </div>
        </>
      )}

      {/* IMPORT WIZARD MODAL ─────────────────────────────────────── */}
      <ImportWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onImported={() => { setWizardOpen(false); void load(); }}
      />
    </div>
  );
}
