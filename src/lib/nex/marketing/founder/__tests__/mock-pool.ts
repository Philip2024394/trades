// src/lib/nex/marketing/founder/__tests__/mock-pool.ts
//
// SQL-faithful mock for Founder Control Centre acceptance tests.
// Covers senders + audience + campaigns + suppression + analytics.

import type { PoolClient, QueryResult } from "pg";

type Store = {
  contacts: any[];
  senders: Map<string, any>;
  sender_capacity: Map<string, any>;
  templates: Map<string, any>;
  segments: Map<string, any>;
  campaigns: Map<string, any>;
  send_queue: any[];
  send_logs: any[];
  bounce_logs: any[];
  audit: any[];
  opt_out: Set<string>;
  member_package_touched: boolean;      // canary · flips true if any query mentions marketing_package
};

let seq = 1;

export function makeMockPool() {
  const store: Store = {
    contacts: [], senders: new Map(), sender_capacity: new Map(),
    templates: new Map(), segments: new Map(), campaigns: new Map(),
    send_queue: [], send_logs: [], bounce_logs: [], audit: [],
    opt_out: new Set(),
    member_package_touched: false,
  };
  return {
    store,
    client: buildClient(store) as PoolClient,
    seedContacts(rows: Array<{ email: string; country?: string; category_slug?: string; language?: string; opt_out?: boolean; hard_bounced?: boolean; complaint_count?: number }>) {
      for (const r of rows) {
        store.contacts.push({
          contact_id: `contact-${seq++}`,
          email: r.email,
          country: r.country ?? "US",
          category_slug: r.category_slug ?? "scaffolding",
          language: r.language ?? "en",
          opt_out: r.opt_out ?? false,
          hard_bounced: r.hard_bounced ?? false,
          complaint_count: r.complaint_count ?? 0,
        });
      }
    },
    seedSender(sender_id: string, opts: { lane?: string; member_id?: string | null; email?: string; authentication_state?: string; health_state?: string; hourly_capacity?: number | null; daily_capacity?: number | null } = {}) {
      const now = new Date().toISOString();
      store.senders.set(sender_id, {
        sender_id,
        member_id: opts.member_id ?? null,
        lane: opts.lane ?? "founder",
        email: opts.email ?? `${sender_id}@test.local`,
        display_name: null, reply_to: null, sending_domain: null,
        provider: "resend", provider_account_ref: null,
        authentication_state: opts.authentication_state ?? "verified",
        verification_state: "domain_verified", authentication_expires_at: null,
        daily_capacity: opts.daily_capacity ?? 500,
        hourly_capacity: opts.hourly_capacity ?? 100,
        capacity_source: "test", capacity_verified_at: now,
        health_state: opts.health_state ?? "healthy",
        paused_reason: null,
        last_send_at: null, last_event_at: null, last_failure_at: null, last_failure_reason: null,
        bounce_rate: null, complaint_rate: null,
        authorised_at: now, authorised_by: "test", provenance: {},
        created_at: now, updated_at: now,
      });
    },
    addOptOut(email: string) { store.opt_out.add(email.toLowerCase()); },
  };
}

