// src/lib/nex/marketing/member/__tests__/mock-pool.ts
//
// SQL-faithful in-memory mock for Stage 4 member-service acceptance tests.
// Covers the multi-table joins used by the campaign service:
//   nex.marketing_contact · marketing_package · marketing_sender_identity ·
//   marketing_sender_capacity_window · marketing_template · marketing_segment ·
//   marketing_campaign · marketing_bounce_log · marketing_send_log

import type { PoolClient, QueryResult } from "pg";

type Store = {
  contacts: any[];
  packages: Map<string, any>;
  senders: Map<string, any>;
  sender_capacity: Map<string, any>;
  templates: Map<string, any>;
  segments: Map<string, any>;
  campaigns: Map<string, any>;
  send_logs: any[];
  bounce_logs: any[];
};

let seq = 1;

export function makeMockPool() {
  const store: Store = {
    contacts: [],
    packages: new Map(),
    senders: new Map(),
    sender_capacity: new Map(),
    templates: new Map(),
    segments: new Map(),
    campaigns: new Map(),
    send_logs: [],
    bounce_logs: [],
  };
  return buildHandle(store);
}

export function resetMockPool(h: ReturnType<typeof makeMockPool>) {
  h.store.contacts.length = 0;
  h.store.packages.clear();
  h.store.senders.clear();
  h.store.sender_capacity.clear();
  h.store.templates.clear();
  h.store.segments.clear();
  h.store.campaigns.clear();
  h.store.send_logs.length = 0;
  h.store.bounce_logs.length = 0;
  seq = 1;
}

