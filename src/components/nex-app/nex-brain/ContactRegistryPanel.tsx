// Contact Registry · Explorer + Merge Centre Mission Control
//
// Phase 3c.1 · Contact Explorer + Search + Detail drawer. Merge Centre
// (Phase 3c.2) will land here as an additional section + drawer action.
//
// Doctrine: constitution_nex_contact_intelligence_registry_2026_08_07.md

"use client";

import { useCallback, useEffect, useState } from "react";

// ── API shapes ───────────────────────────────────────────────────────
type Contact = {
  contact_id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  canonical_email: string | null;
  phone: string | null;
  canonical_phone: string | null;
  country: string | null;
  region: string | null;
  tags: string[];
  lifecycle_stage: string | null;
  consent_marketing: boolean | null;
  consent_transactional: boolean | null;
  consent_source: string | null;
  never_contact: boolean;
  unsubscribe_at: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_contacted_at: string | null;
  updated_at: string;
  source: string | null;
  attributes?: Record<string, unknown>;
};

type ListResponse = { ok: boolean; total: number; rows: Contact[] };

type Overview = {
  ok: boolean;
  total_contacts?: number;
  by_country?: Array<{ country: string; count: number }>;
  by_lifecycle?: Array<{ lifecycle_stage: string; count: number }>;
  by_source?: Array<{ source_type: string; count: number }>;
  top_tags?: Array<{ tag: string; count: number }>;
  duplicates_pending?: number;
  merges_all_time?: number;
  reason?: string;
};

type MergeStats = {
  pending_duplicates: number;
  high_confidence: number;
  merges_today: number;
  merges_all_time: number;
  average_confidence_pending: number | null;
  by_kind_pending: Record<string, number>;
};

type DuplicateEntry = {
  suggestion_id: string;
  contact_a: string;
  contact_b: string;
  match_kind: "email_exact" | "phone_exact" | "name_company_fuzzy";
  confidence: number;
  detected_at: string;
  contact_a_snapshot: Contact | null;
  contact_b_snapshot: Contact | null;
};

type DuplicatesResponse = { ok: boolean; entries: DuplicateEntry[]; stats: MergeStats };

type ConsumerEntry = {
  id: string;
  label: string;
  category: string;
  status: "adopted" | "partial" | "pending" | "not_started";
  description: string;
  wiring_notes: string;
  metrics: {
    consumer_id: string;
    last_activity_at: string | null;
    events_total: number;
    events_today: number;
    registry_resolved_total: number;
    alias_resolved_total: number;
    compliance_blocks_total: number;
    adoption_pct: number | null;
    ai_extended?: {
      brain_workers_migrated: number;
      identity_resolutions: number;
      fallback_searches: number;
      resolution_failures: number;
      average_confidence: number | null;
    };
  };
};

type ConsumersResponse = { ok: boolean; consumers: ConsumerEntry[] };

type MergeConflict = {
  field: string;
  surviving_value: unknown;
  absorbed_value: unknown;
  resolution: "surviving_wins" | "absorbed_wins" | "combined" | "ratcheted_safer";
  note?: string;
};

type MergePreview = {
  ok: boolean;
  surviving_id?: string;
  absorbed_id?: string;
  resulting?: Contact;
  conflicts?: MergeConflict[];
  source_rows_to_repoint?: number;
  events_to_repoint?: number;
  error?: string;
};

type ContactDetail = {
  ok: boolean;
  contact: Contact | null;
  sources: Array<{
    source_row_id: string; source_type: string; source_ref: string | null;
    source_metadata: Record<string, unknown>;
    observed_at: string; synchronised_at: string | null;
    sync_status: string; sync_error: string | null;
  }>;
  merges: Array<{
    merge_id: string; surviving_contact_id: string; absorbed_contact_id: string;
    decided_by: string | null; decided_at: string; rationale: string | null;
    match_signals: Record<string, unknown>; reversed_at: string | null;
    role: "surviving" | "absorbed";
  }>;
  recent_events: Array<{
    event_id: string; event_type: string; timestamp: string;
    outcome: string | null; payload: Record<string, unknown> | null;
  }>;
};

// ── Theme (dark · matches other Runtime panels) ──────────────────────
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
  drawer:   "#0f1318",
};

const PAGE_SIZE = 50;

