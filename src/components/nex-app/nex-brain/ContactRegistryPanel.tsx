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

  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => { void loadList(); }, [loadList]);

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

      {/* FOOTER */}
      <div className="mt-3 text-center text-[9px] italic" style={{ color: T.textFade }}>
        Phase 3c.1 · Explorer + Search shipped. Merge Centre (3c.2), Timeline + Compliance history (3c.3) land in follow-up commits.
      </div>

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