function buildHandle(store: Store) {
  return {
    store,
    client: buildClient(store) as PoolClient,
    seedContacts(rows: Array<{ email: string; country: string; category_slug: string; opt_out: boolean; hard_bounced: boolean; complaint_count?: number }>) {
      for (const r of rows) {
        store.contacts.push({
          contact_id: `contact-${seq++}`,
          email: r.email,
          country: r.country,
          category_slug: r.category_slug,
          language: "en",
          opt_out: r.opt_out,
          hard_bounced: r.hard_bounced,
          complaint_count: r.complaint_count ?? 0,
        });
      }
    },
    seedPackage(package_id: string, member_id: string, purchased: number) {
      const now = new Date().toISOString();
      store.packages.set(package_id, {
        package_id, member_id, package_type: "starter-managed-sends", display_name: "Managed",
        purchased_capacity: purchased, reserved_capacity: 0, consumed_capacity: 0,
        status: "active", currency: null, purchase_reference: null, purchase_amount_minor: null,
        purchased_at: now, activated_at: now, expires_at: null, targeting: {}, metadata: {},
        created_at: now, updated_at: now,
      });
    },
    seedSender(sender_id: string, member_id: string | null, opts: {
      lane?: "auto" | "member" | "founder";
      health_state?: string;
      hourly_capacity?: number;
      daily_capacity?: number;
    } = {}) {
      const now = new Date().toISOString();
      store.senders.set(sender_id, {
        sender_id, member_id, lane: opts.lane ?? (member_id ? "member" : "founder"),
        email: `${sender_id}@test.local`, display_name: null, reply_to: null, sending_domain: null,
        provider: "resend", provider_account_ref: null,
        authentication_state: "verified", verification_state: "domain_verified",
        authentication_expires_at: null,
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
    getPackage(package_id: string) {
      return store.packages.get(package_id);
    },
    forceCampaignStatus(campaign_id: string, status: string) {
      const c = store.campaigns.get(campaign_id);
      if (c) c.status = status;
    },
  };
}

function buildClient(store: Store): PoolClient {
  return {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.trim().replace(/\s+/g, " ");

      // ─── Audience count (single aggregate) ──────────────────
      if (/^SELECT COUNT\(\*\)::int AS total_discovered/i.test(norm)) {
        const filters: Array<(c: any) => boolean> = [];
        // Parse `country = $N`, `category_slug = $N`, `language = $N` in order
        const columns = norm.match(/([a-z_]+) = \$(\d+)/gi) ?? [];
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
        return asResult([{ total_discovered: total, eligible, opt_out, hard_bounced, complaint }]);
      }

      // ─── Package SELECT by id ───────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_package WHERE package_id=\$1/i.test(norm)) {
        const row = store.packages.get(params[0]);
        return asResult(row ? [row] : []);
      }

      // ─── Package member ownership check ─────────────────────
      if (/^SELECT member_id FROM nex\.marketing_package WHERE package_id = \$1/i.test(norm)) {
        const row = store.packages.get(params[0]);
        return asResult(row ? [{ member_id: row.member_id }] : []);
      }

      // ─── Package conditional reserve (Stage 4 · aggregate) ──
      if (/^UPDATE nex\.marketing_package SET reserved_capacity = reserved_capacity \+ \$1/i.test(norm)) {
        const [delta, package_id, member_id] = params;
        const row = store.packages.get(package_id);
        if (!row) return asResult([]);
        if (row.status !== "active") return asResult([]);
        if (row.member_id !== member_id) return asResult([]);
        if (row.reserved_capacity + row.consumed_capacity + delta > row.purchased_capacity) return asResult([]);
        row.reserved_capacity += delta;
        row.updated_at = new Date().toISOString();
        return asResult([{ reserved_capacity: row.reserved_capacity }]);
      }

      // ─── Package release (cancel path) ──────────────────────
      if (/^UPDATE nex\.marketing_package SET reserved_capacity = GREATEST\(0, reserved_capacity - \$1\)/i.test(norm)) {
        const [delta, package_id, member_id] = params;
        const row = store.packages.get(package_id);
        if (!row) return asResult([]);
        if (row.member_id !== member_id) return asResult([]);
        row.reserved_capacity = Math.max(0, row.reserved_capacity - delta);
        return asResult([row]);
      }

      // ─── Sender SELECT by id ────────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_sender_identity WHERE sender_id=\$1/i.test(norm)) {
        const row = store.senders.get(params[0]);
        return asResult(row ? [row] : []);
      }

      // ─── Sender ownership check (member_id + lane) ──────────
      if (/^SELECT member_id, lane FROM nex\.marketing_sender_identity WHERE sender_id = \$1/i.test(norm)) {
        const row = store.senders.get(params[0]);
        return asResult(row ? [{ member_id: row.member_id, lane: row.lane }] : []);
      }

      // ─── Sender capacity window read ────────────────────────
      if (/^SELECT window_kind, send_count FROM nex\.marketing_sender_capacity_window/i.test(norm)) {
        return asResult([]);   // no usage yet in these tests
      }

      // ─── Template INSERT ────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_template/i.test(norm)) {
        const [slug, display_name, subject, from_email, from_name, reply_to, mjml_source, html_compiled, text_fallback, banner_image_url, cta_url, variables_json, language] = params;
        const id = `tmpl-${seq++}`;
        const row = {
          template_id: id, slug, display_name, subject_line: subject,
          from_email, from_name, reply_to,
          mjml_source, html_compiled, text_fallback,
          banner_image_url, cta_url, variables: JSON.parse(variables_json as string), language,
        };
        store.templates.set(id, row);
        return asResult([{ template_id: id }]);
      }

      // ─── Segment INSERT ─────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_segment/i.test(norm)) {
        const [slug, display_name, country, language, category_slug] = params;
        const id = `seg-${seq++}`;
        const row = { segment_id: id, slug, display_name, country, language, category_slug, extra_where: null };
        store.segments.set(id, row);
        return asResult([{ segment_id: id }]);
      }

      // ─── Campaign INSERT (draft) ────────────────────────────
      if (/^INSERT INTO nex\.marketing_campaign/i.test(norm)) {
        const [slug, display_name, template_id, segment_id, metadata_json] = params;
        const id = `camp-${seq++}`;
        const now = new Date().toISOString();
        const row = {
          campaign_id: id, slug, display_name, template_id, segment_id,
          status: "draft",
          metadata: JSON.parse(metadata_json as string),
          target_count: 0, send_count: 0, fail_count: 0,
          opened_count: 0, clicked_count: 0, bounced_count: 0, complained_count: 0,
          proposed_at: now, approved_at: null, approved_by: null,
          started_at: null, completed_at: null,
          created_at: now, updated_at: now,
        };
        store.campaigns.set(id, row);
        return asResult([{
          ...row,
          scheduled_for: row.metadata?.scheduled_for ?? null,
        }]);
      }

      // ─── Campaign SELECT for listing ────────────────────────
      if (/^SELECT c\.campaign_id, c\.slug as slug/i.test(norm)) {
        const [member_id] = params;
        const rows = [...store.campaigns.values()]
          .filter(c => (c.metadata?.member_id ?? "") === member_id)
          .sort((a, b) => a.created_at < b.created_at ? 1 : -1)
          .map(c => ({
            ...c,
            member_id: c.metadata?.member_id ?? "",
            package_id: c.metadata?.package_id ?? null,
            scheduled_for: c.metadata?.scheduled_for ?? null,
          }));
        return asResult(rows);
      }

      // ─── Campaign SELECT for load ──────────────────────────
      if (/^SELECT c\.campaign_id, c\.slug, COALESCE\(c\.metadata->>'member_id'/i.test(norm)) {
        const [campaign_id] = params;
        const c = store.campaigns.get(campaign_id);
        if (!c) return asResult([]);
        return asResult([{
          ...c,
          member_id: c.metadata?.member_id ?? "",
          package_id: c.metadata?.package_id ?? null,
          scheduled_for: c.metadata?.scheduled_for ?? null,
        }]);
      }

      // ─── Campaign+template SELECT for preview ───────────────
      if (/^SELECT t\.subject_line, t\.from_email/i.test(norm)) {
        const [campaign_id] = params;
        const c = store.campaigns.get(campaign_id);
        if (!c) return asResult([]);
        const t = store.templates.get(c.template_id);
        if (!t) return asResult([]);
        return asResult([{
          subject_line: t.subject_line,
          from_email: t.from_email,
          from_name: t.from_name,
          html_compiled: t.html_compiled,
          text_fallback: t.text_fallback,
          variables: t.variables,
        }]);
      }

      // ─── Campaign+segment SELECT for review ─────────────────
      if (/^SELECT c\.metadata, s\.country, s\.category_slug, s\.language/i.test(norm)) {
        const [campaign_id] = params;
        const c = store.campaigns.get(campaign_id);
        if (!c) return asResult([]);
        const s = store.segments.get(c.segment_id);
        return asResult([{
          metadata: c.metadata,
          country: s?.country ?? null,
          category_slug: s?.category_slug ?? null,
          language: s?.language ?? null,
        }]);
      }

      // ─── Campaign UPDATE · schedule/approve ─────────────────
      if (/^UPDATE nex\.marketing_campaign SET status = 'approved'/i.test(norm)) {
        const [approved_by, target, send_now, campaign_id] = params;
        const c = store.campaigns.get(campaign_id);
        if (!c) return asResult([]);
        c.status = "approved";
        c.approved_at = new Date().toISOString();
        c.approved_by = approved_by;
        c.target_count = target;
        if (send_now) c.started_at = new Date().toISOString();
        return asResult([c]);
      }

      // ─── Campaign UPDATE · rollback to draft ─────────────────
      if (/^UPDATE nex\.marketing_campaign SET status = 'draft'/i.test(norm)) {
        const [campaign_id] = params;
        const c = store.campaigns.get(campaign_id);
        if (!c) return asResult([]);
        c.status = "draft";
        c.approved_at = null;
        c.approved_by = null;
        c.target_count = 0;
        c.started_at = null;
        return asResult([c]);
      }

      // ─── Campaign UPDATE · cancel ────────────────────────────
      if (/^UPDATE nex\.marketing_campaign SET status = 'cancelled'/i.test(norm)) {
        const [reason, campaign_id] = params;
        const c = store.campaigns.get(campaign_id);
        if (!c) return asResult([]);
        c.status = "cancelled";
        c.completed_at = new Date().toISOString();
        c.metadata = { ...c.metadata, cancel_reason: reason };
        return asResult([c]);
      }

      // ─── Campaign metadata SELECT for cancel ────────────────
      if (/^SELECT metadata, target_count, send_count FROM nex\.marketing_campaign/i.test(norm)) {
        const [campaign_id] = params;
        const c = store.campaigns.get(campaign_id);
        if (!c) return asResult([]);
        return asResult([{ metadata: c.metadata, target_count: c.target_count, send_count: c.send_count }]);
      }

      // ─── Analytics · event-log aggregate ────────────────────
      if (/^SELECT event_type, COUNT\(\*\)::int AS n/i.test(norm)) {
        const [campaign_id] = params;
        // In tests, no send/bounce logs are seeded; return empty aggregate
        return asResult([]);
      }

      throw new Error(`member mock-pool: unhandled SQL: ${norm.slice(0, 180)}...`);
    },
    release() {},
  } as unknown as PoolClient;
}

function asResult(rows: any[]): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] };
}
