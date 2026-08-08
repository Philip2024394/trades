// NEX Comms Centre · Social Centre panel · Phase 6 · merchant UI
//
// Merchant-facing panel for the entire Comms-Centre Social Engine.
// All operations go through the existing Phase 0-5 API surface —
// this component NEVER imports adapters, providers, or Predictive.
//
// Sections (tabs):
//   Accounts      · connect / reconnect · per-platform status
//   Brand         · tone · forbidden terms · required hashtags
//   Sources       · merchant-authorised content sources (rights-gated)
//   Templates     · template-fill CRUD
//   Drafts        · generate · preview · validation results · approve
//   Categories    · Manual / Assisted / Automatic per content category
//   Schedule      · calendar + scheduled jobs
//   Queue         · in-flight + published + failed jobs
//   History       · rolling audit view
//   Analytics     · grounded metrics only
//   Controls      · global pause (kill-switch)

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// ── Theme (shared house palette) ──────────────────────────────
const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a", info: "#5aa6f0", purple: "#b48cf0",
};
const inputStyle: React.CSSProperties = { background: T.panel, borderColor: T.border, color: T.text };

// ── Types (thin · UI-side · shapes match Phase 0-5 API responses) ──
type Tab = "accounts"|"brand"|"sources"|"templates"|"drafts"|"categories"|"schedule"|"queue"|"history"|"analytics"|"controls";
type UUID = string;

type Account = {
  account_id: UUID; tenant_id: UUID; platform: string;
  display_name: string | null; platform_account_id: string | null;
  scopes: string[]; status: "pending"|"connected"|"attention_required"|"expired"|"revoked"|"disabled";
  connected_at: string | null; last_success_at: string | null; last_error: string | null;
  token_expires_at: string | null;
};

type Source = {
  source_id: UUID; kind: string; slug: string | null; content: Record<string, unknown>;
  rights_status: string; contains_identifiable_persons: boolean;
  attested_by: string | null; expires_at: string | null; active: boolean;
};

type Template = {
  template_id: UUID; slug: string; kind: string; body: string;
  variable_slots: Array<{ name: string; source_kind: string; source_path: string; required: boolean }>;
  hashtags_slots: Array<{ tag: string }>; cta_slot: { template: string } | null;
  status: "draft"|"active"|"retired";
};

type Draft = {
  draft_id: UUID; template_id: UUID | null; platform: string;
  caption: string; hashtags: string[]; cta: string | null;
  source_refs: UUID[]; grounding_state: "pending"|"grounded"|"rejected";
  rejection_reasons: Array<{ code: string; detail: string; offending_claim?: string; variable?: string }>;
  validator_run_id: UUID | null; created_by: string; created_at: string;
};

type CategoryRow = {
  tenant_id: UUID; category: string; mode: "manual"|"assisted"|"automatic";
  enabled_by: string | null; enabled_at: string | null;
  last_check_in_at: string | null; auto_degraded_at: string | null; auto_degraded_reason: string | null;
};

type Job = {
  scheduled_id: UUID; draft_id: UUID; account_id: UUID; platform: string;
  run_at: string; attempts: number; max_attempts: number;
  status: "queued"|"leased"|"dispatched"|"published"|"refused_at_recheck"|"failed"|"paused_at_lease"|"abandoned";
  lease_owner: string | null; intent_id: UUID | null; last_error: string | null;
  refused_reasons: Array<{ code: string; detail: string; offending_claim?: string }> | null;
  enqueued_at: string; finished_at: string | null;
};

type BrandProfile = {
  tenant_id: UUID; tone: string;
  additional_whitelist: string[]; forbidden_terms: string[]; required_hashtags: string[];
  required_disclaimers: Array<{ text: string; applies_to_kind?: string }>;
};

type Controls = { global_pause: boolean; global_pause_at: string | null; global_pause_by: string | null; global_pause_reason: string | null };

type ValidatorRun = {
  run_id: UUID; draft_id: UUID | null; subject: string;
  started_at: string; completed_at: string | null; total_ms: number | null;
  stages: Array<{ stage: string; outcome: "pass"|"reject"|"fail_closed"; ms: number;
    rejections: Array<{ code: string; detail: string; offending_claim?: string }>;
    failed_closed_reason?: string;
  }>;
  outcome: "passed"|"rejected"|"failed_closed"|"pending";
};

// ── Component ─────────────────────────────────────────────────

