// /nex-head-quarters/food-ops/promotion-queue
//
// Task #88 Phase 3 · Promotion queue admin adjudication (2026-08-22).
//
// Doctrine anchors:
//   project_nex_task88_promotion_pipeline_spec_2026_08_22
//   project_nex_task88_phase2_shipped_2026_08_22
//   project_nex_dashboard_singularity_constitutional_rule_2026_08_22
//   project_nex_walker_stays_pure_acquisition_2026_08_22
//
// Philip 2026-08-22 verbatim mental model:
//   · "411 awaiting promotion"
//   · "Each candidate should show: Business → evidence → quality score →
//     source/provenance → current claim status → proposed changes."
//   · "Approve → Listed. Reject → remains discovered + rejection provenance.
//     Leave → remains discovered."
//   · "No Approve All initially."
//   · "Build the queue around the existing promotion primitive."
//   · "The counter becomes the proof: 806/1,217 → 807/1,218."
//
// Read-only server component · defers all admin actions to POST endpoints:
//   · /api/nex-food/admin/promotion/decide           (per-evidence approve/reject/replace · this task)
//   · /api/nex-food/admin/promote-to-directory       (business-level discovered → listed · existing primitive)
//
// SQL scope:
//   Show every discovered business (411 currently) even if it has zero
//   evidence yet — Philip: "Every discovered business should remain visible
//   to the admin pipeline." Rows with pending evidence get grouped with their
//   evidence rows. Rows without evidence still appear so admin can promote
//   solely on Walker discovery when they trust the OSM baseline.

import { getFoodDbPool } from "@/lib/nex-food/db";
import Link from "next/link";
import { PromotionQueueBusinessCard, type BusinessQueueRow, type EvidenceQueueRow } from "./PromotionQueueBusinessCard";
import "../../../nex-app/nex-app.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = { title: "NEX HQ · Food Ops · Promotion Queue" };

interface BusinessRaw {
  business_ref: string;
  business_name: string;
  category: string | null;
  city: string | null;
  district: string | null;
  claim_status: string;
  owner_status: string;
  whatsapp_number: string | null;
  phone: string | null;
  website: string | null;
  public_social_links: Record<string, string> | null;
  quality_score: number | null;
  current_state: string | null;
}

interface EvidenceRaw {
  evidence_id: string;
  business_ref: string;
  field_name: string;
  value: string | null;
  source: string;
  source_type: string;
  source_url: string | null;
  confidence: number;
  agent_name: string;
  discovered_at: Date | string;
  cycle_run_id: string | null;
}

async function loadQueue() {
  const pool = getFoodDbPool();

  // Universe totals (top of page counters).
  const universeQ = await pool.query<{ status: string; count: number }>(`
    SELECT claim_status AS status, COUNT(*)::int AS count
      FROM nex.food_business
     WHERE city='Yogyakarta'
     GROUP BY claim_status
     ORDER BY 2 DESC
  `);
  const byStatus: Record<string, number> = {};
  for (const r of universeQ.rows) byStatus[r.status] = Number(r.count);
  const total     = Object.values(byStatus).reduce((s, n) => s + n, 0);
  const visible   = ["listed","invited","claimed","paying"].reduce((s, k) => s + (byStatus[k] ?? 0), 0);
  const discovered= byStatus.discovered ?? 0;

  // Evidence pending decision (LEFT JOIN decision · surface undecided only ·
  // ALSO filter out evidence whose (biz,field,value) has already been rejected).
  const evidenceQ = await pool.query<EvidenceRaw>(`
    SELECT e.evidence_id, e.business_ref, e.field_name, e.value,
           e.source, e.source_type, e.source_url, e.confidence,
           e.agent_name::text AS agent_name, e.discovered_at,
           NULL::uuid AS cycle_run_id
      FROM nex.food_enrichment_evidence e
     WHERE NOT EXISTS (
             SELECT 1 FROM nex.food_business_promotion_decision d
              WHERE d.evidence_id = e.evidence_id
           )
       AND NOT EXISTS (
             SELECT 1 FROM nex.food_business_promotion_decision r
              WHERE r.decision='rejected'
                AND r.business_ref = e.business_ref
                AND r.field_name   = e.field_name
                AND r.value_normalised = COALESCE(e.value_normalised, lower(e.value))
           )
     ORDER BY e.confidence DESC, e.discovered_at DESC
  `);

  // Businesses in scope: all discovered + any listed that have pending evidence.
  const businessQ = await pool.query<BusinessRaw>(`
    SELECT DISTINCT ON (f.public_listing_ref)
           f.public_listing_ref AS business_ref, f.business_name, f.category,
           f.city, f.district, f.claim_status, f.owner_status,
           f.whatsapp_number, f.phone, f.website, f.public_social_links,
           p.quality_score, p.current_state
      FROM nex.food_business f
      LEFT JOIN nex.food_business_promotion p ON p.business_ref = f.public_listing_ref
     WHERE f.city='Yogyakarta'
       AND f.claim_status='discovered'
     ORDER BY f.public_listing_ref
  `);

  // Group evidence by business_ref.
  const evidenceByBiz = new Map<string, EvidenceRaw[]>();
  for (const e of evidenceQ.rows) {
    const arr = evidenceByBiz.get(e.business_ref) ?? [];
    arr.push(e);
    evidenceByBiz.set(e.business_ref, arr);
  }

  // Recent admin activity (last 20 decisions · shows the counter is moving).
  const recentDecisionsQ = await pool.query<{ id: string; business_ref: string; field_name: string; value: string | null; decision: string; decided_by: string; decided_at: Date; reason: string | null }>(`
    SELECT id, business_ref, field_name, value, decision, decided_by, decided_at, reason
      FROM nex.food_business_promotion_decision
     ORDER BY decided_at DESC
     LIMIT 20
  `);

  return {
    total, visible, discovered,
    byStatus,
    businesses: businessQ.rows,
    evidenceByBiz,
    pendingEvidenceCount: evidenceQ.rowCount ?? 0,
    recentDecisions: recentDecisionsQ.rows,
  };
}