// ── Panel ────────────────────────────────────────────────────────────
export function ContactRegistryPanel() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [list, setList] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // Filters
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [country, setCountry] = useState<string>("");
  const [lifecycle, setLifecycle] = useState<string>("");
  const [consentMarketing, setConsentMarketing] = useState<"" | "true" | "false">("");
  const [neverContact, setNeverContact] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(0);

  // Drawer
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Consumer Adoption
  const [consumers, setConsumers] = useState<ConsumersResponse | null>(null);

  // Merge Centre
  const [duplicates, setDuplicates] = useState<DuplicatesResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [minConfidence, setMinConfidence] = useState<number>(0);
  const [previewOpen, setPreviewOpen] = useState<{ suggestion_id: string; surviving_id: string; absorbed_id: string } | null>(null);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [rationale, setRationale] = useState("");

  // Debounce search (200ms)
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const loadOverview = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/contacts/overview", { cache: "no-store" }).then((r) => r.json());
      setOverview(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "overview_failed");
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (searchDebounced) params.set("search", searchDebounced);
      if (country) params.set("country", country);
      if (lifecycle) params.set("lifecycle_stage", lifecycle);
      if (consentMarketing) params.set("consent_marketing", consentMarketing);
      if (neverContact) params.set("never_contact", neverContact);
      const r = await fetch(`/api/nex/contacts/list?${params.toString()}`, { cache: "no-store" }).then((r) => r.json());
      setList(r);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "list_failed");
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, country, lifecycle, consentMarketing, neverContact]);

  const loadDuplicates = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (minConfidence > 0) params.set("min_confidence", String(minConfidence));
      const r = await fetch(`/api/nex/contacts/duplicates?${params.toString()}`, { cache: "no-store" }).then((r) => r.json());
      setDuplicates(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "duplicates_failed");
    }
  }, [minConfidence]);

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      await fetch("/api/nex/contacts/duplicates/scan", { method: "POST" });
      await loadDuplicates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "scan_failed");
    } finally {
      setScanning(false);
    }
  }, [loadDuplicates]);

  const openPreview = useCallback(async (entry: DuplicateEntry) => {
    // Default assignment: contact_a as surviving (has earlier first_seen or larger source count)
    // Simple rule: use contact_a as surviving by default · admin can swap by picking the opposite direction on the modal.
    const surviving = entry.contact_a;
    const absorbed = entry.contact_b;
    setPreviewOpen({ suggestion_id: entry.suggestion_id, surviving_id: surviving, absorbed_id: absorbed });
    setPreviewLoading(true);
    setPreview(null);
    setRationale(`${entry.match_kind} · confidence ${entry.confidence}`);
    try {
      const params = new URLSearchParams({ surviving, absorbed });
      const p = await fetch(`/api/nex/contacts/merge-preview?${params.toString()}`, { cache: "no-store" }).then((r) => r.json());
      setPreview(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "preview_failed");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const swapMergeDirection = useCallback(async () => {
    if (!previewOpen) return;
    const swapped = { ...previewOpen, surviving_id: previewOpen.absorbed_id, absorbed_id: previewOpen.surviving_id };
    setPreviewOpen(swapped);
    setPreviewLoading(true);
    setPreview(null);
    try {
      const params = new URLSearchParams({ surviving: swapped.surviving_id, absorbed: swapped.absorbed_id });
      const p = await fetch(`/api/nex/contacts/merge-preview?${params.toString()}`, { cache: "no-store" }).then((r) => r.json());
      setPreview(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "preview_failed");
    } finally {
      setPreviewLoading(false);
    }
  }, [previewOpen]);

  const confirmMerge = useCallback(async () => {
    if (!previewOpen) return;
    setMergeBusy(true);
    try {
      const r = await fetch(`/api/nex/contacts/duplicates/${previewOpen.suggestion_id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: "merge",
          surviving_id: previewOpen.surviving_id,
          absorbed_id: previewOpen.absorbed_id,
          rationale: rationale.trim() || undefined,
        }),
      }).then((r) => r.json());
      if (!r.ok) throw new Error(r.error || "merge failed");
      setPreviewOpen(null);
      setPreview(null);
      setRationale("");
      await Promise.all([loadDuplicates(), loadOverview(), loadList()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "merge_failed");
    } finally {
      setMergeBusy(false);
    }
  }, [previewOpen, rationale, loadDuplicates, loadOverview, loadList]);

  const keepSeparate = useCallback(async (entry: DuplicateEntry) => {
    try {
      await fetch(`/api/nex/contacts/duplicates/${entry.suggestion_id}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "keep_separate" }),
      });
      await loadDuplicates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "keep_separate_failed");
    }
  }, [loadDuplicates]);

  const loadConsumers = useCallback(async () => {
    try {
      const r = await fetch("/api/nex/contacts/consumers", { cache: "no-store" }).then((r) => r.json());
      setConsumers(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "consumers_failed");
    }
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { void loadDuplicates(); }, [loadDuplicates]);
  useEffect(() => { void loadConsumers(); }, [loadConsumers]);

  // Reset to page 0 when filters change (except when user is paging)
  useEffect(() => { setPage(0); }, [searchDebounced, country, lifecycle, consentMarketing, neverContact]);

  const openDrawer = useCallback(async (contactId: string) => {
    setOpenContactId(contactId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const r = await fetch(`/api/nex/contacts/${contactId}`, { cache: "no-store" }).then((r) => r.json());
      setDetail(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "detail_failed");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setOpenContactId(null);
    setDetail(null);
  }, []);

  const totalPages = list ? Math.ceil(list.total / PAGE_SIZE) : 0;
  const countries = overview?.by_country ?? [];
  const lifecycles = overview?.by_lifecycle ?? [];

  return (
    <div className="rounded-xl p-4" style={{ background: T.bg, color: T.text, fontFamily: "system-ui,-apple-system,Segoe UI,sans-serif" }}>
      {/* HEADER */}
      <div className="mb-5 flex items-baseline gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>NEX Headquarters · Customer Floor</div>
          <h1 className="mt-0.5 text-[24px] font-black leading-none">Contact Registry</h1>
          <div className="mt-1 text-[11px]" style={{ color: T.textDim }}>
            Explorer + Merge Centre · one person = one canonical record · every source is a relationship
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1">
          <div className="text-[9px] uppercase tracking-widest" style={{ color: T.textFade }}>Last update</div>
          <div className="font-mono text-[11px]" style={{ color: T.text }}>{lastUpdate || "—"}</div>
          {error ? <div className="text-[10px]" style={{ color: T.danger }}>Error: {error}</div> : null}
          <button
            type="button"
            onClick={() => { void loadOverview(); void loadList(); }}
            className="mt-1 rounded border px-2 py-1 text-[10px] font-semibold"
            style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* HEADLINE STATS */}
      <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Stat label="Total contacts" value={overview?.total_contacts?.toLocaleString() ?? "—"} tone={overview?.total_contacts ? "good" : "unset"} />
        <Stat label="Countries" value={overview?.by_country?.length ?? 0} />
        <Stat label="Sources" value={overview?.by_source?.length ?? 0} />
        <Stat label="Duplicates pending" value={overview?.duplicates_pending ?? 0} tone={(overview?.duplicates_pending ?? 0) > 0 ? "warn" : "neutral"} hint="Phase 3c.2 merge queue" />
        <Stat label="Merges all-time" value={overview?.merges_all_time ?? 0} />
        <Stat label="Filtered rows" value={list?.total?.toLocaleString() ?? "—"} tone="info" />
      </div>

      {/* FILTERS */}
      <div className="mb-3 rounded-lg border p-3" style={{ background: T.panel, borderColor: T.border }}>
        <div className="grid gap-2" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
          <div>
            <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Search</div>
            <input
              type="search"
              placeholder="name · email · company"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border px-2 py-1 text-[11px]"
              style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
            />
          </div>
          <div>
            <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Country</div>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded border px-2 py-1 text-[11px]"
              style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
            >
              <option value="">any</option>
              {countries.map((c) => (
                <option key={c.country} value={c.country}>{c.country} ({c.count})</option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Lifecycle</div>
            <select
              value={lifecycle}
              onChange={(e) => setLifecycle(e.target.value)}
              className="w-full rounded border px-2 py-1 text-[11px]"
              style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
            >
              <option value="">any</option>
              {lifecycles.map((l) => (
                <option key={l.lifecycle_stage} value={l.lifecycle_stage}>{l.lifecycle_stage} ({l.count})</option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Marketing consent</div>
            <select
              value={consentMarketing}
              onChange={(e) => setConsentMarketing(e.target.value as "" | "true" | "false")}
              className="w-full rounded border px-2 py-1 text-[11px]"
              style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
            >
              <option value="">any</option>
              <option value="true">granted</option>
              <option value="false">refused</option>
            </select>
          </div>
          <div>
            <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Never-contact</div>
            <select
              value={neverContact}
              onChange={(e) => setNeverContact(e.target.value as "" | "true" | "false")}
              className="w-full rounded border px-2 py-1 text-[11px]"
              style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
            >
              <option value="">any</option>
              <option value="true">yes</option>
              <option value="false">no</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="rounded-lg border" style={{ background: T.panel, borderColor: T.border }}>
        <div className="grid gap-2 border-b p-2 text-[9px] font-black uppercase tracking-widest"
             style={{ color: T.textFade, borderColor: T.border, gridTemplateColumns: "1fr 1.5fr 1fr 90px 90px 100px 90px" }}>
          <div>Name / Company</div>
          <div>Email · Phone</div>
          <div>Country · Region</div>
          <div>Lifecycle</div>
          <div>Consent</div>
          <div>Tags</div>
          <div>Updated</div>
        </div>
        {loading ? (
          <div className="p-4 text-center text-[11px]" style={{ color: T.textFade }}>Loading…</div>
        ) : !list ? (
          <div className="p-4 text-center text-[11px]" style={{ color: T.textFade }}>—</div>
        ) : list.rows.length === 0 ? (
          <div className="p-4 text-center text-[11px]" style={{ color: T.textFade }}>
            No contacts match these filters. Run a connector from the Communications Centre to populate the registry.
          </div>
        ) : (
          list.rows.map((c) => (
            <button
              key={c.contact_id}
              type="button"
              onClick={() => openDrawer(c.contact_id)}
              className="grid w-full items-center gap-2 border-b p-2 text-left text-[11px] hover:bg-white/5"
              style={{ background: openContactId === c.contact_id ? T.panelHi : "transparent", borderColor: T.border, gridTemplateColumns: "1fr 1.5fr 1fr 90px 90px 100px 90px" }}
            >
              <div>
                <div style={{ color: T.text }}>{c.name ?? "—"}</div>
                <div className="text-[9.5px]" style={{ color: T.textFade }}>{c.company ?? ""}</div>
              </div>
              <div>
                <div className="truncate font-mono" style={{ color: T.info }}>{c.email ?? "—"}</div>
                <div className="text-[9.5px] font-mono" style={{ color: T.textFade }}>{c.phone ?? ""}</div>
              </div>
              <div style={{ color: T.textDim }}>
                <div>{c.country ?? "—"}</div>
                <div className="text-[9.5px]" style={{ color: T.textFade }}>{c.region ?? ""}</div>
              </div>
              <div className="uppercase tracking-widest text-[9.5px]" style={{ color: T.textDim }}>{c.lifecycle_stage ?? "—"}</div>
              <div className="flex flex-col gap-0.5 text-[9px]">
                <span style={{ color: c.consent_marketing === true ? T.accent : c.consent_marketing === false ? T.danger : T.textFade }}>
                  M: {c.consent_marketing === true ? "yes" : c.consent_marketing === false ? "no" : "—"}
                </span>
                <span style={{ color: c.never_contact ? T.warning : T.textFade }}>{c.never_contact ? "never" : ""}</span>
                <span style={{ color: c.unsubscribe_at ? T.warning : T.textFade }}>{c.unsubscribe_at ? "unsub" : ""}</span>
              </div>
              <div className="flex flex-wrap gap-0.5">
                {c.tags?.slice(0, 2).map((t) => (
                  <span key={t} className="rounded px-1 text-[9px]" style={{ background: T.panelHi, color: T.textDim }}>{t}</span>
                ))}
                {(c.tags?.length ?? 0) > 2 ? <span className="text-[9px]" style={{ color: T.textFade }}>+{c.tags!.length - 2}</span> : null}
              </div>
              <div className="text-[9.5px] font-mono" style={{ color: T.textFade }}>{relTime(c.updated_at)}</div>
            </button>
          ))
        )}
      </div>

      {/* PAGINATION */}
      {list && list.total > PAGE_SIZE ? (
        <div className="mt-2 flex items-center justify-between text-[10.5px]" style={{ color: T.textDim }}>
          <div>
            Page {page + 1} of {totalPages} · showing {list.rows.length} of {list.total.toLocaleString()}
          </div>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded border px-2 py-1 text-[10px] font-semibold disabled:opacity-30"
              style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border px-2 py-1 text-[10px] font-semibold disabled:opacity-30"
              style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}

      {/* CONSUMER ADOPTION ──────────────────────────────────── */}
      <div className="mt-6 rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="mb-3">
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>Consumer Adoption</div>
          <h2 className="mt-0.5 text-[18px] font-black leading-none">Registry adoption across every consumer</h2>
          <div className="mt-1 text-[10.5px]" style={{ color: T.textDim }}>
            Every service that touches a person should resolve through the Contact Registry · <span style={{ color: T.text }}>Consumer → Registry → Alias Resolution → Canonical Contact → Compliance Check → Runtime → Provider</span>. This section shows which consumers have adopted the registry and which still need migration.
          </div>
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
          {consumers?.consumers.map((c) => {
            const statusColor =
              c.status === "adopted" ? T.accent :
              c.status === "partial" ? T.warning :
              c.status === "pending" ? T.info :
              T.textFade;
            return (
              <div key={c.id} className="rounded-md border p-3" style={{ background: T.panelHi, borderColor: statusColor + "44" }}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11.5px] font-black" style={{ color: T.text }}>{c.label}</span>
                  <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest" style={{ background: statusColor + "22", color: statusColor }}>
                    {c.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-1 text-[9.5px] uppercase tracking-widest" style={{ color: T.textFade }}>{c.category}</div>
                <div className="mt-1 text-[10.5px]" style={{ color: T.textDim }}>{c.description}</div>
                <div className="mt-2 grid grid-cols-4 gap-1 text-[9.5px]">
                  <MicroStat label="Adoption" value={c.metrics.adoption_pct != null ? `${c.metrics.adoption_pct}%` : "—"} tone={c.metrics.adoption_pct != null && c.metrics.adoption_pct >= 95 ? "good" : c.metrics.adoption_pct != null && c.metrics.adoption_pct < 50 ? "bad" : "neutral"} />
                  <MicroStat label="Events" value={c.metrics.events_total} />
                  <MicroStat label="Aliases" value={c.metrics.alias_resolved_total} tone={c.metrics.alias_resolved_total > 0 ? "info" : "neutral"} />
                  <MicroStat label="Blocks" value={c.metrics.compliance_blocks_total} tone={c.metrics.compliance_blocks_total > 0 ? "warn" : "neutral"} />
                </div>
                <div className="mt-1 text-[9px]" style={{ color: T.textFade }}>
                  Last activity: {c.metrics.last_activity_at ? relTime(c.metrics.last_activity_at) : "—"}
                </div>

                {c.metrics.ai_extended ? (
                  <div className="mt-2 rounded border p-2" style={{ background: T.panel, borderColor: T.info }}>
                    <div className="mb-1.5 text-[8px] font-black uppercase tracking-widest" style={{ color: T.info }}>AI-specific metrics</div>
                    <div className="grid grid-cols-3 gap-1 text-[9px]">
                      <MicroStat label="Brains migrated" value={c.metrics.ai_extended.brain_workers_migrated} tone={c.metrics.ai_extended.brain_workers_migrated > 0 ? "info" : "neutral"} />
                      <MicroStat label="Resolutions" value={c.metrics.ai_extended.identity_resolutions} tone="good" />
                      <MicroStat label="Failures" value={c.metrics.ai_extended.resolution_failures} tone={c.metrics.ai_extended.resolution_failures > 0 ? "warn" : "neutral"} />
                      <MicroStat label="Fallback searches" value={c.metrics.ai_extended.fallback_searches} tone={c.metrics.ai_extended.fallback_searches > 0 ? "warn" : "neutral"} />
                      <MicroStat label="Avg confidence" value={c.metrics.ai_extended.average_confidence != null ? c.metrics.ai_extended.average_confidence.toString() : "—"} tone={c.metrics.ai_extended.average_confidence != null && c.metrics.ai_extended.average_confidence >= 90 ? "good" : "neutral"} />
                      <MicroStat label="Total events" value={c.metrics.events_total} />
                    </div>
                  </div>
                ) : null}

                <div className="mt-2 rounded border p-1.5 text-[9.5px] italic" style={{ background: T.panel, borderColor: T.border, color: T.textFade }}>
                  {c.wiring_notes}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MERGE CENTRE ─────────────────────────────────────────── */}
      <div className="mt-6 rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
        <div className="mb-3 flex items-baseline gap-3">
          <div>
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>Merge Centre</div>
            <h2 className="mt-0.5 text-[18px] font-black leading-none">Duplicate queue</h2>
            <div className="mt-1 text-[10.5px]" style={{ color: T.textDim }}>
              Every merge preserves source history · repoints events · applies the compliance ratchet · writes a full audit row. Absorbed contact becomes an alias that resolves to canonical on lookup.
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="rounded border px-2 py-1 text-[10px]"
              style={{ background: T.panelHi, borderColor: T.border, color: T.textDim }}
            >
              <option value={0}>any confidence</option>
              <option value={60}>≥ 60</option>
              <option value={90}>≥ 90 (high)</option>
              <option value={99}>= 99 (email exact)</option>
            </select>
            <button
              type="button"
              onClick={runScan}
              disabled={scanning}
              className="rounded border px-3 py-1 text-[10px] font-semibold disabled:opacity-50"
              style={{ background: T.panelHi, borderColor: T.accent, color: T.accent }}
            >
              {scanning ? "Scanning…" : "Run dedup scan"}
            </button>
          </div>
        </div>

        {/* Merge stats */}
        {duplicates?.stats ? (
          <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
            <Stat label="Pending" value={duplicates.stats.pending_duplicates} tone={duplicates.stats.pending_duplicates > 0 ? "warn" : "neutral"} />
            <Stat label="High confidence" value={duplicates.stats.high_confidence} tone={duplicates.stats.high_confidence > 0 ? "warn" : "neutral"} hint="≥ 90" />
            <Stat label="Avg confidence" value={duplicates.stats.average_confidence_pending?.toFixed(1) ?? "—"} />
            <Stat label="Merges today" value={duplicates.stats.merges_today} tone="good" />
            <Stat label="Merges all-time" value={duplicates.stats.merges_all_time} />
            <Stat label="Email exact" value={duplicates.stats.by_kind_pending.email_exact ?? 0} />
            <Stat label="Phone exact" value={duplicates.stats.by_kind_pending.phone_exact ?? 0} />
            <Stat label="Name+company" value={duplicates.stats.by_kind_pending.name_company_fuzzy ?? 0} />
          </div>
        ) : null}

        {/* Queue */}
        <div className="rounded-lg border" style={{ background: T.panelHi, borderColor: T.border }}>
          {!duplicates ? (
            <div className="p-4 text-center text-[11px]" style={{ color: T.textFade }}>Loading…</div>
          ) : duplicates.entries.length === 0 ? (
            <div className="p-4 text-center text-[11px]" style={{ color: T.textFade }}>
              No pending duplicate suggestions. Run a dedup scan to populate the queue · or the queue is genuinely clean.
            </div>
          ) : (
            duplicates.entries.map((e) => {
              const a = e.contact_a_snapshot;
              const b = e.contact_b_snapshot;
              const conf = e.confidence;
              const confTone = conf >= 95 ? T.danger : conf >= 80 ? T.warning : T.info;
              return (
                <div key={e.suggestion_id} className="grid gap-2 border-b p-2 text-[10.5px]" style={{ borderColor: T.border, gridTemplateColumns: "70px 1fr 20px 1fr 120px 160px" }}>
                  <div className="flex flex-col items-start">
                    <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest" style={{ background: confTone + "22", color: confTone }}>
                      {conf}
                    </span>
                    <span className="mt-1 text-[8.5px] uppercase tracking-widest" style={{ color: T.textFade }}>{e.match_kind}</span>
                  </div>
                  <div>
                    <div className="font-mono" style={{ color: T.text }}>{a?.name ?? "—"}</div>
                    <div className="truncate text-[9.5px] font-mono" style={{ color: T.info }}>{a?.email ?? a?.phone ?? "—"}</div>
                    <div className="text-[9px] font-mono" style={{ color: T.textFade }}>{e.contact_a.slice(0, 12)}…</div>
                  </div>
                  <div className="grid place-items-center text-[14px]" style={{ color: T.textFade }}>↔</div>
                  <div>
                    <div className="font-mono" style={{ color: T.text }}>{b?.name ?? "—"}</div>
                    <div className="truncate text-[9.5px] font-mono" style={{ color: T.info }}>{b?.email ?? b?.phone ?? "—"}</div>
                    <div className="text-[9px] font-mono" style={{ color: T.textFade }}>{e.contact_b.slice(0, 12)}…</div>
                  </div>
                  <div className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{relTime(e.detected_at)}</div>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => keepSeparate(e)}
                      className="rounded border px-2 py-0.5 text-[9.5px] font-semibold"
                      style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
                    >
                      Keep separate
                    </button>
                    <button
                      type="button"
                      onClick={() => openPreview(e)}
                      className="rounded border px-2 py-0.5 text-[9.5px] font-semibold"
                      style={{ background: T.panel, borderColor: T.accent, color: T.accent }}
                    >
                      Preview merge
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-3 text-center text-[9px] italic" style={{ color: T.textFade }}>
        Phase 3c.1 Explorer + Phase 3c.2 Merge Centre shipped. Communication history · timelines · compliance-history rollup land in 3c.3.
      </div>

      {/* MERGE PREVIEW MODAL ─────────────────────────────────────── */}
      {previewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-6"
          style={{ background: "rgba(0,0,0,0.72)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !mergeBusy) { setPreviewOpen(null); setPreview(null); } }}
        >
          <div className="w-full max-w-4xl rounded-xl border" style={{ background: T.bg, borderColor: T.border, color: T.text }}>
            <div className="flex items-center gap-3 border-b p-4" style={{ borderColor: T.border }}>
              <div>
                <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>Merge Preview</div>
                <div className="mt-0.5 text-[16px] font-black">Confirm merge · deterministic rules apply</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={swapMergeDirection}
                  disabled={previewLoading || mergeBusy}
                  className="rounded border px-3 py-1 text-[11px] font-semibold"
                  style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
                >
                  ↔ Swap direction
                </button>
                <button
                  type="button"
                  onClick={() => { setPreviewOpen(null); setPreview(null); }}
                  disabled={mergeBusy}
                  className="rounded border px-3 py-1 text-[11px] font-semibold"
                  style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className="p-4">
              {previewLoading ? (
                <div className="p-4 text-center text-[11px]" style={{ color: T.textFade }}>Computing preview…</div>
              ) : !preview || !preview.ok || !preview.resulting ? (
                <div className="rounded border p-3 text-[11px]" style={{ background: T.panel, borderColor: T.danger, color: T.danger }}>
                  Error: {preview?.error ?? "preview unavailable"}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                    <Stat label="Surviving" value={previewOpen.surviving_id.slice(0, 12) + "…"} tone="good" hint="Canonical after merge" />
                    <Stat label="Absorbed" value={previewOpen.absorbed_id.slice(0, 12) + "…"} tone="warn" hint="Becomes alias" />
                    <Stat label="Conflicts" value={preview.conflicts?.length ?? 0} tone={preview.conflicts && preview.conflicts.length > 0 ? "warn" : "neutral"} />
                    <Stat label="Source rows to repoint" value={preview.source_rows_to_repoint ?? 0} tone="info" />
                    <Stat label="Events to repoint" value={preview.events_to_repoint ?? 0} tone="info" />
                    <Stat label="Tags after merge" value={preview.resulting.tags?.length ?? 0} />
                  </div>

                  <div className="rounded border p-3" style={{ background: T.panel, borderColor: T.accent }}>
                    <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>Resulting canonical contact</div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      <KV label="Name" value={preview.resulting.name} />
                      <KV label="Company" value={preview.resulting.company} />
                      <KV label="Email" value={preview.resulting.email} mono tone="info" />
                      <KV label="Phone" value={preview.resulting.phone} mono />
                      <KV label="Country" value={preview.resulting.country} />
                      <KV label="Region" value={preview.resulting.region} />
                      <KV label="Lifecycle" value={preview.resulting.lifecycle_stage} />
                      <KV label="First seen" value={preview.resulting.first_seen_at} mono />
                      <KV label="Marketing consent" value={preview.resulting.consent_marketing === true ? "granted" : preview.resulting.consent_marketing === false ? "refused" : "unknown"} tone={preview.resulting.consent_marketing === true ? "good" : preview.resulting.consent_marketing === false ? "bad" : "unset"} />
                      <KV label="Never-contact" value={preview.resulting.never_contact ? "TRUE" : "false"} tone={preview.resulting.never_contact ? "bad" : "unset"} />
                    </div>
                    {preview.resulting.tags && preview.resulting.tags.length > 0 ? (
                      <div className="mt-2">
                        <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Combined tags</div>
                        <div className="flex flex-wrap gap-1">
                          {preview.resulting.tags.map((t) => (
                            <span key={t} className="rounded-full border px-2 py-0.5 text-[10px]" style={{ background: T.panelHi, borderColor: T.border, color: T.text }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {preview.conflicts && preview.conflicts.length > 0 ? (
                    <div className="rounded border p-3" style={{ background: T.panel, borderColor: T.warning }}>
                      <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.warning }}>Conflict resolutions ({preview.conflicts.length})</div>
                      <div className="space-y-1">
                        {preview.conflicts.map((c, i) => (
                          <div key={i} className="grid gap-2 rounded border p-1.5 text-[10.5px]" style={{ background: T.panelHi, borderColor: T.border, gridTemplateColumns: "140px 1fr 1fr 140px" }}>
                            <span className="font-mono font-black" style={{ color: T.text }}>{c.field}</span>
                            <span className="truncate font-mono" style={{ color: T.accent }} title={String(c.surviving_value ?? "")}>{String(c.surviving_value ?? "—")}</span>
                            <span className="truncate font-mono" style={{ color: T.textDim }} title={String(c.absorbed_value ?? "")}>{String(c.absorbed_value ?? "—")}</span>
                            <span className="text-[9.5px] uppercase tracking-widest" style={{ color: c.resolution === "ratcheted_safer" ? T.warning : T.info }}>{c.resolution}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-[9.5px] italic" style={{ color: T.textFade }}>Compliance-related conflicts are always ratcheted toward safer state. Identity conflicts fall back to the surviving contact.</div>
                    </div>
                  ) : null}

                  <div className="rounded border p-3" style={{ background: T.panel, borderColor: T.border }}>
                    <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Merge rationale (recorded in audit)</div>
                    <input
                      type="text"
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                      placeholder="Why is this merge safe? · e.g. Confirmed same person · matches phone + name"
                      className="w-full rounded border px-2 py-1 text-[11px]"
                      style={{ background: T.panelHi, borderColor: T.border, color: T.text }}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setPreviewOpen(null); setPreview(null); }}
                      disabled={mergeBusy}
                      className="rounded border px-4 py-1.5 text-[11px] font-semibold"
                      style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmMerge}
                      disabled={mergeBusy}
                      className="rounded border px-4 py-1.5 text-[11px] font-black disabled:opacity-50"
                      style={{ background: T.panel, borderColor: T.accent, color: T.accent }}
                    >
                      {mergeBusy ? "Merging…" : `Confirm merge · absorb ${previewOpen.absorbed_id.slice(0, 8)}… into ${previewOpen.surviving_id.slice(0, 8)}…`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* DETAIL DRAWER */}
      {openContactId ? (
        <div
          className="fixed inset-y-0 right-0 z-40 w-full max-w-2xl overflow-y-auto border-l p-4 shadow-2xl"
          style={{ background: T.drawer, borderColor: T.border, color: T.text }}
        >
          <div className="mb-3 flex items-baseline gap-2">
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.accent }}>Contact Detail</div>
              <div className="mt-0.5 text-[16px] font-black">{detail?.contact?.name ?? "—"}</div>
              <div className="text-[10.5px] font-mono" style={{ color: T.textFade }}>{openContactId}</div>
            </div>
            <button
              type="button"
              onClick={closeDrawer}
              className="ml-auto rounded border px-3 py-1 text-[11px] font-semibold"
              style={{ background: T.panel, borderColor: T.border, color: T.textDim }}
            >
              Close
            </button>
          </div>
          {detailLoading ? (
            <div className="p-4 text-center text-[11px]" style={{ color: T.textFade }}>Loading detail…</div>
          ) : !detail || !detail.contact ? (
            <div className="p-4 text-center text-[11px]" style={{ color: T.textFade }}>No detail available.</div>
          ) : (
            <ContactDrawerContent detail={detail} />
          )}
        </div>
      ) : null}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Drawer content
// ═════════════════════════════════════════════════════════════════════
function ContactDrawerContent({ detail }: { detail: ContactDetail }) {
  const c = detail.contact!;
  return (
    <div className="space-y-3">
      {/* Identity */}
      <DrawerSection title="Identity">
        <div className="grid gap-2 text-[11px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <KV label="Name" value={c.name} />
          <KV label="Company" value={c.company} />
          <KV label="Email" value={c.email} mono tone="info" />
          <KV label="Phone" value={c.phone} mono />
          <KV label="Canonical email" value={c.canonical_email} mono />
          <KV label="Canonical phone" value={c.canonical_phone} mono />
          <KV label="Country" value={c.country} />
          <KV label="Region" value={c.region} />
          <KV label="Lifecycle" value={c.lifecycle_stage} />
          <KV label="Source (latest)" value={c.source} />
        </div>
        {c.tags && c.tags.length > 0 ? (
          <div className="mt-2">
            <div className="mb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>Tags</div>
            <div className="flex flex-wrap gap-1">
              {c.tags.map((t) => (
                <span key={t} className="rounded-full border px-2 py-0.5 text-[10px]" style={{ background: T.panel, borderColor: T.border, color: T.text }}>{t}</span>
              ))}
            </div>
          </div>
        ) : null}
      </DrawerSection>

      {/* Consent */}
      <DrawerSection title="Consent state" tone={c.never_contact || c.unsubscribe_at ? "warn" : c.consent_marketing === false ? "warn" : "neutral"}>
        <div className="grid gap-2 text-[11px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <KV label="Marketing" value={c.consent_marketing === true ? "granted" : c.consent_marketing === false ? "refused" : "unknown"} tone={c.consent_marketing === true ? "good" : c.consent_marketing === false ? "bad" : "unset"} />
          <KV label="Transactional" value={c.consent_transactional === true ? "granted" : c.consent_transactional === false ? "refused" : "unknown"} tone={c.consent_transactional === true ? "good" : c.consent_transactional === false ? "bad" : "unset"} />
          <KV label="Never-contact" value={c.never_contact ? "TRUE (ratcheted)" : "false"} tone={c.never_contact ? "bad" : "unset"} />
          <KV label="Unsubscribe_at" value={c.unsubscribe_at ?? "—"} tone={c.unsubscribe_at ? "warn" : "unset"} mono />
          <KV label="Consent source" value={c.consent_source} mono />
        </div>
      </DrawerSection>

      {/* Source history */}
      <DrawerSection title={`Source history · ${detail.sources.length}`}>
        {detail.sources.length === 0 ? (
          <div className="text-[11px]" style={{ color: T.textFade }}>No source rows.</div>
        ) : (
          <div className="space-y-1">
            {detail.sources.slice(0, 20).map((s) => (
              <div key={s.source_row_id} className="grid items-center gap-2 rounded border p-1.5 text-[10.5px]"
                   style={{ background: T.panelHi, borderColor: T.border, gridTemplateColumns: "100px 200px 90px 80px 1fr" }}>
                <span className="font-mono" style={{ color: T.accent }}>{s.source_type}</span>
                <span className="truncate font-mono text-[9.5px]" style={{ color: T.textDim }} title={s.source_ref ?? ""}>{s.source_ref ?? "—"}</span>
                <span className="font-mono text-[9.5px]" style={{ color: T.textFade }}>{relTime(s.observed_at)}</span>
                <span className="text-[9.5px] uppercase tracking-widest" style={{ color: s.sync_status === "ok" ? T.accent : T.danger }}>{s.sync_status}</span>
                <span className="truncate text-[9.5px] italic" style={{ color: T.textFade }} title={s.sync_error ?? ""}>{s.sync_error ?? ""}</span>
              </div>
            ))}
            {detail.sources.length > 20 ? <div className="text-[9.5px] italic" style={{ color: T.textFade }}>…and {detail.sources.length - 20} more</div> : null}
          </div>
        )}
      </DrawerSection>

      {/* Merge history */}
      {detail.merges.length > 0 ? (
        <DrawerSection title={`Merge history · ${detail.merges.length}`} tone="warn">
          <div className="space-y-1">
            {detail.merges.map((m) => (
              <div key={m.merge_id} className="rounded border p-2 text-[10.5px]" style={{ background: T.panelHi, borderColor: T.border }}>
                <div className="font-mono" style={{ color: T.warning }}>
                  {m.role === "surviving" ? "← absorbed " : "→ merged into "} <span style={{ color: T.text }}>{(m.role === "surviving" ? m.absorbed_contact_id : m.surviving_contact_id).slice(0, 12)}…</span>
                </div>
                <div className="mt-1 text-[9.5px]" style={{ color: T.textDim }}>{relTime(m.decided_at)} by {m.decided_by ?? "system"}</div>
                {m.rationale ? <div className="mt-1 text-[9.5px] italic" style={{ color: T.textFade }}>{m.rationale}</div> : null}
                {m.reversed_at ? <div className="mt-1 text-[9.5px]" style={{ color: T.warning }}>reversed at {m.reversed_at}</div> : null}
              </div>
            ))}
          </div>
        </DrawerSection>
      ) : null}

      {/* Recent activity */}
      <DrawerSection title={`Recent activity · ${detail.recent_events.length}`}>
        {detail.recent_events.length === 0 ? (
          <div className="text-[11px]" style={{ color: T.textFade }}>No events recorded for this contact yet.</div>
        ) : (
          <div className="space-y-1">
            {detail.recent_events.slice(0, 20).map((e) => (
              <div key={e.event_id} className="grid gap-2 rounded border p-1.5 text-[10px]"
                   style={{ background: T.panelHi, borderColor: T.border, gridTemplateColumns: "80px 200px 1fr" }}>
                <span className="font-mono" style={{ color: T.textFade }}>{relTime(e.timestamp)}</span>
                <span className="font-mono truncate" style={{ color: T.info }}>{e.event_type}</span>
                <span className="truncate" style={{ color: e.outcome === "ok" ? T.textDim : e.outcome === "blocked" ? T.warning : e.outcome === "failed" ? T.danger : T.textFade }}>
                  {e.outcome ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </DrawerSection>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Small building blocks
// ═════════════════════════════════════════════════════════════════════
function Stat({ label, value, tone = "neutral", hint }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "bad" | "unset" | "info"; hint?: string }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : tone === "info" ? T.info : T.text;
  return (
    <div className="rounded-md border p-3" style={{ background: T.panel, borderColor: T.border }}>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-1 font-mono text-[18px] font-black leading-none" style={{ color }}>{value}</div>
      {hint ? <div className="mt-1 text-[9.5px]" style={{ color: T.textFade }}>{hint}</div> : null}
    </div>
  );
}

function MicroStat({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "good" | "warn" | "bad" | "unset" | "info" }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : tone === "info" ? T.info : T.text;
  return (
    <div className="rounded border p-1" style={{ background: T.panel, borderColor: T.border }}>
      <div className="text-[8px] uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className="mt-0.5 font-mono text-[11px] font-black leading-none" style={{ color }}>{value}</div>
    </div>
  );
}

function DrawerSection({ title, tone = "neutral", children }: { title: string; tone?: "neutral" | "good" | "warn" | "bad"; children: React.ReactNode }) {
  const borderColor = tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "good" ? T.accent : T.border;
  return (
    <div className="rounded-lg border p-3" style={{ background: T.panel, borderColor }}>
      <div className="mb-2 text-[9px] font-black uppercase tracking-widest" style={{ color: T.textDim }}>{title}</div>
      {children}
    </div>
  );
}

function KV({ label, value, tone = "neutral", mono = false }: { label: string; value: string | number | null | undefined; tone?: "neutral" | "good" | "warn" | "bad" | "unset" | "info"; mono?: boolean }) {
  const color = tone === "good" ? T.accent : tone === "warn" ? T.warning : tone === "bad" ? T.danger : tone === "unset" ? T.textFade : tone === "info" ? T.info : T.text;
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: T.textFade }}>{label}</div>
      <div className={`mt-0.5 text-[11px] ${mono ? "font-mono" : ""}`} style={{ color }}>{value ?? "—"}</div>
    </div>
  );
}

function relTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const now = Date.now();
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const s = Math.round((now - then) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