export function SocialCentrePanel({ tenantId: initialTenantId, actor = "merchant" }: {
  tenantId?: string; actor?: string;
} = {}) {
  const [tenantId, setTenantId] = useState<string>(initialTenantId ?? "");
  const [tab, setTab] = useState<Tab>("accounts");

  return (
    <div className="space-y-3">
      {/* Header · tenant scope + tab strip */}
      <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>
            Social Centre
          </span>
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            placeholder="tenant_id (UUID)"
            className="rounded-md border px-2 py-1 font-mono text-[10.5px] flex-1 max-w-[320px]"
            style={inputStyle}
            aria-label="Tenant identifier"
          />
          <span className="ml-auto text-[9.5px] italic" style={{ color: T.textFade }}>
            All operations tenant-scoped · S-I isolation enforced at the DB layer
          </span>
        </div>
        {/* Tab strip */}
        <div className="mt-3 flex flex-wrap gap-1" role="tablist" aria-label="Social Centre sections">
          {(["accounts","brand","sources","templates","drafts","categories","schedule","queue","history","analytics","controls"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="rounded-md border px-3 py-1 text-[10.5px] font-semibold"
              style={{
                background:  tab === t ? T.info : T.panel,
                borderColor: tab === t ? T.info : T.border,
                color:       tab === t ? T.panel : T.textDim,
              }}>
              {LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      {!tenantId ? (
        <EmptyState message="Enter a tenant_id above to begin." hint="Every Social operation is tenant-scoped by charter §S-I. Without a tenant_id we cannot resolve any resource." />
      ) : (
        <div role="tabpanel" aria-labelledby={tab}>
          {tab === "accounts"   && <AccountsSection   tenantId={tenantId} actor={actor} />}
          {tab === "brand"      && <BrandSection      tenantId={tenantId} actor={actor} />}
          {tab === "sources"    && <SourcesSection    tenantId={tenantId} actor={actor} />}
          {tab === "templates"  && <TemplatesSection  tenantId={tenantId} actor={actor} />}
          {tab === "drafts"     && <DraftsSection     tenantId={tenantId} actor={actor} />}
          {tab === "categories" && <CategoriesSection tenantId={tenantId} actor={actor} />}
          {tab === "schedule"   && <ScheduleSection   tenantId={tenantId} actor={actor} />}
          {tab === "queue"      && <QueueSection      tenantId={tenantId} actor={actor} />}
          {tab === "history"    && <HistorySection    tenantId={tenantId} actor={actor} />}
          {tab === "analytics"  && <AnalyticsSection  tenantId={tenantId} actor={actor} />}
          {tab === "controls"   && <ControlsSection   actor={actor} />}
        </div>
      )}
    </div>
  );
}

const LABELS: Record<Tab, string> = {
  accounts: "Accounts", brand: "Brand", sources: "Sources", templates: "Templates",
  drafts: "Drafts", categories: "Categories", schedule: "Schedule", queue: "Queue",
  history: "History", analytics: "Analytics", controls: "Controls",
};

// ── Sub-sections ──────────────────────────────────────────────

function AccountsSection({ tenantId, actor }: { tenantId: string; actor: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platform, setPlatform] = useState<string>("simulator");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>("");

  // Accounts fetched via a small proxy (Phase 5 has no public list-accounts endpoint;
  // sourcesEndpoint pattern applies). Phase 6 adds a merchant-facing GET on
  // /api/nex/comms-social/oauth/accounts. Until then, list is derived from
  // recent scheduled jobs and OAuth callback responses. Placeholder here.

  const load = useCallback(async () => { /* deferred to future endpoint */ }, []);
  useEffect(() => { void load(); }, [load]);

  const connect = async () => {
    setBusy(true); setNote("");
    try {
      const r = await fetch(`/api/nex/comms-social/oauth/${platform}/initiate`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId, initiated_by: actor,
          redirect_uri: `${location.origin}/api/nex/comms-social/oauth/${platform}/callback`,
        }),
      });
      const d = await r.json() as { ok: boolean; authorize_url?: string; error?: string };
      if (d.ok && d.authorize_url) {
        // In production this would open a popup or new tab.
        setNote(`Authorise: open ${d.authorize_url} in a new tab and complete the flow.`);
      } else setNote(`Error: ${d.error}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Connected accounts" subtitle="OAuth-only · tokens envelope-encrypted per §S-IX · revoke at any time" />
      <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-[10px] uppercase tracking-widest" style={{ color: T.textFade }}>Connect:</label>
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}
            className="rounded-md border px-2 py-1 text-[10.5px]" style={inputStyle}
            aria-label="Platform to connect">
            {["simulator","facebook","instagram","linkedin","tiktok","google_business"].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <button type="button" onClick={connect} disabled={busy}
            className="rounded-md border px-3 py-1 text-[10.5px] font-semibold"
            style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: busy ? 0.55 : 1 }}>
            {busy ? "Preparing…" : "Connect"}
          </button>
        </div>
        {note ? <div className="mt-2 text-[10px] break-all" style={{ color: T.info }}>{note}</div> : null}
        <div className="mt-2 text-[9.5px] italic" style={{ color: T.textFade }}>
          The UI never touches provider SDKs. Connecting starts the Phase 1 OAuth flow, which returns an authorize URL you open in the provider. On callback, tokens are envelope-encrypted and stored per S-IX.
        </div>
      </div>
      {accounts.length > 0 && (
        <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
          <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
            Connected · {accounts.length}
          </div>
          {accounts.map((a) => (
            <div key={a.account_id} className="grid items-center gap-2 border-b px-2 py-1.5 text-[10.5px]"
              style={{ borderColor: T.border, gridTemplateColumns: "120px 1fr 90px 100px" }}>
              <span className="font-mono" style={{ color: T.text }}>{a.platform}</span>
              <span className="truncate" style={{ color: T.textDim }}>{a.display_name ?? a.platform_account_id ?? "—"}</span>
              <StatusChip s={a.status} />
              <span className="text-[9.5px]" style={{ color: T.textFade }}>{a.connected_at ? new Date(a.connected_at).toLocaleDateString() : "—"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandSection({ tenantId, actor }: { tenantId: string; actor: string }) {
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState<string>("friendly");
  const [forbidden, setForbidden] = useState<string>("");
  const [required, setRequired] = useState<string>("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/nex/comms-social/content/brand-profiles?tenant_id=${encodeURIComponent(tenantId)}`);
    const d = await r.json() as { ok: boolean; profile: BrandProfile | null };
    if (d.ok && d.profile) {
      setProfile(d.profile);
      setTone(d.profile.tone);
      setForbidden(d.profile.forbidden_terms.join(", "));
      setRequired(d.profile.required_hashtags.join(" "));
    }
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      await fetch(`/api/nex/comms-social/content/brand-profiles`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId, tone,
          forbidden_terms:  forbidden.split(",").map((s) => s.trim()).filter(Boolean),
          required_hashtags: required.split(/\s+/).map((s) => s.trim()).filter(Boolean),
        }),
      });
      await load();
    } finally { setBusy(false); }
    void actor;
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Brand profile" subtitle="Drives the S-VIII Brand-stage checks · empty profile blocks Automatic mode (fail-closed)" />
      <div className="rounded-md border p-3 space-y-3" style={{ background: T.panelHi, borderColor: T.border }}>
        <label className="block">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Tone</span>
          <select value={tone} onChange={(e) => setTone(e.target.value)}
            className="mt-1 rounded-md border px-2 py-1.5 text-[11px]" style={inputStyle}>
            {["professional","friendly","premium","traditional","modern","technical","local"].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Words we never use (comma-separated)</span>
          <input value={forbidden} onChange={(e) => setForbidden(e.target.value)}
            placeholder="e.g. cheapest, quick, low-cost"
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-[11px]" style={inputStyle} />
        </label>
        <label className="block">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Hashtags required on every post (space-separated)</span>
          <input value={required} onChange={(e) => setRequired(e.target.value)}
            placeholder="e.g. #OakwoodStaircases #Nottingham"
            className="mt-1 w-full rounded-md border px-2 py-1.5 text-[11px]" style={inputStyle} />
        </label>
        <button type="button" onClick={save} disabled={busy}
          className="rounded-md border px-3 py-1.5 text-[10.5px] font-semibold"
          style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: busy ? 0.55 : 1 }}>
          {busy ? "Saving…" : "Save brand profile"}
        </button>
      </div>
      {profile && <div className="text-[9.5px]" style={{ color: T.textFade }}>Loaded profile · updated {new Date(profile.tenant_id ? Date.now() : 0).toLocaleString()}</div>}
    </div>
  );
}

