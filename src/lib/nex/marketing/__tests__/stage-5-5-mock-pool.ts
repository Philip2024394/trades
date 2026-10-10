// src/lib/nex/marketing/__tests__/stage-5-5-mock-pool.ts
//
// SQL-faithful mock for Stage 5.5 lane-integration acceptance suite.
// Covers: send_queue · marketing_campaign (with metadata JSON) · templates ·
// segments · marketing_contact · sender_identity · operating_budget +
// attribution · auto_policy · send_log · bounce_log.
//
// PACKAGE-TOUCH CANARY: any query naming `marketing_package` sets a flag.

import type { PoolClient, QueryResult } from "pg";

type QueryHandler = { pattern: RegExp; handle: (params: any[], sql: string) => any[] | Promise<any[]> };

export type Stage55Store = {
  contacts: any[];
  senders: Map<string, any>;
  budgets: Map<string, any>;
  attributions: Map<string, any>;                     // by idempotency_key
  attributions_by_id: Map<string, any>;
  templates: Map<string, any>;
  segments: Map<string, any>;
  campaigns: Map<string, any>;
  send_queue: any[];
  send_logs: any[];
  policies: Map<string, any>;
  member_package_touched: boolean;
  auto_budget_touched: boolean;
  seq: { n: number };
};

