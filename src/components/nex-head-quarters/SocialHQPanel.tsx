// NEX Comms Centre · Social · HQ Mission Control panel · Phase 7
//
// Network-wide HQ oversight. Distinct from the merchant SocialCentrePanel:
// this surface is for Nex admins, uses the Boundary-3 admin-read wrapper
// for every cross-tenant lookup, and enforces k-anonymity on aggregates.
//
// Sections:
//   Overview       · tenants · accounts by platform (k-suppressed) · jobs · validator runs
//   Adapters       · which providers are registered · capability snapshot
//   Tenants        · list · create · suspend
//   Audit          · tenant-scoped audit stream
//   Access Log     · Boundary-3 audits of admin cross-tenant reads

"use client";

import { useCallback, useEffect, useState } from "react";

const T = {
  panel: "#12161c", panelHi: "#1a2028", border: "#232b36",
  text: "#e5e9ef", textDim: "#8892a0", textFade: "#5c6572",
  accent: "#4dd0a0", warning: "#f0b45a", danger: "#f0665a", info: "#5aa6f0", purple: "#b48cf0",
};
const input: React.CSSProperties = { background: T.panel, borderColor: T.border, color: T.text };

type HQTab = "overview"|"adapters"|"tenants"|"audit"|"access";

export function SocialHQPanel({ adminUserId: initial, reason: initialReason }: {
  adminUserId?: string; reason?: string;
} = {}) {
  const [adminUserId, setAdminUserId] = useState<string>(initial ?? "hq");
  const [reason, setReason] = useState<string>(initialReason ?? "hq mission control routine review");
  const [tab, setTab] = useState<HQTab>("overview");

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>
            HQ Mission Control · Social
          </span>
          <input value={adminUserId} onChange={(e) => setAdminUserId(e.target.value)}
            placeholder="admin_user_id"
            className="rounded-md border px-2 py-1 font-mono text-[10.5px] w-[140px]" style={input} aria-label="Admin user id" />
          <input value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="reason for admin access (recorded)"
            className="rounded-md border px-2 py-1 text-[10.5px] flex-1 max-w-[380px]" style={input} aria-label="Reason for access" />
          <span className="ml-auto text-[9.5px] italic" style={{ color: T.textFade }}>
            Every read is Boundary-3 audited · k-anonymity floor k=5 on aggregates
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1" role="tablist" aria-label="HQ sections">
          {(["overview","adapters","tenants","audit","access"] as HQTab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t}
              onClick={() => setTab(t)}
              className="rounded-md border px-3 py-1 text-[10.5px] font-semibold"
              style={{ background: tab === t ? T.info : T.panel, borderColor: tab === t ? T.info : T.border, color: tab === t ? T.panel : T.textDim }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel" aria-labelledby={tab}>
        {tab === "overview" && <OverviewSection admin={adminUserId} reason={reason} />}
        {tab === "adapters" && <AdaptersSection admin={adminUserId} reason={reason} />}
        {tab === "tenants"  && <TenantsSection  admin={adminUserId} reason={reason} />}
        {tab === "audit"    && <AuditSection    admin={adminUserId} reason={reason} stream="audit" />}
        {tab === "access"   && <AuditSection    admin={adminUserId} reason={reason} stream="access" />}
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────
type Overview = {
  tenants: { total: number; by_kind: Record<string, number>; by_status: Record<string, number> };
  accounts_by_platform: Array<{ platform: string; count: number }>;
  jobs_by_status: Array<{ status: string; count: number }>;
  jobs_last_24h: number;
  jobs_last_7d: number;
  validator_runs_last_24h: { passed: number; rejected: number; failed_closed: number };
  k_anonymity_floor: number;
  computed_at: string;
};

function OverviewSection({ admin, reason }: { admin: string; reason: string }) {
  const [d, setD] = useState<Overview | null>(null);
  const load = useCallback(async () => {
    if (!admin || !reason) return;
    const r = await fetch(`/api/nex/comms-social/hq/network?admin_user_id=${encodeURIComponent(admin)}&reason=${encodeURIComponent(reason)}`);
    const j = await r.json() as { ok: boolean; overview?: Overview };
    if (j.ok && j.overview) setD(j.overview);
  }, [admin, reason]);
  useEffect(() => { void load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  if (!d) return <div className="rounded-md border p-3 text-[10.5px]" style={{ background: T.panelHi, borderColor: T.border, color: T.textFade }}>Provide admin_user_id + reason to load the overview.</div>;
  return (
    <div className="space-y-3">
      <SectionHeader title="Network overview" subtitle={`k-anonymity floor k=${d.k_anonymity_floor} · dimensions with fewer than k contributing tenants are suppressed`} />
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Kpi label="Tenants" value={d.tenants.total} tone="neutral" />
        <Kpi label="HQ" value={d.tenants.by_kind.hq ?? 0} tone="neutral" />
        <Kpi label="Trades" value={d.tenants.by_kind.trade ?? 0} tone="neutral" />
        <Kpi label="Active" value={d.tenants.by_status.active ?? 0} tone="good" />
        <Kpi label="Suspended" value={d.tenants.by_status.suspended ?? 0} tone={(d.tenants.by_status.suspended ?? 0) > 0 ? "warn" : "unset"} />
        <Kpi label="Jobs 24h" value={d.jobs_last_24h} tone="neutral" />
        <Kpi label="Jobs 7d" value={d.jobs_last_7d} tone="neutral" />
        <Kpi label="Passed 24h" value={d.validator_runs_last_24h.passed} tone="good" />
        <Kpi label="Rejected 24h" value={d.validator_runs_last_24h.rejected} tone={d.validator_runs_last_24h.rejected > 0 ? "warn" : "unset"} />
        <Kpi label="Fail-closed 24h" value={d.validator_runs_last_24h.failed_closed} tone={d.validator_runs_last_24h.failed_closed > 0 ? "bad" : "unset"} hint="config issues or ambiguous validator responses" />
      </div>

      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
          Accounts by platform (k-anonymised)
        </div>
        {d.accounts_by_platform.length === 0 ? (
          <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>
            No platform crosses the k=5 tenant floor yet · single-tenant slices are suppressed by design.
          </div>
        ) : d.accounts_by_platform.map((p) => (
          <div key={p.platform} className="grid items-baseline gap-2 border-b px-2 py-1.5 text-[10.5px]"
            style={{ borderColor: T.border, gridTemplateColumns: "150px 80px 1fr" }}>
            <span className="font-mono" style={{ color: T.text }}>{p.platform}</span>
            <span className="font-mono text-right" style={{ color: T.accent }}>{p.count}</span>
            <div className="h-1 rounded-full" style={{ background: T.panel }}>
              <div className="h-1 rounded-full" style={{ background: T.info, width: `${Math.min(100, p.count * 5)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
          Jobs by status
        </div>
        {d.jobs_by_status.map((s) => (
          <div key={s.status} className="grid items-baseline gap-2 border-b px-2 py-1.5 text-[10.5px]"
            style={{ borderColor: T.border, gridTemplateColumns: "200px 80px 1fr" }}>
            <span className="font-mono" style={{ color: T.text }}>{s.status}</span>
            <span className="font-mono text-right" style={{ color: T.accent }}>{s.count}</span>
            <div className="h-1 rounded-full" style={{ background: T.panel }}>
              <div className="h-1 rounded-full" style={{ background: T.info, width: `${Math.min(100, s.count * 2)}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>
        Refreshes every 30 s · computed_at: {new Date(d.computed_at).toLocaleString()}
      </div>
    </div>
  );
}

// ── Adapters ─────────────────────────────────────────────────
type Adapter = {
  platform: string; registered: boolean;
  supports_pkce: boolean; supports_refresh_tokens: boolean;
  supports_server_side_idempotency: boolean;
  caption_max_chars: number; hashtags_max: number;
};

function AdaptersSection({ admin, reason }: { admin: string; reason: string }) {
  const [rows, setRows] = useState<Adapter[]>([]);
  const load = useCallback(async () => {
    const r = await fetch(`/api/nex/comms-social/hq/network?admin_user_id=${encodeURIComponent(admin)}&reason=${encodeURIComponent(reason)}`);
    const j = await r.json() as { ok: boolean; adapters?: Adapter[] };
    if (j.ok && j.adapters) setRows(j.adapters);
  }, [admin, reason]);
  useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-3">
      <SectionHeader title="Adapter registry" subtitle="Real providers register only when credentials are present · missing creds = platform fails-closed" />
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="grid items-baseline gap-2 border-b px-2 py-1.5 text-[9px] font-black uppercase tracking-widest"
          style={{ borderColor: T.border, color: T.textFade, gridTemplateColumns: "140px 90px 80px 90px 120px 90px 90px" }}>
          <span>Platform</span><span>Registered</span><span>PKCE</span><span>Refresh</span><span>Server-idempotency</span><span>Caption max</span><span>Hashtags max</span>
        </div>
        {rows.map((a) => (
          <div key={a.platform} className="grid items-baseline gap-2 border-b px-2 py-1.5 text-[10.5px]"
            style={{ borderColor: T.border, gridTemplateColumns: "140px 90px 80px 90px 120px 90px 90px" }}>
            <span className="font-mono" style={{ color: T.text }}>{a.platform}</span>
            <StatusPill on={a.registered} onLabel="registered" offLabel="missing creds" />
            <StatusPill on={a.supports_pkce} onLabel="yes" offLabel="—" />
            <StatusPill on={a.supports_refresh_tokens} onLabel="yes" offLabel="—" />
            <StatusPill on={a.supports_server_side_idempotency} onLabel="server-side" offLabel="verify-loop" />
            <span className="font-mono text-right" style={{ color: T.textDim }}>{a.registered ? a.caption_max_chars : "—"}</span>
            <span className="font-mono text-right" style={{ color: T.textDim }}>{a.registered ? a.hashtags_max : "—"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tenants ──────────────────────────────────────────────────
type TenantRow = { tenant_id: string; kind: "hq"|"trade"; slug: string; display_name: string; country: string | null; status: "active"|"suspended"|"deleted"; created_at: string; updated_at: string };

function TenantsSection({ admin, reason }: { admin: string; reason: string }) {
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"hq"|"trade">("trade");
  const [err, setErr] = useState<string>("");

  const load = useCallback(async () => {
    if (!admin || !reason) return;
    const r = await fetch(`/api/nex/comms-social/hq/tenants?admin_user_id=${encodeURIComponent(admin)}&reason=${encodeURIComponent(reason)}&limit=200`);
    const j = await r.json() as { ok: boolean; tenants?: TenantRow[] };
    if (j.ok && j.tenants) setRows(j.tenants);
  }, [admin, reason]);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setErr(""); setBusy(true);
    try {
      const r = await fetch(`/api/nex/comms-social/hq/tenants`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ admin_user_id: admin, kind, slug, display_name: name, reason }),
      });
      const j = await r.json() as { ok: boolean; error?: string };
      if (!j.ok) setErr(j.error ?? "create failed");
      setSlug(""); setName("");
      await load();
    } finally { setBusy(false); }
  };
  const suspend = async (t: TenantRow) => {
    await fetch(`/api/nex/comms-social/hq/tenants`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ admin_user_id: admin, tenant_id: t.tenant_id, status: t.status === "active" ? "suspended" : "active", reason }),
    });
    await load();
  };

  return (
    <div className="space-y-3">
      <SectionHeader title="Tenants" subtitle="Create · list · suspend · every mutation via the Boundary-3 wrapper (auditable)" />
      <div className="rounded-md border p-3 space-y-2" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 120px 120px" }}>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (e.g. oakwood-staircases)"
            className="rounded-md border px-2 py-1.5 text-[10.5px] font-mono" style={input} aria-label="Slug" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name"
            className="rounded-md border px-2 py-1.5 text-[10.5px]" style={input} aria-label="Display name" />
          <select value={kind} onChange={(e) => setKind(e.target.value as never)} className="rounded-md border px-2 py-1.5 text-[10.5px]" style={input} aria-label="Kind">
            {["trade","hq"].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <button type="button" onClick={create} disabled={busy || !slug || !name || !admin || !reason}
            className="rounded-md border px-3 py-1.5 text-[10.5px] font-semibold"
            style={{ background: T.accent, borderColor: T.accent, color: T.panel, opacity: busy || !slug || !name ? 0.55 : 1 }}>
            {busy ? "Creating…" : "Create tenant"}
          </button>
        </div>
        {err && <div className="text-[10px]" style={{ color: T.danger }}>{err}</div>}
      </div>
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        <div className="border-b p-2 text-[9px] font-black uppercase tracking-widest" style={{ borderColor: T.border, color: T.textFade }}>
          Tenants · {rows.length}
        </div>
        {rows.length === 0 ? (
          <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No tenants yet. Create one above.</div>
        ) : rows.map((t) => (
          <div key={t.tenant_id} className="grid items-baseline gap-2 border-b px-2 py-1.5 text-[10.5px]"
            style={{ borderColor: T.border, gridTemplateColumns: "140px 130px 1fr 80px 100px 100px" }}>
            <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{t.tenant_id.slice(0, 8)}</span>
            <span className="font-mono" style={{ color: T.text }}>{t.slug}</span>
            <span className="truncate" style={{ color: T.textDim }}>{t.display_name}</span>
            <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{t.kind}</span>
            <StatusPill on={t.status === "active"} onLabel="active" offLabel={t.status} />
            <button type="button" onClick={() => suspend(t)}
              className="rounded-md border px-2 py-1 text-[9.5px]" style={{ background: T.panel, borderColor: T.border, color: T.textDim }}>
              {t.status === "active" ? "Suspend" : "Reactivate"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Audit ────────────────────────────────────────────────────
type AuditItem = {
  audit_id?: number | string; access_id?: number | string;
  tenant_id?: string | null; target_tenant_id?: string;
  event_type?: string; resource?: string;
  actor?: string; admin_user_id?: string;
  reason?: string; details?: Record<string, unknown>;
  subject_kind?: string | null; subject_id?: string | null;
  created_at?: string; accessed_at?: string;
};

function AuditSection({ admin, reason, stream }: { admin: string; reason: string; stream: "audit"|"access" }) {
  const [rows, setRows] = useState<AuditItem[]>([]);
  const load = useCallback(async () => {
    if (!admin || !reason) return;
    const r = await fetch(`/api/nex/comms-social/hq/audit?admin_user_id=${encodeURIComponent(admin)}&reason=${encodeURIComponent(reason)}&stream=${stream}&limit=100`);
    const j = await r.json() as { ok: boolean; rows?: AuditItem[] };
    if (j.ok && j.rows) setRows(j.rows);
  }, [admin, reason, stream]);
  useEffect(() => { void load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);
  const isAccess = stream === "access";
  return (
    <div className="space-y-3">
      <SectionHeader
        title={isAccess ? "Boundary-3 admin access log" : "Tenant audit stream"}
        subtitle={isAccess ? "Every cross-tenant admin read is recorded here · append-only · admin cannot delete" : "Every tenant-scoped state change · INSERT-only"} />
      <div className="rounded-md border" style={{ background: T.panelHi, borderColor: T.border }}>
        {rows.length === 0 ? (
          <div className="p-3 text-[10.5px]" style={{ color: T.textFade }}>No rows.</div>
        ) : rows.map((r, i) => {
          const id     = isAccess ? String(r.access_id ?? i) : String(r.audit_id ?? i);
          const kind   = isAccess ? String(r.resource ?? "—") : String(r.event_type ?? "—");
          const actor  = isAccess ? String(r.admin_user_id ?? "—") : String(r.actor ?? "—");
          const when   = isAccess ? r.accessed_at : r.created_at;
          const target = isAccess ? String(r.target_tenant_id ?? "—") : String(r.tenant_id ?? "—");
          const reason = isAccess ? String(r.reason ?? "") : (r.subject_id ?? "");
          return (
            <div key={id} className="grid items-baseline gap-2 border-b px-2 py-1.5 text-[10.5px]"
              style={{ borderColor: T.border, gridTemplateColumns: "180px 180px 200px 1fr 160px" }}>
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{when ? new Date(when).toLocaleString() : "—"}</span>
              <span className="font-mono" style={{ color: T.text }}>{kind}</span>
              <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{actor}</span>
              <span className="truncate text-[9.5px]" style={{ color: T.textDim }}>{isAccess ? reason : JSON.stringify(r.details ?? {}).slice(0, 100)}</span>
              <span className="font-mono text-[9.5px] truncate" style={{ color: T.textFade }}>{String(target).slice(0, 12)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Atoms ────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-[13px] font-black" style={{ color: T.text }}>{title}</div>
      <div className="text-[9.5px] italic" style={{ color: T.textFade }}>{subtitle}</div>
    </div>
  );
}
function StatusPill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return <span className="rounded-full border px-2 py-0.5 text-center text-[9px]" style={{
    background: on ? T.accent : T.panel, borderColor: on ? T.accent : T.border, color: on ? T.panel : T.textFade,
  }}>{on ? onLabel : offLabel}</span>;
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