function buildClient(store: Store): PoolClient {
  return {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.trim().replace(/\s+/g, " ");

      // Canary
      if (/nex\.marketing_package(?!_)/i.test(norm) || /nex\.marketing_package_attribution/i.test(norm) || /nex\.marketing_operating_budget/i.test(norm)) {
        store.member_package_touched = true;
      }

      // ─── audience count ────────────────────────────────────────
      if (/^SELECT COUNT\(\*\)::int AS total_discovered/i.test(norm)) {
        const columns = norm.match(/([a-z_]+) = \$(\d+)/gi) ?? [];
        const filters: Array<(c: any) => boolean> = [];
        for (const m of columns) {
          const [, col, idx] = /([a-z_]+) = \$(\d+)/.exec(m) ?? [];
          if (!col || !idx) continue;
          const v = params[Number(idx) - 1];
          filters.push((c: any) => c[col] === v);
        }
        const rows = store.contacts.filter(c => filters.every(f => f(c)));
        const total = rows.length;
        const opt_out = rows.filter(r => r.opt_out).length;
        const hard_bounced = rows.filter(r => r.hard_bounced).length;
        const complaint = rows.filter(r => r.complaint_count > 0).length;
        const eligible = rows.filter(r => !r.opt_out && !r.hard_bounced).length;
        return r([{ total_discovered: total, eligible, opt_out, hard_bounced, complaint }]);
      }

      // ─── senders for lane='founder' ────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_sender_identity WHERE lane=\$1 AND member_id IS NULL/i.test(norm)) {
        return r([...store.senders.values()].filter(s => s.lane === params[0] && s.member_id === null));
      }
      if (/^SELECT \* FROM nex\.marketing_sender_identity WHERE lane='member' AND member_id=\$1/i.test(norm)) {
        return r([...store.senders.values()].filter(s => s.lane === "member" && s.member_id === params[0]));
      }
      if (/^SELECT \* FROM nex\.marketing_sender_identity WHERE sender_id=\$1/i.test(norm)) {
        const row = store.senders.get(params[0]);
        return r(row ? [row] : []);
      }
      if (/^SELECT lane, member_id FROM nex\.marketing_sender_identity WHERE sender_id = \$1/i.test(norm)) {
        const row = store.senders.get(params[0]);
        return r(row ? [{ lane: row.lane, member_id: row.member_id }] : []);
      }

      // ─── sender capacity read (empty in tests) ─────────────────
      if (/^SELECT window_kind, send_count FROM nex\.marketing_sender_capacity_window/i.test(norm)) {
        return r([]);
      }

      // ─── sender INSERT ─────────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_sender_identity/i.test(norm)) {
        const [member_id, lane, email, display_name, reply_to, sending_domain, provider, provider_account_ref, daily_capacity, hourly_capacity, capacity_source, authorised_by, provenance_json] = params;
        const id = `sender-${seq++}`;
        const now = new Date().toISOString();
        const row = {
          sender_id: id, member_id, lane, email: (email as string).toLowerCase(), display_name, reply_to, sending_domain,
          provider, provider_account_ref,
          authentication_state: "pending", verification_state: "unverified", authentication_expires_at: null,
          daily_capacity, hourly_capacity, capacity_source, capacity_verified_at: now,
          health_state: "healthy", paused_reason: null,
          last_send_at: null, last_event_at: null, last_failure_at: null, last_failure_reason: null,
          bounce_rate: null, complaint_rate: null,
          authorised_at: now, authorised_by, provenance: JSON.parse(provenance_json as string),
          created_at: now, updated_at: now,
        };
        store.senders.set(id, row);
        return r([row]);
      }

      // ─── audit inserts ─────────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_sender_audit/i.test(norm)) {
        store.audit.push({ params, at: new Date().toISOString() });
        return r([]);
      }

      // ─── send_queue count ──────────────────────────────────────
      if (/^SELECT COUNT\(\*\)::int AS n FROM nex\.marketing_send_queue/i.test(norm)) {
        return r([{ n: store.send_queue.filter(q => q.status === "pending").length }]);
      }

      // ─── send_log max ──────────────────────────────────────────
      if (/^SELECT MAX\(sent_at\) AS at FROM nex\.marketing_send_log/i.test(norm)) {
        const times = store.send_logs.map(l => l.sent_at).filter(Boolean);
        return r([{ at: times.length ? times.sort().reverse()[0] : null }]);
      }

      // ─── template INSERT ───────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_template/i.test(norm)) {
        const [slug, display_name, subject, from_email, from_name, reply_to, mjml, html, text, banner, cta, vars_json, lang] = params;
        const id = `tmpl-${seq++}`;
        store.templates.set(id, {
          template_id: id, slug, display_name, subject_line: subject, from_email, from_name, reply_to,
          mjml_source: mjml, html_compiled: html, text_fallback: text,
          banner_image_url: banner, cta_url: cta, variables: JSON.parse(vars_json as string), language: lang,
        });
        return r([{ template_id: id }]);
      }

      // ─── segment INSERT ────────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_segment/i.test(norm)) {
        const [slug, display_name, country, language, category_slug] = params;
        const id = `seg-${seq++}`;
        store.segments.set(id, { segment_id: id, slug, display_name, country, language, category_slug, extra_where: null });
        return r([{ segment_id: id }]);
      }

      // ─── campaign INSERT ───────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_campaign/i.test(norm)) {
        const [slug, display_name, template_id, segment_id, metadata_json] = params;
        const id = `camp-${seq++}`;
        const now = new Date().toISOString();
        const row = {
          campaign_id: id, slug, display_name, template_id, segment_id, status: "draft",
          metadata: JSON.parse(metadata_json as string),
          target_count: 0, send_count: 0, fail_count: 0,
          opened_count: 0, clicked_count: 0, bounced_count: 0, complained_count: 0, unsubscribed_count: 0,
          proposed_at: now, approved_at: null, approved_by: null,
          started_at: null, completed_at: null,
          created_at: now, updated_at: now,
        };
        store.campaigns.set(id, row);
        return r([row]);
      }

      // ─── campaigns SELECT (list + load) ────────────────────────
      if (/^SELECT \* FROM nex\.marketing_campaign WHERE COALESCE\(metadata->>'lane', ''\) = 'founder' ORDER BY created_at DESC/i.test(norm)) {
        return r([...store.campaigns.values()].filter(c => c.metadata?.lane === "founder").sort((a, b) => a.created_at < b.created_at ? 1 : -1));
      }
      if (/^SELECT \* FROM nex\.marketing_campaign WHERE campaign_id = \$1 AND COALESCE\(metadata->>'lane', ''\) = 'founder'/i.test(norm)) {
        const c = store.campaigns.get(params[0]);
        return r(c && c.metadata?.lane === "founder" ? [c] : []);
      }

      // ─── template SELECT for preview ───────────────────────────
      if (/^SELECT t\.subject_line, t\.from_email, t\.from_name, t\.html_compiled, t\.text_fallback, t\.variables FROM nex\.marketing_campaign c JOIN nex\.marketing_template t/i.test(norm)) {
        const c = store.campaigns.get(params[0]);
        if (!c || c.metadata?.lane !== "founder") return r([]);
        const t = store.templates.get(c.template_id);
        if (!t) return r([]);
        return r([{ subject_line: t.subject_line, from_email: t.from_email, from_name: t.from_name, html_compiled: t.html_compiled, text_fallback: t.text_fallback, variables: t.variables }]);
      }

      // ─── template + metadata SELECT for test-email ─────────────
      if (/^SELECT c\.metadata, t\.subject_line, t\.from_email, t\.from_name, t\.reply_to, t\.html_compiled, t\.text_fallback FROM nex\.marketing_campaign c JOIN nex\.marketing_template t/i.test(norm)) {
        const c = store.campaigns.get(params[0]);
        if (!c || c.metadata?.lane !== "founder") return r([]);
        const t = store.templates.get(c.template_id);
        if (!t) return r([]);
        return r([{ metadata: c.metadata, subject_line: t.subject_line, from_email: t.from_email, from_name: t.from_name, reply_to: t.reply_to, html_compiled: t.html_compiled, text_fallback: t.text_fallback }]);
      }

      // ─── review campaign+segment ───────────────────────────────
      if (/^SELECT c\.campaign_id, c\.display_name, c\.metadata, s\.country, s\.category_slug, s\.language FROM nex\.marketing_campaign c LEFT JOIN nex\.marketing_segment s/i.test(norm)) {
        const c = store.campaigns.get(params[0]);
        if (!c || c.metadata?.lane !== "founder") return r([]);
        const s = store.segments.get(c.segment_id);
        return r([{ campaign_id: c.campaign_id, display_name: c.display_name, metadata: c.metadata, country: s?.country ?? null, category_slug: s?.category_slug ?? null, language: s?.language ?? null }]);
      }

      // ─── campaign UPDATE approve ───────────────────────────────
      if (/^UPDATE nex\.marketing_campaign SET status = 'approved'/i.test(norm)) {
        const [approved_by, target, started, campaign_id] = params;
        const c = store.campaigns.get(campaign_id);
        if (!c || c.metadata?.lane !== "founder") return r([]);
        c.status = "approved";
        c.approved_at = new Date().toISOString();
        c.approved_by = approved_by;
        c.target_count = target;
        if (started) c.started_at = new Date().toISOString();
        return r([{ status: c.status }]);
      }

      // ─── segment lookup for send ───────────────────────────────
      if (/^SELECT segment_id FROM nex\.marketing_campaign WHERE campaign_id = \$1/i.test(norm)) {
        const c = store.campaigns.get(params[0]);
        return r(c ? [{ segment_id: c.segment_id }] : []);
      }
      if (/^SELECT country, category_slug, language FROM nex\.marketing_segment WHERE segment_id = \$1/i.test(norm)) {
        const s = store.segments.get(params[0]);
        return r(s ? [{ country: s.country, category_slug: s.category_slug, language: s.language }] : []);
      }

      // ─── contact SELECT for queue population ───────────────────
      if (/^SELECT contact_id, email FROM nex\.marketing_contact WHERE/i.test(norm)) {
        // Reconstruct filter from params · match by country/category/language
        const cols: string[] = [];
        const parts = norm.match(/([a-z_]+) = \$(\d+)/gi) ?? [];
        for (const m of parts) {
          const [, col] = /([a-z_]+) = \$(\d+)/.exec(m) ?? [];
          if (col) cols.push(col);
        }
        const rows = store.contacts.filter(c => {
          if (c.opt_out || c.hard_bounced) return false;
          for (let i = 0; i < cols.length; i++) {
            if (c[cols[i]] !== params[i]) return false;
          }
          return true;
        });
        return r(rows.map(x => ({ contact_id: x.contact_id, email: x.email })));
      }

      // ─── queue INSERT ──────────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_send_queue/i.test(norm)) {
        const [campaign_id, contact_id, email] = params;
        store.send_queue.push({ campaign_id, contact_id, email, status: "pending" });
        return r([]);
      }

      // ─── send_log INSERT ───────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_send_log/i.test(norm)) {
        store.send_logs.push({ params, sent_at: new Date().toISOString() });
        return r([]);
      }

      // ─── opt_out check ─────────────────────────────────────────
      if (/^SELECT 1 FROM nex\.marketing_opt_out WHERE LOWER\(email\) = LOWER\(\$1\) LIMIT 1/i.test(norm)) {
        return r(store.opt_out.has((params[0] as string).toLowerCase()) ? [{ "?column?": 1 }] : []);
      }

      // ─── contact suppression lookup ────────────────────────────
      if (/^SELECT opt_out, hard_bounced, complaint_count FROM nex\.marketing_contact WHERE LOWER\(email\) = LOWER\(\$1\)/i.test(norm)) {
        const row = store.contacts.find(c => (c.email as string).toLowerCase() === (params[0] as string).toLowerCase());
        return r(row ? [{ opt_out: row.opt_out, hard_bounced: row.hard_bounced, complaint_count: row.complaint_count }] : []);
      }

      // ─── analytics event aggregate ─────────────────────────────
      if (/^SELECT event_type, COUNT\(\*\)::int AS n FROM nex\.marketing_bounce_log/i.test(norm)) {
        return r([]);
      }

      throw new Error(`founder mock: unhandled SQL: ${norm.slice(0, 160)}...`);
    },
    release() {},
  } as unknown as PoolClient;
}

function r(rows: any[]): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] };
}