export function makeStage55Pool() {
  const store: Stage55Store = {
    contacts: [], senders: new Map(), budgets: new Map(),
    attributions: new Map(), attributions_by_id: new Map(),
    templates: new Map(), segments: new Map(), campaigns: new Map(),
    send_queue: [], send_logs: [], policies: new Map(),
    member_package_touched: false, auto_budget_touched: false,
    seq: { n: 0 },
  };
  const nextId = (prefix: string) => { store.seq.n += 1; return `${prefix}-${store.seq.n}`; };

  const client: PoolClient = {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.trim().replace(/\s+/g, " ");

      // Canaries
      if (/nex\.marketing_package(?!_)/i.test(norm) || /nex\.marketing_package_attribution/i.test(norm)) {
        store.member_package_touched = true;
      }
      if (/nex\.marketing_operating_budget(?!_audit)/i.test(norm) || /nex\.marketing_operating_budget_attribution/i.test(norm)) {
        store.auto_budget_touched = true;
      }

      // ─── SKIP LOCKED claim ───────────────────────────────────────
      if (/^UPDATE nex\.marketing_send_queue q SET status='claimed'/i.test(norm)) {
        const worker_id = params[0]; const limit = params[1];
        const claims = store.send_queue
          .filter(q => q.status === "pending" && (!q.next_attempt_at || new Date(q.next_attempt_at) <= new Date()))
          .slice(0, limit);
        for (const c of claims) { c.status = "claimed"; c.claimed_by = worker_id; c.claimed_at = new Date().toISOString(); }
        return R(claims.map(c => ({ queue_id: c.queue_id, campaign_id: c.campaign_id, contact_id: c.contact_id, email: c.email, attempts: c.attempts ?? 0 })));
      }

      // ─── send_queue updates ──────────────────────────────────────
      if (/^UPDATE nex\.marketing_send_queue SET status='pending', claimed_at=NULL, claimed_by=NULL, next_attempt_at=\$1, error=\$2 WHERE queue_id=\$3/i.test(norm)) {
        const q = store.send_queue.find(x => x.queue_id === params[2]);
        if (q) { q.status = "pending"; q.claimed_at = null; q.claimed_by = null; q.next_attempt_at = params[0]; q.error = params[1]; }
        return R([]);
      }
      if (/^UPDATE nex\.marketing_send_queue SET status='pending', attempts=\$1, claimed_at=NULL, claimed_by=NULL, next_attempt_at=\$2, error=\$3 WHERE queue_id=\$4/i.test(norm)) {
        const q = store.send_queue.find(x => x.queue_id === params[3]);
        if (q) { q.status = "pending"; q.attempts = params[0]; q.next_attempt_at = params[1]; q.error = params[2]; }
        return R([]);
      }
      if (/^UPDATE nex\.marketing_send_queue SET status='sent', sent_at=now\(\), esp_message_id=\$1 WHERE queue_id=\$2/i.test(norm)) {
        const q = store.send_queue.find(x => x.queue_id === params[1]);
        if (q) { q.status = "sent"; q.sent_at = new Date().toISOString(); q.esp_message_id = params[0]; }
        return R([]);
      }
      if (/^UPDATE nex\.marketing_send_queue SET status='failed', attempts=\$1, error=\$2 WHERE queue_id=\$3/i.test(norm)) {
        const q = store.send_queue.find(x => x.queue_id === params[2]);
        if (q) { q.status = "failed"; q.attempts = params[0]; q.error = params[1]; }
        return R([]);
      }
      if (/^UPDATE nex\.marketing_send_queue SET status='failed', error=\$1 WHERE queue_id=\$2/i.test(norm)) {
        const q = store.send_queue.find(x => x.queue_id === params[1]);
        if (q) { q.status = "failed"; q.error = params[0]; }
        return R([]);
      }
      if (/^UPDATE nex\.marketing_send_queue SET status='skipped_opt_out'/i.test(norm) ||
          /^UPDATE nex\.marketing_send_queue SET status='skipped_bounced'/i.test(norm)) {
        const q = store.send_queue.find(x => x.queue_id === params[0]);
        if (q) { q.status = norm.includes("opt_out") ? "skipped_opt_out" : "skipped_bounced"; }
        return R([]);
      }
      if (/^INSERT INTO nex\.marketing_send_queue \(campaign_id, contact_id, email, status\)/i.test(norm)) {
        const [campaign_id, contact_id, email] = params;
        const key = `${campaign_id}:${contact_id}`;
        if (store.send_queue.find(q => q.__key === key)) return { ...R([]), rowCount: 0 };
        store.send_queue.push({ queue_id: nextId("q"), campaign_id, contact_id, email, status: "pending", attempts: 0, next_attempt_at: new Date(0).toISOString(), __key: key });
        return { ...R([]), rowCount: 1 };
      }

      // ─── contact suppression check ───────────────────────────────
      if (/^SELECT opt_out, hard_bounced, complaint_count FROM nex\.marketing_contact WHERE contact_id=\$1/i.test(norm)) {
        const c = store.contacts.find(x => x.contact_id === params[0]);
        return R(c ? [{ opt_out: c.opt_out, hard_bounced: c.hard_bounced, complaint_count: c.complaint_count }] : []);
      }

      // ─── campaign + template load (with metadata) ────────────────
      if (/^SELECT c\.campaign_id, c\.metadata, t\.template_id, t\.subject_line, t\.from_email, t\.from_name, t\.reply_to, t\.html_compiled, t\.text_fallback, t\.variables FROM nex\.marketing_campaign c JOIN nex\.marketing_template t/i.test(norm)) {
        const c = store.campaigns.get(params[0]);
        if (!c) return R([]);
        const t = store.templates.get(c.template_id);
        if (!t) return R([]);
        return R([{
          campaign_id: c.campaign_id, metadata: c.metadata,
          template_id: t.template_id, subject_line: t.subject_line,
          from_email: t.from_email, from_name: t.from_name, reply_to: t.reply_to,
          html_compiled: t.html_compiled, text_fallback: t.text_fallback, variables: t.variables,
        }]);
      }

      // ─── sender lookups ──────────────────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_sender_identity WHERE sender_id=\$1/i.test(norm)) {
        const s = store.senders.get(params[0]);
        return R(s ? [s] : []);
      }
      if (/^SELECT \* FROM nex\.marketing_sender_identity WHERE lane=\$1 AND member_id IS NULL/i.test(norm)) {
        return R([...store.senders.values()].filter(s => s.lane === params[0] && s.member_id === null));
      }
      if (/^SELECT \* FROM nex\.marketing_sender_identity WHERE lane='member' AND member_id=\$1/i.test(norm)) {
        return R([...store.senders.values()].filter(s => s.lane === "member" && s.member_id === params[0]));
      }
      if (/^SELECT window_kind, send_count FROM nex\.marketing_sender_capacity_window/i.test(norm)) {
        return R([]);
      }

      // ─── operating_budget · load by id ──────────────────────────
      if (/^SELECT \* FROM nex\.marketing_operating_budget WHERE budget_id=\$1/i.test(norm)) {
        const b = store.budgets.get(params[0]);
        return R(b ? [b] : []);
      }
      // ─── operating_budget · conditional reserve UPDATE ──────────
      if (/^UPDATE nex\.marketing_operating_budget SET reserved_capacity = reserved_capacity \+ \$1, updated_at = now\(\) WHERE budget_id = \$2 AND status = 'active'/i.test(norm)) {
        const [units, budget_id] = params;
        const b = store.budgets.get(budget_id);
        if (!b || b.status !== "active") return { ...R([]), rowCount: 0 };
        if (b.reserved_capacity + b.consumed_capacity + units > b.purchased_capacity) return { ...R([]), rowCount: 0 };
        b.reserved_capacity += units;
        return { ...R([{ purchased_capacity: b.purchased_capacity, reserved_capacity: b.reserved_capacity, consumed_capacity: b.consumed_capacity }]), rowCount: 1 };
      }
      // ─── operating_budget · rollback reserve ────────────────────
      if (/^UPDATE nex\.marketing_operating_budget SET reserved_capacity = GREATEST\(0, reserved_capacity - \$1\), updated_at = now\(\) WHERE budget_id = \$2/i.test(norm)) {
        const [units, budget_id] = params;
        const b = store.budgets.get(budget_id);
        if (b) b.reserved_capacity = Math.max(0, b.reserved_capacity - units);
        return R([]);
      }
      // ─── operating_budget · consume update ──────────────────────
      if (/^UPDATE nex\.marketing_operating_budget SET reserved_capacity = GREATEST\(0, reserved_capacity - \$1\), consumed_capacity = consumed_capacity \+ \$1, updated_at = now\(\) WHERE budget_id = \$2/i.test(norm)) {
        const [units, budget_id] = params;
        const b = store.budgets.get(budget_id);
        if (b) { b.reserved_capacity = Math.max(0, b.reserved_capacity - units); b.consumed_capacity += units; }
        return R([]);
      }
      // ─── attribution lookups + inserts + updates ───────────────
      if (/^SELECT \* FROM nex\.marketing_operating_budget_attribution WHERE idempotency_key=\$1/i.test(norm)) {
        const a = store.attributions.get(params[0]);
        return R(a ? [a] : []);
      }
      if (/^SELECT \* FROM nex\.marketing_operating_budget_attribution WHERE attribution_id=\$1/i.test(norm)) {
        const a = store.attributions_by_id.get(params[0]);
        return R(a ? [a] : []);
      }
      if (/^INSERT INTO nex\.marketing_operating_budget_attribution/i.test(norm)) {
        const [idempotency_key, budget_id, campaign_id, contact_id, queue_id, units] = [params[0], params[1], params[2], params[3], params[4], params[5]];
        if (store.attributions.get(idempotency_key)) {
          const err: any = new Error("duplicate"); err.code = "23505"; throw err;
        }
        const row = {
          attribution_id: nextId("attr"),
          idempotency_key, budget_id, campaign_id, contact_id, queue_id,
          state: "reserved", units,
          reserved_at: new Date().toISOString(), consumed_at: null, released_at: null, release_reason: null,
        };
        store.attributions.set(idempotency_key, row);
        store.attributions_by_id.set(row.attribution_id, row);
        return R([row]);
      }
      if (/^UPDATE nex\.marketing_operating_budget_attribution SET state = 'consumed', consumed_at = now\(\) WHERE attribution_id = \$1 AND state = 'reserved'/i.test(norm)) {
        const a = store.attributions_by_id.get(params[0]);
        if (!a || a.state !== "reserved") return { ...R([]), rowCount: 0 };
        a.state = "consumed"; a.consumed_at = new Date().toISOString();
        return { ...R([a]), rowCount: 1 };
      }
      if (/^UPDATE nex\.marketing_operating_budget_attribution SET state = 'released', released_at = now\(\), release_reason = \$1 WHERE attribution_id = \$2 AND state = 'reserved'/i.test(norm)) {
        const a = store.attributions_by_id.get(params[1]);
        if (!a || a.state !== "reserved") return { ...R([]), rowCount: 0 };
        a.state = "released"; a.released_at = new Date().toISOString(); a.release_reason = params[0];
        return { ...R([a]), rowCount: 1 };
      }
      // ─── operating_budget_audit inserts ─────────────────────────
      if (/^INSERT INTO nex\.marketing_operating_budget_audit/i.test(norm)) {
        return R([]);
      }

      // ─── send_log inserts ───────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_send_log/i.test(norm)) {
        store.send_logs.push({ params, at: new Date().toISOString() });
        return R([]);
      }

      // ─── campaign counter updates ───────────────────────────────
      if (/^UPDATE nex\.marketing_campaign SET send_count = send_count \+ 1 WHERE campaign_id=\$1/i.test(norm)) {
        const c = store.campaigns.get(params[0]);
        if (c) c.send_count = (c.send_count ?? 0) + 1;
        return R([]);
      }
      if (/^UPDATE nex\.marketing_campaign SET fail_count = fail_count \+ 1 WHERE campaign_id=\$1/i.test(norm)) {
        const c = store.campaigns.get(params[0]);
        if (c) c.fail_count = (c.fail_count ?? 0) + 1;
        return R([]);
      }
      // ─── contact counter update ─────────────────────────────────
      if (/^UPDATE nex\.marketing_contact SET send_count = send_count \+ 1, last_sent_at = now\(\) WHERE contact_id=\$1/i.test(norm)) {
        const c = store.contacts.find(x => x.contact_id === params[0]);
        if (c) { c.send_count = (c.send_count ?? 0) + 1; c.last_sent_at = new Date().toISOString(); }
        return R([]);
      }

      // ─── auto_policy queries ────────────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_auto_policy WHERE policy_id = \$1/i.test(norm)) {
        const p = store.policies.get(params[0]);
        return R(p ? [p] : []);
      }
      if (/^SELECT \* FROM nex\.marketing_auto_policy WHERE is_active = true/i.test(norm)) {
        return R([...store.policies.values()].filter(p => p.is_active));
      }

      // ─── auto campaign create · idempotency lookup ──────────────
      if (/^SELECT campaign_id, metadata FROM nex\.marketing_campaign WHERE COALESCE\(metadata->>'auto_idempotency_key', ''\) = \$1/i.test(norm)) {
        const found = [...store.campaigns.values()].find(c => c.metadata?.auto_idempotency_key === params[0]);
        return R(found ? [{ campaign_id: found.campaign_id, metadata: found.metadata }] : []);
      }

      // ─── auto campaign · template + segment + campaign inserts ──
      if (/^INSERT INTO nex\.marketing_template/i.test(norm)) {
        const [slug, display_name, subject, from_email, mjml, html, text, banner, cta, vars_json, lang] = params;
        const id = nextId("tmpl");
        store.templates.set(id, {
          template_id: id, slug, display_name, subject_line: subject,
          from_email, from_name: null, reply_to: null,
          mjml_source: mjml, html_compiled: html, text_fallback: text,
          banner_image_url: banner, cta_url: cta,
          variables: JSON.parse(vars_json as string), language: lang,
        });
        return R([{ template_id: id }]);
      }
      if (/^INSERT INTO nex\.marketing_segment/i.test(norm)) {
        const [slug, display_name, country, language, category_slug] = params;
        const id = nextId("seg");
        store.segments.set(id, { segment_id: id, slug, display_name, country, language, category_slug });
        return R([{ segment_id: id }]);
      }
      if (/^INSERT INTO nex\.marketing_campaign \(slug, display_name, template_id, segment_id, status, metadata, proposed_at\)/i.test(norm)) {
        const [slug, display_name, template_id, segment_id, metadata_json] = params;
        const id = nextId("camp");
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
        return R([{ campaign_id: id }]);
      }

      // ─── auto campaign approval update ──────────────────────────
      if (/^UPDATE nex\.marketing_campaign SET status = 'approved', approved_at = now\(\), approved_by = 'system:auto', target_count = \$1, started_at = COALESCE\(started_at, now\(\)\) WHERE campaign_id = \$2/i.test(norm)) {
        const [target, campaign_id] = params;
        const c = store.campaigns.get(campaign_id);
        if (!c) return { ...R([]), rowCount: 0 };
        c.status = "approved"; c.approved_at = new Date().toISOString(); c.target_count = target;
        if (!c.started_at) c.started_at = new Date().toISOString();
        return { ...R([]), rowCount: 1 };
      }
      // ─── segment lookup for AUTO populate ───────────────────────
      if (/^SELECT c\.segment_id, c\.metadata FROM nex\.marketing_campaign c WHERE c\.campaign_id = \$1 AND COALESCE\(c\.metadata->>'lane', ''\) = 'auto'/i.test(norm)) {
        const c = store.campaigns.get(params[0]);
        if (!c || c.metadata?.lane !== "auto") return R([]);
        return R([{ segment_id: c.segment_id, metadata: c.metadata }]);
      }
      if (/^SELECT country, category_slug, language FROM nex\.marketing_segment WHERE segment_id = \$1/i.test(norm)) {
        const s = store.segments.get(params[0]);
        return R(s ? [{ country: s.country, category_slug: s.category_slug, language: s.language }] : []);
      }
      if (/^SELECT contact_id, email FROM nex\.marketing_contact WHERE/i.test(norm)) {
        const cols: string[] = [];
        const parts = norm.match(/([a-z_]+) = \$(\d+)/gi) ?? [];
        for (const m of parts) {
          const [, col] = /([a-z_]+) = \$(\d+)/.exec(m) ?? [];
          if (col) cols.push(col);
        }
        const rows = store.contacts.filter(c => {
          if (c.opt_out || c.hard_bounced || c.complaint_count > 0) return false;
          for (let i = 0; i < cols.length; i++) if (c[cols[i]] !== params[i]) return false;
          return true;
        });
        return R(rows.map(x => ({ contact_id: x.contact_id, email: x.email })));
      }

      throw new Error(`stage-5.5 mock: unhandled SQL: ${norm.slice(0, 180)}`);
    },
    release() {},
  } as unknown as PoolClient;

  return {
    store, client,
    seedContact(row: { email: string; country?: string; category_slug?: string; language?: string; opt_out?: boolean; hard_bounced?: boolean; complaint_count?: number }) {
      const c = {
        contact_id: nextId("cnt"), email: row.email,
        country: row.country ?? "US", category_slug: row.category_slug ?? "scaffolding", language: row.language ?? "en",
        opt_out: row.opt_out ?? false, hard_bounced: row.hard_bounced ?? false, complaint_count: row.complaint_count ?? 0,
        send_count: 0, last_sent_at: null,
      };
      store.contacts.push(c);
      return c;
    },
    seedSender(lane: string, opts: { sender_id?: string; email?: string; member_id?: string | null; health_state?: string; authentication_state?: string; hourly_capacity?: number | null; daily_capacity?: number | null } = {}) {
      const id = opts.sender_id ?? nextId("sndr");
      const now = new Date().toISOString();
      const row = {
        sender_id: id, member_id: opts.member_id ?? null, lane,
        email: opts.email ?? `${id}@lane.local`, display_name: null, reply_to: null, sending_domain: null,
        provider: "resend", provider_account_ref: null,
        authentication_state: opts.authentication_state ?? "verified", verification_state: "domain_verified", authentication_expires_at: null,
        daily_capacity: opts.daily_capacity ?? 500, hourly_capacity: opts.hourly_capacity ?? 100,
        capacity_source: "test", capacity_verified_at: now,
        health_state: opts.health_state ?? "healthy", paused_reason: null,
        last_send_at: null, last_event_at: null, last_failure_at: null, last_failure_reason: null,
        bounce_rate: null, complaint_rate: null,
        authorised_at: now, authorised_by: "test", provenance: {},
        created_at: now, updated_at: now,
      };
      store.senders.set(id, row);
      return row;
    },
    seedBudget(overrides: { budget_id?: string; name?: string; purchased?: number; hourly?: number | null; daily?: number | null; status?: string } = {}) {
      const id = overrides.budget_id ?? nextId("budg");
      const row = {
        budget_id: id, name: overrides.name ?? `test-${id}`, display_name: null, purpose: null,
        hourly_capacity: overrides.hourly ?? null, daily_capacity: overrides.daily ?? null, monthly_capacity: null,
        purchased_capacity: overrides.purchased ?? 1000, reserved_capacity: 0, consumed_capacity: 0,
        status: overrides.status ?? "active", paused_reason: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      store.budgets.set(id, row);
      return row;
    },
    seedPolicy(overrides: { policy_id?: string; country?: string; category?: string | null; is_active?: boolean; budget_id?: string; max_daily_sends?: number; min_contact_confidence?: number } = {}) {
      const id = overrides.policy_id ?? nextId("pol");
      const row = {
        policy_id: id, display_name: "Test Policy",
        country: overrides.country ?? "US",
        category: overrides.category === undefined ? null : overrides.category,
        language: null,
        min_contact_confidence: overrides.min_contact_confidence ?? 0.5,
        max_daily_sends: overrides.max_daily_sends ?? 100,
        budget_id: overrides.budget_id ?? "budget-1",
        is_active: overrides.is_active ?? true,
        approved_content_hash: "hash-1",
        last_activated_at: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      store.policies.set(id, row);
      return row;
    },
    seedCampaign(overrides: { campaign_id?: string; template_id: string; segment_id?: string; lane?: string; sender_id?: string; budget_id?: string; member_id?: string | null; policy_id?: string }) {
      const id = overrides.campaign_id ?? nextId("camp");
      const metadata: any = { lane: overrides.lane ?? "unknown", origin: overrides.lane ?? "unknown" };
      if (overrides.sender_id) metadata.sender_id = overrides.sender_id;
      if (overrides.budget_id) metadata.budget_id = overrides.budget_id;
      if (overrides.member_id !== undefined) metadata.member_id = overrides.member_id;
      if (overrides.policy_id) metadata.policy_id = overrides.policy_id;
      const row = {
        campaign_id: id, slug: `slug-${id}`, display_name: `Campaign ${id}`,
        template_id: overrides.template_id, segment_id: overrides.segment_id ?? "seg-x",
        status: "draft", metadata,
        target_count: 0, send_count: 0, fail_count: 0,
        opened_count: 0, clicked_count: 0, bounced_count: 0, complained_count: 0, unsubscribed_count: 0,
        proposed_at: new Date().toISOString(), approved_at: null, approved_by: null,
        started_at: null, completed_at: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      store.campaigns.set(id, row);
      return row;
    },
    seedTemplate(overrides: { template_id?: string; from_email?: string; subject?: string; html?: string } = {}) {
      const id = overrides.template_id ?? nextId("tmpl");
      const row = {
        template_id: id, slug: `slug-${id}`, display_name: "Test template",
        subject_line: overrides.subject ?? "Test subject",
        from_email: overrides.from_email ?? "template-fallback@nex.local",
        from_name: "NEX", reply_to: null,
        mjml_source: "<mjml></mjml>", html_compiled: overrides.html ?? "<html><body>Hello</body></html>",
        text_fallback: "Hello", banner_image_url: null, cta_url: null,
        variables: {}, language: "en",
      };
      store.templates.set(id, row);
      return row;
    },
    enqueue(campaign_id: string, contact_id: string, email: string) {
      const q = { queue_id: nextId("q"), campaign_id, contact_id, email, status: "pending", attempts: 0, next_attempt_at: new Date(0).toISOString(), __key: `${campaign_id}:${contact_id}` };
      store.send_queue.push(q);
      return q;
    },
  };
}

function R(rows: any[]): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] };
}