function SourcesSection({ tenantId, actor }: { tenantId: string; actor: string }) {
  const [rows, setRows] = useState<Source[]>([]);
  const [kind, setKind] = useState<string>("business_profile");
  const [slug, setSlug] = useState<string>("");
  const [json, setJson] = useState<string>('{"name":"","city":""}');
  const [rights, setRights] = useState<string>("owned");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/nex/comms-social/content/sources?tenant_id=${encodeURIComponent(tenantId)}`);
    const d = await r.json() as { ok: boolean; sources: Source[] };
    if (d.ok) setRows(d.sources);
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setErr(""); setBusy(true);
    let content: Record<string, unknown>;
    try { content = JSON.parse(json) as Record<string, unknown>; }
    catch { setErr("Content must be valid JSON."); setBusy(false); return; }
    try {
      const r = await fetch(`/api/nex/comms-social/content/sources`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, kind, slug: slug || undefined, content, rights_status: rights, attested_by: actor }),
      });
      const d = await r.json() as { ok: boolean; error?: string };
      if (!d.ok) setErr(d.error ?? "save failed");
      await load();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Content sources" subtitle="Only rights-eligible sources are visible to the generator · unknown/restricted/expired/PII-without-release are hard-blocked" />
      <div className="rounded-md border p-3 space-y-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <label className="block">
            <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Kind</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)}
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-[11px]" style={inputStyle}>
              {["business_profile","project","product","service","offer","testimonial","faq","company_milestone","review_aggregate","certification","award","press_mention","service_area"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Slug (optional)</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1 w-full rounded-md border px-2 py-1.5 text-[11px]" style={inputStyle} />
          </label>
          <label className="block">
            <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Rights status</span>
            <select value={rights} onChange={(e) => setRights(e.target.value)}
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-[11px]" style={inputStyle}>
              {["owned","uploaded_by_customer_attested","licensed_with_expiry","nex_owned_evergreen","nex_owned_licensed_with_expiry","approved_nex_asset","ai_generated_provenance_pending","unknown","restricted"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Content JSON</span>
          <textarea value={json} onChange={(e) => setJson(e.target.value)}
            rows={5} className="mt-1 w-full rounded-md border px-2 py-1.5 font-mono text-[10.5px]" style={inputStyle} />
        </label>
        {err && <div className="text-[10px]" style={{ color: T.danger }}>{err}</div>}
        <button type="button" onClick={save} disabled={busy}
          className="rounded-md border px-3 py-1.5 text-[10.5px] font-semibold"
          style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: busy ? 0.55 : 1 }}>
          {busy ? "Saving…" : "Save source"}
        </button>
      </div>
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
          Current sources · {rows.length}
        </div>
        {rows.length === 0 ? (
          <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No sources yet. Add one above · without at least one eligible source the generator cannot ground any variable.</div>
        ) : rows.map((s) => (
          <div key={s.source_id} className="grid items-center gap-2 border-b px-2 py-1.5 text-[10.5px]"
            style={{ borderColor: T.border, gridTemplateColumns: "150px 150px 1fr 120px 60px" }}>
            <span className="font-mono" style={{ color: T.text }}>{s.kind}</span>
            <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{s.slug ?? "—"}</span>
            <span className="truncate text-[9.5px]" style={{ color: T.textFade }}>{JSON.stringify(s.content).slice(0, 80)}</span>
            <RightsChip r={s.rights_status} />
            <span className="text-[9.5px] font-mono" style={{ color: s.active ? T.accent : T.warning }}>{s.active ? "active" : "off"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplatesSection({ tenantId, actor }: { tenantId: string; actor: string }) {
  const [rows, setRows] = useState<Template[]>([]);
  const load = useCallback(async () => {
    const r = await fetch(`/api/nex/comms-social/content/templates?tenant_id=${encodeURIComponent(tenantId)}`);
    const d = await r.json() as { ok: boolean; templates: Template[] };
    if (d.ok) setRows(d.templates);
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-3">
      <SectionHeader title="Templates" subtitle="Template-fill generation only in Phase 6 · every {{variable}} traces to a source" />
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
          Templates · {rows.length} · Nex-owned templates appear alongside your own
        </div>
        {rows.length === 0 ? (
          <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No templates yet. Templates land via POST /api/nex/comms-social/content/templates.</div>
        ) : rows.map((t) => (
          <div key={t.template_id} className="border-b p-2 text-[10.5px]" style={{ borderColor: T.border }}>
            <div className="flex items-baseline justify-between">
              <span className="font-mono" style={{ color: T.text }}>{t.slug} · <span style={{ color: T.textFade }}>{t.kind}</span></span>
              <span className="rounded-full border px-2 py-0.5 text-[9px]" style={{
                background: t.status === "active" ? T.accent : T.panel,
                borderColor: t.status === "active" ? T.accent : T.border,
                color: t.status === "active" ? T.panel : T.textFade,
              }}>{t.status}</span>
            </div>
            <div className="mt-1 font-mono text-[9.5px]" style={{ color: T.textDim }}>{t.body}</div>
            <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>{t.variable_slots.length} variable(s) · {t.hashtags_slots.length} hashtag(s)</div>
          </div>
        ))}
      </div>
      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Full template authoring UI lands in Phase 6.1 · this section is read-only in v1. Use the API to create/edit for now.
      </div>
      {void actor}
    </div>
  );
}

function DraftsSection({ tenantId, actor }: { tenantId: string; actor: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [templateId, setTemplateId] = useState<string>("");
  const [platform, setPlatform] = useState<string>("simulator");
  const [busy, setBusy] = useState(false);
  const [lastDraft, setLastDraft] = useState<Draft | null>(null);
  const [runsByDraft, setRunsByDraft] = useState<Record<string, ValidatorRun | null>>({});

  const load = useCallback(async () => {
    const r = await fetch(`/api/nex/comms-social/content/drafts?tenant_id=${encodeURIComponent(tenantId)}&limit=25`);
    const d = await r.json() as { ok: boolean; drafts: Draft[] };
    if (d.ok) setDrafts(d.drafts);
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  const loadRun = async (draftId: string) => {
    const r = await fetch(`/api/nex/comms-social/content/validator-runs?tenant_id=${encodeURIComponent(tenantId)}&draft_id=${encodeURIComponent(draftId)}&limit=1`);
    const d = await r.json() as { ok: boolean; runs: ValidatorRun[] };
    setRunsByDraft((prev) => ({ ...prev, [draftId]: d.runs?.[0] ?? null }));
  };

  const generate = async () => {
    if (!templateId) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/nex/comms-social/content/generate`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: tenantId, template_id: templateId, platform, created_by: actor }),
      });
      const d = await r.json() as { ok: boolean; draft?: Draft };
      if (d.ok && d.draft) setLastDraft(d.draft);
      await load();
    } finally { setBusy(false); }
  };

  const runValidator = async (draftId: string) => {
    await fetch(`/api/nex/comms-social/content/validate`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, draft_id: draftId }),
    });
    await loadRun(draftId);
    await load();
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Drafts" subtitle="Generate → validate → approve · rejected drafts stay visible so you can edit and resubmit" />

      <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 160px 120px" }}>
          <input value={templateId} onChange={(e) => setTemplateId(e.target.value)}
            placeholder="template_id (UUID)"
            className="rounded-md border px-2 py-1.5 text-[10.5px] font-mono" style={inputStyle} />
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}
            className="rounded-md border px-2 py-1.5 text-[10.5px]" style={inputStyle}>
            {["simulator","facebook","instagram","linkedin","tiktok","google_business"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <button type="button" onClick={generate} disabled={busy || !templateId}
            className="rounded-md border px-3 py-1.5 text-[10.5px] font-semibold"
            style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: busy || !templateId ? 0.55 : 1 }}>
            {busy ? "Generating…" : "Generate draft"}
          </button>
        </div>
      </div>

      {lastDraft && <DraftCard draft={lastDraft} run={runsByDraft[lastDraft.draft_id] ?? null} onValidate={() => runValidator(lastDraft.draft_id)} onLoadRun={() => loadRun(lastDraft.draft_id)} />}

      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
          Recent drafts · {drafts.length}
        </div>
        {drafts.length === 0 ? (
          <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No drafts yet.</div>
        ) : drafts.map((d) => (
          <div key={d.draft_id} className="border-b p-2 text-[10.5px]" style={{ borderColor: T.border }}>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{d.draft_id.slice(0, 8)}</span>
              <span className="font-mono" style={{ color: T.textDim }}>{d.platform}</span>
              <GroundingChip s={d.grounding_state} />
              <span className="ml-auto text-[9.5px]" style={{ color: T.textFade }}>{new Date(d.created_at).toLocaleString()}</span>
            </div>
            <div className="mt-1 truncate" style={{ color: T.text }}>{d.caption}</div>
            {d.rejection_reasons.length > 0 && (
              <div className="mt-1 text-[9.5px]" style={{ color: T.danger }}>
                Rejected: {d.rejection_reasons.map((r) => `${r.code}${r.offending_claim ? ` · "${r.offending_claim}"` : ""}`).join(" · ")}
              </div>
            )}
            <div className="mt-1 flex gap-2">
              <button type="button" onClick={() => runValidator(d.draft_id)}
                className="rounded-md border px-2 py-1 text-[9.5px]" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
                Re-validate
              </button>
              <button type="button" onClick={() => loadRun(d.draft_id)}
                className="rounded-md border px-2 py-1 text-[9.5px]" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
                Load validator run
              </button>
            </div>
            {runsByDraft[d.draft_id] && <ValidatorRunView run={runsByDraft[d.draft_id]!} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function DraftCard({ draft, run, onValidate, onLoadRun }: { draft: Draft; run: ValidatorRun | null; onValidate: () => void; onLoadRun: () => void }) {
  return (
    <div className="rounded-md border p-3 space-y-2" style={{ background: T.panel, borderColor: T.border }}>
      <div className="flex items-baseline gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Latest draft</span>
        <GroundingChip s={draft.grounding_state} />
        <span className="ml-auto text-[9.5px] font-mono" style={{ color: T.textFade }}>{draft.draft_id.slice(0, 8)}</span>
      </div>
      <div className="text-[11.5px] whitespace-pre-wrap" style={{ color: T.text }}>{draft.caption}</div>
      {draft.hashtags.length > 0 && <div className="text-[10px] font-mono" style={{ color: T.info }}>{draft.hashtags.join(" ")}</div>}
      {draft.cta && <div className="text-[10px] italic" style={{ color: T.textDim }}>{draft.cta}</div>}
      {draft.rejection_reasons.length > 0 && (
        <div className="rounded border p-2 text-[10px]" style={{ background: T.panelHi, borderColor: T.danger, color: T.danger }}>
          <div className="font-semibold">Why this can't publish yet:</div>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {draft.rejection_reasons.map((r, i) => (
              <li key={i}>{humanizeReason(r)}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onValidate}
          className="rounded-md border px-3 py-1 text-[10px]" style={{ background: T.info, borderColor: T.info, color: T.panel }}>
          Run full validator
        </button>
        <button type="button" onClick={onLoadRun}
          className="rounded-md border px-3 py-1 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
          Show validator outcome
        </button>
      </div>
      {run && <ValidatorRunView run={run} />}
    </div>
  );
}

function ValidatorRunView({ run }: { run: ValidatorRun }) {
  return (
    <div className="mt-2 rounded border p-2 text-[10px]" style={{ background: T.panel, borderColor: T.border }}>
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Validator run</span>
        <span className="rounded-full border px-2 py-0.5 text-[9px]" style={{
          background: run.outcome === "passed" ? T.accent : run.outcome === "rejected" ? T.warning : T.danger,
          borderColor: T.border, color: T.panel,
        }}>{run.outcome}</span>
        <span className="ml-auto font-mono text-[9.5px]" style={{ color: T.textFade }}>{run.total_ms ?? "—"} ms</span>
      </div>
      <div className="space-y-0.5">
        {run.stages.map((s) => (
          <div key={s.stage} className="grid items-baseline gap-2" style={{ gridTemplateColumns: "80px 90px 60px 1fr" }}>
            <span className="font-mono" style={{ color: T.textDim }}>{s.stage}</span>
            <span className="rounded-full border px-2 py-0.5 text-[9px] text-center" style={{
              background: s.outcome === "pass" ? T.accent : s.outcome === "reject" ? T.warning : T.danger,
              borderColor: T.border, color: T.panel,
            }}>{s.outcome}</span>
            <span className="font-mono text-right" style={{ color: T.textFade }}>{s.ms} ms</span>
            <span className="truncate text-[9.5px]" style={{ color: T.textFade }}>
              {s.failed_closed_reason ?? s.rejections.map((r) => r.code).join(", ") ?? ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoriesSection({ tenantId, actor }: { tenantId: string; actor: string }) {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [role, setRole] = useState<string>("owner");

  const load = useCallback(async () => {
    const r = await fetch(`/api/nex/comms-social/scheduling/categories?tenant_id=${encodeURIComponent(tenantId)}`);
    const d = await r.json() as { ok: boolean; categories: CategoryRow[] };
    if (d.ok) setRows(d.categories);
  }, [tenantId]);
  useEffect(() => { void load(); }, [load]);

  const setMode = async (category: string, mode: string) => {
    const r = await fetch(`/api/nex/comms-social/scheduling/categories`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: tenantId, category, mode, actor, actor_role: role }),
    });
    if (r.status === 403) {
      alert(`Permission denied · role '${role}' cannot enable '${mode}'. Ask an owner or admin.`);
    }
    await load();
  };

  const ALL_CATEGORIES = ["project","educational","inspiration","product","faq","before_after","testimonial","seasonal","company","offer"];

  return (
    <div className="space-y-3">
      <SectionHeader title="Per-category automation" subtitle="Automatic is OPT-IN per category · never a global switch · every category auto-degrades to Assisted after 14 days of dormancy" />
      <div className="rounded-md border p-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-widest" style={{ color: T.textFade }}>Acting as role:</span>
          <select value={role} onChange={(e) => setRole(e.target.value)}
            className="rounded-md border px-2 py-1 text-[10.5px]" style={inputStyle}>
            {["owner","admin","marketing_manager","staff","viewer","agency_manager"].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className="text-[9.5px] italic" style={{ color: T.textFade }}>Only owner/admin/agency_manager may enable Automatic.</span>
        </div>
        <div className="space-y-1">
          {ALL_CATEGORIES.map((cat) => {
            const row = rows.find((r) => r.category === cat);
            const mode = row?.mode ?? "manual";
            const degraded = row?.auto_degraded_at;
            return (
              <div key={cat} className="grid items-center gap-2 text-[10.5px]" style={{ gridTemplateColumns: "150px 260px 1fr" }}>
                <span className="font-mono" style={{ color: T.text }}>{cat}</span>
                <div className="flex gap-1">
                  {(["manual","assisted","automatic"] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setMode(cat, m)}
                      className="flex-1 rounded-md border px-2 py-1 text-[9.5px] font-semibold"
                      style={{
                        background:  mode === m ? T.info : T.panel,
                        borderColor: mode === m ? T.info : T.border,
                        color:       mode === m ? T.panel : T.textDim,
                      }}>
                      {m}
                    </button>
                  ))}
                </div>
                <span className="text-[9px]" style={{ color: degraded ? T.warning : T.textFade }}>
                  {degraded ? `Auto-degraded: ${row?.auto_degraded_reason ?? ""}` : row?.last_check_in_at ? `Last check-in: ${new Date(row.last_check_in_at).toLocaleDateString()}` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        14-day active-consent rule (§S-V): if a category has been Automatic for 14 days without a check-in, it silently degrades to Assisted. Re-enable to reset the timer.
      </div>
    </div>
  );
}

function ScheduleSection({ tenantId, actor }: { tenantId: string; actor: string }) {
  const [draftId, setDraftId] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [platform, setPlatform] = useState<string>("simulator");
  const [runAt, setRunAt] = useState<string>(new Date(Date.now() + 60_000).toISOString().slice(0, 16));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  const enqueue = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`/api/nex/comms-social/scheduling/enqueue`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId, draft_id: draftId, account_id: accountId, platform,
          run_at: new Date(runAt).toISOString(), enqueued_by: actor,
        }),
      });
      const d = await r.json() as { ok: boolean; scheduled_id?: string; error?: string; detail?: string };
      if (d.ok) setMsg(`Scheduled · ${d.scheduled_id}`);
      else setMsg(`Refused: ${d.error}${d.detail ? ` · ${d.detail}` : ""}`);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Schedule a post" subtitle="Enqueue a grounded draft for publish at a future time · the worker will re-check rights + policy before dispatch (§S-VIII)" />
      <div className="rounded-md border p-3 space-y-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label className="block">
            <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Draft id</span>
            <input value={draftId} onChange={(e) => setDraftId(e.target.value)}
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-[10.5px] font-mono" style={inputStyle} />
          </label>
          <label className="block">
            <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Account id</span>
            <input value={accountId} onChange={(e) => setAccountId(e.target.value)}
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-[10.5px] font-mono" style={inputStyle} />
          </label>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label className="block">
            <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Platform</span>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-[11px]" style={inputStyle}>
              {["simulator","facebook","instagram","linkedin","tiktok","google_business"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Run at (local)</span>
            <input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)}
              className="mt-1 w-full rounded-md border px-2 py-1.5 text-[10.5px] font-mono" style={inputStyle} />
          </label>
        </div>
        <button type="button" onClick={enqueue} disabled={busy || !draftId || !accountId}
          className="rounded-md border px-3 py-1.5 text-[10.5px] font-semibold"
          style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: busy || !draftId || !accountId ? 0.55 : 1 }}>
          {busy ? "Enqueuing…" : "Enqueue publish"}
        </button>
        {msg && <div className="text-[10px]" style={{ color: msg.startsWith("Refused") ? T.danger : T.accent }}>{msg}</div>}
      </div>
    </div>
  );
}

function QueueSection({ tenantId, actor }: { tenantId: string; actor: string }) {
  const [status, setStatus] = useState<string>("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (status) params.set("status", status);
    const r = await fetch(`/api/nex/comms-social/scheduling/jobs?${params}`);
    const d = await r.json() as { ok: boolean; jobs: Job[] };
    if (d.ok) setJobs(d.jobs);
  }, [tenantId, status]);
  useEffect(() => { void load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  const tick = async () => {
    setBusy(true);
    try {
      await fetch(`/api/nex/comms-social/worker/tick`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ worker_id: `ui-${actor}` }),
      });
      await load();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Publish queue" subtitle="Every job goes through: enqueue → lease → validator re-check → adapter publish · pause-aware" />
      <div className="rounded-md border p-2 flex gap-2 items-center" style={{ background: T.panelHi, borderColor: T.border }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border px-2 py-1 text-[10.5px]" style={inputStyle}>
          <option value="">All statuses</option>
          {["queued","leased","dispatched","published","refused_at_recheck","failed","paused_at_lease","abandoned"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" onClick={tick} disabled={busy}
          className="rounded-md border px-3 py-1 text-[10.5px]" style={{ background: T.info, borderColor: T.info, color: T.panel, opacity: busy ? 0.55 : 1 }}>
          {busy ? "Ticking…" : "Run worker tick"}
        </button>
        <span className="text-[9.5px] italic ml-auto" style={{ color: T.textFade }}>Auto-refreshes every 15s.</span>
      </div>
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        {jobs.length === 0 ? (
          <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No jobs.</div>
        ) : jobs.map((j) => (
          <div key={j.scheduled_id} className="border-b p-2 text-[10.5px]" style={{ borderColor: T.border }}>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{j.scheduled_id.slice(0, 8)}</span>
              <span className="font-mono" style={{ color: T.textDim }}>{j.platform}</span>
              <JobStatusChip s={j.status} />
              <span className="ml-auto font-mono text-[9.5px]" style={{ color: T.textFade }}>attempt {j.attempts}/{j.max_attempts}</span>
            </div>
            <div className="mt-1 grid gap-2 text-[9.5px]" style={{ color: T.textDim, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <span>enqueued {new Date(j.enqueued_at).toLocaleString()}</span>
              <span>run_at {new Date(j.run_at).toLocaleString()}</span>
              <span>{j.finished_at ? `finished ${new Date(j.finished_at).toLocaleString()}` : "in progress"}</span>
            </div>
            {j.last_error && <div className="mt-1 text-[9.5px]" style={{ color: T.danger }}>Error: {j.last_error}</div>}
            {j.refused_reasons && j.refused_reasons.length > 0 && (
              <div className="mt-1 text-[9.5px]" style={{ color: T.warning }}>
                Refused at re-check: {j.refused_reasons.map((r) => r.code).join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function HistorySection({ tenantId, actor }: { tenantId: string; actor: string }) {
  const [runs, setRuns] = useState<ValidatorRun[]>([]);
  useEffect(() => {
    fetch(`/api/nex/comms-social/content/validator-runs?tenant_id=${encodeURIComponent(tenantId)}&limit=25`)
      .then((r) => r.json()).then((d: { ok: boolean; runs: ValidatorRun[] }) => { if (d.ok) setRuns(d.runs); });
  }, [tenantId]);
  return (
    <div className="space-y-3">
      <SectionHeader title="Validator history" subtitle="Every validator run persisted here for audit · §S-VIII" />
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        {runs.length === 0 ? (
          <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No runs yet.</div>
        ) : runs.map((r) => (
          <div key={r.run_id} className="border-b p-2 text-[10.5px]" style={{ borderColor: T.border }}>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{r.run_id.slice(0, 8)}</span>
              <span className="rounded-full border px-2 py-0.5 text-[9px]" style={{
                background: r.outcome === "passed" ? T.accent : r.outcome === "rejected" ? T.warning : T.danger,
                borderColor: T.border, color: T.panel,
              }}>{r.outcome}</span>
              <span className="ml-auto text-[9.5px]" style={{ color: T.textFade }}>{new Date(r.started_at).toLocaleString()}</span>
            </div>
            <div className="mt-1 text-[9.5px]" style={{ color: T.textDim }}>
              {r.stages.map((s) => `${s.stage}:${s.outcome}`).join(" · ")}
            </div>
          </div>
        ))}
      </div>
      {void actor}
    </div>
  );
}

function AnalyticsSection({ tenantId, actor }: { tenantId: string; actor: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  useEffect(() => {
    fetch(`/api/nex/comms-social/scheduling/jobs?tenant_id=${encodeURIComponent(tenantId)}&limit=200`)
      .then((r) => r.json()).then((d: { ok: boolean; jobs: Job[] }) => { if (d.ok) setJobs(d.jobs); });
  }, [tenantId]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const j of jobs) c[j.status] = (c[j.status] ?? 0) + 1;
    return c;
  }, [jobs]);
  return (
    <div className="space-y-3">
      <SectionHeader title="Grounded analytics" subtitle="Uses only counts we can prove · no invented metrics · S-X honest '—' for anything the provider doesn't return" />
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        <Kpi label="Total jobs" value={jobs.length} tone="neutral" />
        <Kpi label="Published" value={counts.published ?? 0} tone={counts.published ? "good" : "unset"} />
        <Kpi label="Queued" value={counts.queued ?? 0} tone={counts.queued ? "warn" : "unset"} />
        <Kpi label="Failed" value={counts.failed ?? 0} tone={counts.failed ? "bad" : "unset"} />
        <Kpi label="Refused at re-check" value={counts.refused_at_recheck ?? 0} tone={counts.refused_at_recheck ? "warn" : "unset"} hint="Rights or Policy changed between enqueue and publish" />
        <Kpi label="Paused at lease" value={counts.paused_at_lease ?? 0} tone={counts.paused_at_lease ? "warn" : "unset"} hint="Global pause caught the job at lease time" />
      </div>
      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Provider metrics (reach · impressions · engagement) will appear in a future release when they are consistently returned by every registered adapter. Until then this view shows only what we know for certain.
      </div>
      {void actor}
    </div>
  );
}

function ControlsSection({ actor }: { actor: string }) {
  const [c, setC] = useState<Controls | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string>("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/nex/comms-social/controls`);
    const d = await r.json() as { ok: boolean; controls: Controls };
    if (d.ok) setC(d.controls);
  }, []);
  useEffect(() => { void load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  const toggle = async () => {
    if (!c) return;
    setBusy(true);
    try {
      await fetch(`/api/nex/comms-social/controls`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ global_pause: !c.global_pause, actor, reason: !c.global_pause ? reason : undefined }),
      });
      await load();
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Global controls" subtitle="Kill switch halts ALL autopublish across ALL tenants within ~30 seconds · §S-V" />
      <div className="rounded-md border p-3 space-y-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-black" style={{ color: c?.global_pause ? T.danger : T.accent }}>
            {c ? (c.global_pause ? "PAUSED (global kill switch active)" : "LIVE") : "…"}
          </span>
          {c?.global_pause && c.global_pause_by && (
            <span className="text-[9.5px] italic" style={{ color: T.textFade }}>
              by {c.global_pause_by} at {c.global_pause_at ? new Date(c.global_pause_at).toLocaleString() : "?"}
              {c.global_pause_reason ? ` · ${c.global_pause_reason}` : ""}
            </span>
          )}
        </div>
        {!c?.global_pause && (
          <input value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="reason for pause (recorded to audit)"
            className="w-full rounded-md border px-2 py-1.5 text-[10.5px]" style={inputStyle} />
        )}
        <button type="button" onClick={toggle} disabled={busy || !c}
          className="rounded-md border px-3 py-1.5 text-[10.5px] font-semibold"
          style={{
            background: c?.global_pause ? T.accent : T.warning,
            borderColor: c?.global_pause ? T.accent : T.warning,
            color: T.panel, opacity: busy ? 0.55 : 1,
          }}>
          {c?.global_pause ? "Resume all publishing" : "PAUSE all publishing"}
        </button>
      </div>
      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Global pause is a distinct concept from per-account pause (Phase 6.1) and per-category disable (see Categories tab). This switch stops the worker from leasing ANY job across ALL tenants.
      </div>
    </div>
  );
}

// ── Shared UI atoms ───────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-[13px] font-black" style={{ color: T.text }}>{title}</div>
      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>{subtitle}</div>
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="rounded-md border p-6 text-center" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[11px] font-semibold" style={{ color: T.textDim }}>{message}</div>
      {hint && <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>{hint}</div>}
    </div>
  );
}

function StatusChip({ s }: { s: Account["status"] }) {
  const bg = s === "connected" ? T.accent : s === "attention_required" ? T.warning : s === "revoked" ? T.danger : T.panel;
  return <span className="rounded-full border px-2 py-0.5 text-center text-[9px]" style={{ background: bg, borderColor: T.border, color: T.panel }}>{s}</span>;
}
function RightsChip({ r }: { r: string }) {
  const eligible = ["owned","uploaded_by_customer_attested","nex_owned_evergreen","approved_nex_asset","licensed_with_expiry","nex_owned_licensed_with_expiry"].includes(r);
  return <span className="rounded-full border px-2 py-0.5 text-center text-[9px]" style={{
    background: eligible ? T.accent : T.warning, borderColor: T.border, color: T.panel,
  }}>{r}</span>;
}
function GroundingChip({ s }: { s: Draft["grounding_state"] }) {
  const bg = s === "grounded" ? T.accent : s === "rejected" ? T.warning : T.panel;
  return <span className="rounded-full border px-2 py-0.5 text-center text-[9px]" style={{ background: bg, borderColor: T.border, color: T.panel }}>{s}</span>;
}
function JobStatusChip({ s }: { s: Job["status"] }) {
  const bg = s === "published" ? T.accent
    : s === "queued" || s === "leased" ? T.info
    : s === "paused_at_lease" ? T.warning
    : s === "refused_at_recheck" || s === "failed" || s === "abandoned" ? T.danger
    : T.panel;
  return <span className="rounded-full border px-2 py-0.5 text-center text-[9px]" style={{ background: bg, borderColor: T.border, color: T.panel }}>{s}</span>;
}
function Kpi({ label, value, tone = "neutral", hint }: { label: string; value: number | string; tone?: "neutral"|"good"|"warn"|"bad"|"unset"; hint?: string }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : T.text;
  return (
    <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 truncate font-mono text-[15px] font-black leading-none" style={{ color }}>{value}</div>
      {hint && <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>{hint}</div>}
    </div>
  );
}

// ── Reason humaniser ──────────────────────────────────────────

function humanizeReason(r: { code: string; detail: string; offending_claim?: string; variable?: string }): string {
  const map: Record<string, string> = {
    generator_missing_source:     "A required source is missing.",
    generator_missing_field:      "A required field on your source is empty.",
    generator_unresolved_variable: "The template has a placeholder that no source can fill.",
    provenance_integrity_failed:  "The system couldn't trace one of the placeholders back to a source.",
    hard_blocked_claim:           "This wording is on our forbidden-claims list (guarantees · superlatives · qualifications · pricing · safety · green claims).",
    review_required_claim:        "This wording requires evidence (award · qualification · offer · social-proof).",
    fact_hard_blocked:            "The validator caught a forbidden claim.",
    fact_review_required:         "The validator caught a claim that requires evidence.",
    policy_hard_blocked:          "This wording is blocked by our policy list.",
    policy_review_required:       "This wording requires policy evidence.",
    brand_forbidden_term:         "Your brand profile forbids this word.",
    brand_missing_required_hashtag: "A hashtag your brand requires is missing.",
    rights_source_missing:        "A source used to build this post no longer exists.",
    rights_source_ineligible:     "A source used to build this post has lost its rights status.",
    rights_source_inactive:       "A source used to build this post is inactive.",
    rights_source_expired:        "A source used to build this post has expired.",
    rights_pii_no_release:        "A source includes identifiable people without a release.",
    platform_caption_over_limit:  "The caption is longer than the platform allows.",
    platform_hashtags_over_limit: "There are more hashtags than the platform allows.",
  };
  const base = map[r.code] ?? r.detail;
  const suffix = r.offending_claim ? ` (\"${r.offending_claim}\")` : r.variable ? ` (variable \"${r.variable}\")` : "";
  return base + suffix;
}