function fmtInt(n: number): string { return n.toLocaleString("en-GB"); }

export default async function PromotionQueuePage() {
  const d = await loadQueue();

  // Sort businesses: those with pending evidence first (higher priority),
  // then by quality_score DESC within each group.
  const businesses: BusinessQueueRow[] = d.businesses
    .map((b) => {
      const evidence: EvidenceQueueRow[] = (d.evidenceByBiz.get(b.business_ref) ?? []).map((e) => ({
        evidenceId:    e.evidence_id,
        fieldName:     e.field_name,
        value:         e.value,
        source:        e.source,
        sourceType:    e.source_type,
        sourceUrl:     e.source_url,
        confidence:    Number(e.confidence),
        agentName:     e.agent_name,
        discoveredAt:  (e.discovered_at instanceof Date ? e.discovered_at : new Date(e.discovered_at)).toISOString(),
      }));
      const currentValues: BusinessQueueRow["currentValues"] = {
        whatsapp_number: b.whatsapp_number,
        phone:           b.phone,
        website:         b.website,
        public_social_links: b.public_social_links ?? {},
      };
      return {
        businessRef:   b.business_ref,
        businessName:  b.business_name,
        category:      b.category,
        city:          b.city,
        district:      b.district,
        claimStatus:   b.claim_status,
        ownerStatus:   b.owner_status,
        qualityScore:  b.quality_score,
        promotionState: b.current_state,
        currentValues,
        evidence,
        pendingEvidenceCount: evidence.length,
      };
    })
    .sort((a, b) => {
      if (a.pendingEvidenceCount !== b.pendingEvidenceCount) return b.pendingEvidenceCount - a.pendingEvidenceCount;
      return (b.qualityScore ?? 0) - (a.qualityScore ?? 0);
    });

  const withEvidence = businesses.filter((b) => b.pendingEvidenceCount > 0).length;
  const withoutEvidence = businesses.length - withEvidence;

  return (
    <div className="nex-app-root" style={rootStyle}>
      {/* ── Header ── */}
      <header style={headerStyle}>
        <div style={eyebrowStyle}>NEX HQ · FOOD OPS · PROMOTION QUEUE</div>
        <h1 style={h1Style}>Promotion Queue · Human Adjudication Gate</h1>
        <div style={subEyebrowStyle}>
          Every candidate is untrusted until an admin explicitly approves it. Approve is field-specific.
          Reject writes permanent <code>admin_rejected</code> provenance so agents cannot re-suggest the same value.
          Every admin action carries its own <code>cycle_run_id</code> (Direct-Provenance A).
          The customer directory advances when you click <em>Promote to Directory</em> · never automatically.
        </div>
      </header>

      {/* ── Counters (Philip's proof metric: 806 / 1,217 → 807 / 1,218) ── */}
      <section style={sectionStyle}>
        <div style={cardsGridStyle}>
          <Card label="Universe · total"           value={fmtInt(d.total)}      sub="all food_business rows in Yogyakarta" />
          <Card label="Visible on /food"           value={fmtInt(d.visible)}    sub="listed / invited / claimed / paying" tone="success" />
          <Card label="Awaiting promotion"         value={fmtInt(d.discovered)} sub="claim_status='discovered' · this queue" tone="warning" />
          <Card label="Pending evidence"           value={fmtInt(d.pendingEvidenceCount)} sub="undecided enrichment rows" />
          <Card label="Businesses with evidence"   value={fmtInt(withEvidence)} sub={`${withoutEvidence} discovered without any evidence yet`} />
          <Card label="Recent admin decisions"     value={fmtInt(d.recentDecisions.length)} sub="last 20 shown at page bottom" />
        </div>
      </section>

      {/* ── Adjudication list · one card per discovered business ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>
          Adjudication queue · {fmtInt(businesses.length)} discovered businesses ·
          {fmtInt(withEvidence)} with evidence · sorted by pending-evidence count then quality score
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {businesses.length === 0 && (
            <div style={panelStyle}>
              <div style={{ padding: 16, color: "var(--nex-neutral-500)" }}>
                No discovered businesses in the queue. Walker has nothing waiting for admin decision.
              </div>
            </div>
          )}
          {businesses.slice(0, 100).map((biz) => (
            <PromotionQueueBusinessCard key={biz.businessRef} business={biz} />
          ))}
          {businesses.length > 100 && (
            <div style={{ ...panelStyle, textAlign: "center", color: "var(--nex-neutral-500)", fontSize: 12 }}>
              Showing first 100 of {fmtInt(businesses.length)} discovered businesses. Adjudicate top rows first ·
              queue re-sorts on refresh as evidence lands and decisions are made.
            </div>
          )}
        </div>
      </section>

      {/* ── Recent decisions · audit trail visible on the queue itself ── */}
      <section style={sectionStyle}>
        <div style={sectionLabelStyle}>Recent decisions · last 20 · full audit in nex.audit_log</div>
        <div style={panelStyle}>
          {d.recentDecisions.length === 0 ? (
            <div style={{ color: "var(--nex-neutral-500)", padding: 8 }}>No admin decisions yet.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>When</th>
                  <th style={thStyle}>Business</th>
                  <th style={thStyle}>Field</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Decision</th>
                  <th style={thStyle}>By</th>
                </tr>
              </thead>
              <tbody>
                {d.recentDecisions.map((r) => (
                  <tr key={r.id}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{new Date(r.decided_at).toLocaleString("en-GB", { hour12: false })}</td>
                    <td style={tdStyle}>{r.business_ref}</td>
                    <td style={tdStyle}>{r.field_name}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{r.value ?? "—"}</td>
                    <td style={tdStyle}>{decisionBadge(r.decision)}</td>
                    <td style={{ ...tdStyle, color: "var(--nex-neutral-500)" }}>{r.decided_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Footer · doctrine anchors ── */}
      <footer style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--nex-neutral-200)", fontSize: 10, color: "var(--nex-neutral-500)", lineHeight: 1.6 }}>
        <div>Every counter above is a live COUNT(*) against nex · zero mocked · zero LLM · zero fabricated.</div>
        <div>Every approve writes to food_business.&lt;field&gt; + food_business_field_provenance (trust_layer='admin_verified') + food_business_promotion_decision · every write stamped with the admin action's cycle_run_id.</div>
        <div>Every reject writes food_business_promotion_decision (decision='rejected') · queue view suppresses future evidence with the same (business, field, value).</div>
        <div>The customer directory <Link href="/food" style={{ color: "#c2410c" }}>/food</Link> only changes when you click <em>Promote to Directory</em> · Walker cannot promote itself.</div>
      </footer>
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "warning" | "neutral" }) {
  const toneColor = tone === "success" ? "#047857" : tone === "warning" ? "#a16207" : "var(--nex-neutral-900)";
  return (
    <div style={miniCardStyle}>
      <div style={miniCardLabelStyle}>{label}</div>
      <div style={{ ...miniCardValueStyle, color: toneColor }}>{value}</div>
      {sub && <div style={miniCardSubStyle}>{sub}</div>}
    </div>
  );
}

function decisionBadge(decision: string) {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    approved: { color: "#047857", bg: "rgba(16,185,129,0.12)", label: "APPROVED" },
    replaced: { color: "#0369a1", bg: "rgba(2,132,199,0.12)",  label: "REPLACED" },
    rejected: { color: "#b91c1c", bg: "rgba(220,38,38,0.10)",  label: "REJECTED" },
  };
  const s = map[decision] ?? map.rejected;
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: 0.6 }}>
      {s.label}
    </span>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const rootStyle: React.CSSProperties = { padding: "24px 32px", background: "var(--nex-cream)", minHeight: "100vh", color: "var(--nex-neutral-900)" };
const headerStyle: React.CSSProperties = { marginBottom: 24 };
const eyebrowStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700 };
const subEyebrowStyle: React.CSSProperties = { fontSize: 12, color: "var(--nex-neutral-500)", marginTop: 6, lineHeight: 1.55, maxWidth: 900 };
const h1Style: React.CSSProperties = { fontSize: 26, fontWeight: 800, margin: "6px 0 4px 0" };
const sectionStyle: React.CSSProperties = { marginTop: 22 };
const sectionLabelStyle: React.CSSProperties = { fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700, marginBottom: 8 };
const cardsGridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 };
const miniCardStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 10, padding: "12px 14px" };
const miniCardLabelStyle: React.CSSProperties = { fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "var(--nex-neutral-500)", fontWeight: 700 };
const miniCardValueStyle: React.CSSProperties = { fontSize: 22, fontWeight: 800, marginTop: 4 };
const miniCardSubStyle: React.CSSProperties = { fontSize: 11, color: "var(--nex-neutral-500)", marginTop: 4, lineHeight: 1.35 };
const panelStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "12px 16px", overflowX: "auto" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const thStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", padding: "8px 8px 8px 0", textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid var(--nex-neutral-200)" };
const tdStyle: React.CSSProperties = { color: "var(--nex-neutral-900)", padding: "8px 8px 8px 0", verticalAlign: "top", borderTop: "1px solid var(--nex-neutral-100)" };
