// NEX HQ · Transport Data · subordinate operational page (2026-08-23).
//
// Shows LIVE counts from nex.transport_acquisition_record + source snapshots +
// worker_cycle_run for the Transport Walker. This is a data-visibility page ·
// NOT a driver dashboard · NOT a recruitment surface · NOT another HQ.
//
// Doctrine anchors:
//   · Dashboard Singularity · one HQ · this is a subordinate drill-down.
//   · Two Universes doctrine · DISCOVERED ≠ CANDIDATE ≠ REGISTERED ≠ VERIFIED
//     ≠ ACTIVE. The columns render honest state buckets · never conflate.
//   · Public-Contact-Only rule preserved by upstream schema CHECK.
//   · Zero automatic outreach · this page does not initiate any communication.

import Link from "next/link";
import { getFoodDbPool } from "@/lib/nex-food/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CATEGORY_ROWS: { key: string; emoji: string; label: string }[] = [
  { key: "motorcycle",         emoji: "🏍️", label: "Motorbike" },
  { key: "car",                emoji: "🚗", label: "Car" },
  { key: "taxi",               emoji: "🚕", label: "Taxi" },
  { key: "courier",            emoji: "📦", label: "Courier / Delivery" },
  { key: "pickup",             emoji: "🛻", label: "Pickup" },
  { key: "small_truck",        emoji: "🚚", label: "Small truck" },
  { key: "truck",              emoji: "🚛", label: "Truck / Lorry" },
  { key: "lorry",              emoji: "🚛", label: "Lorry" },
  { key: "van",                emoji: "🚐", label: "Van" },
  { key: "minibus",            emoji: "🚐", label: "Minibus" },
  { key: "bus",                emoji: "🚌", label: "Bus" },
  { key: "airport_transfer",   emoji: "✈️", label: "Airport transfer" },
  { key: "tourist_driver",     emoji: "🗺️", label: "Tourist driver" },
  { key: "logistics_operator", emoji: "📦", label: "Logistics operator" },
];

const STAGES_ACTIVE   = ["active"];
const STAGES_VERIFIED = ["verified"];

interface CategoryRow {
  vehicleKind: string;
  discovered: number;
  contactable: number;
  withWhatsapp: number;
  verified: number;
  active: number;
}

interface CycleRow {
  cycleId: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  processed: number | null;
  persisted: number | null;
  errors: number;
  durationS: number | null;
}

async function loadCategoryRows(): Promise<CategoryRow[]> {
  const pool = getFoodDbPool();
  if (!pool) return [];
  const q = await pool.query(`
    WITH exploded AS (
      SELECT
        r.provider_id,
        r.discovery_stage,
        r.contactability,
        r.public_whatsapp_link,
        v AS vehicle_kind
      FROM nex.transport_acquisition_record r,
           unnest(r.vehicle_types) AS v
    )
    SELECT
      vehicle_kind,
      count(*)                                                         AS discovered,
      count(*) FILTER (WHERE contactability = 'contactable')            AS contactable,
      count(*) FILTER (WHERE public_whatsapp_link IS NOT NULL)          AS with_whatsapp,
      count(*) FILTER (WHERE discovery_stage::text = ANY ($1::text[]))        AS verified,
      count(*) FILTER (WHERE discovery_stage::text = ANY ($2::text[]))        AS active
    FROM exploded
    GROUP BY vehicle_kind
    ORDER BY discovered DESC
  `, [STAGES_VERIFIED, STAGES_ACTIVE]);

  return q.rows.map((r: Record<string, unknown>) => ({
    vehicleKind: String(r.vehicle_kind),
    discovered:   Number(r.discovered),
    contactable:  Number(r.contactable),
    withWhatsapp: Number(r.with_whatsapp),
    verified:     Number(r.verified),
    active:       Number(r.active),
  }));
}

async function loadTotals(): Promise<{
  totalRecords: number;
  newToday: number;
  outreachSent: number;
  duplicatePhones: number;
}> {
  const pool = getFoodDbPool();
  if (!pool) return { totalRecords: 0, newToday: 0, outreachSent: 0, duplicatePhones: 0 };
  const r = await pool.query(`
    SELECT
      (SELECT count(*) FROM nex.transport_acquisition_record) AS total_records,
      (SELECT count(*) FROM nex.transport_acquisition_record WHERE first_discovered_at >= date_trunc('day', now())) AS new_today,
      (SELECT count(*) FROM nex.transport_acquisition_outreach) AS outreach_sent,
      (SELECT count(*) FROM (
         SELECT canonical_phone_e164 FROM nex.transport_acquisition_record
         WHERE canonical_phone_e164 IS NOT NULL
         GROUP BY canonical_phone_e164 HAVING count(*) > 1
       ) d) AS duplicate_phones
  `);
  const row = r.rows[0] as Record<string, unknown>;
  return {
    totalRecords:    Number(row.total_records),
    newToday:        Number(row.new_today),
    outreachSent:    Number(row.outreach_sent),
    duplicatePhones: Number(row.duplicate_phones),
  };
}

async function loadRecentCycles(): Promise<CycleRow[]> {
  const pool = getFoodDbPool();
  if (!pool) return [];
  const q = await pool.query(`
    SELECT id, started_at, finished_at, status,
           records_processed, records_new, errors_count, duration_ms
      FROM nex.worker_cycle_run
     WHERE worker_id = 'acquisition:transport:Yogyakarta'
     ORDER BY started_at DESC
     LIMIT 10
  `);
  return q.rows.map((r: Record<string, unknown>) => ({
    cycleId:     String(r.id),
    startedAt:   String(r.started_at),
    finishedAt:  r.finished_at ? String(r.finished_at) : null,
    status:      String(r.status),
    processed:   r.records_processed == null ? null : Number(r.records_processed),
    persisted:   r.records_new == null ? null : Number(r.records_new),
    errors:      Number(r.errors_count),
    durationS:   r.duration_ms == null ? null : Math.round(Number(r.duration_ms) / 1000),
  }));
}

export default async function TransportDataPage(): Promise<React.JSX.Element> {
  const [categoryRows, totals, cycles] = await Promise.all([
    loadCategoryRows(),
    loadTotals(),
    loadRecentCycles(),
  ]);
  const rowFor = (key: string) => categoryRows.find((r) => r.vehicleKind === key);
  const lastCycle = cycles[0] ?? null;
  const lastSuccess = cycles.find((c) => c.status === "completed" && (c.persisted ?? 0) > 0);

  return (
    <div className="nex-app-root" style={{ padding: 32, maxWidth: 1400, margin: "0 auto" }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: 1, color: "#8a8776", marginBottom: 6 }}>
            NEX HQ · Subordinate view
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Transport Discovery</h1>
          <div style={{ marginTop: 8, color: "#666", fontSize: 14 }}>
            Publicly-advertised transport supply discovered by the Transport Walker.
            <strong style={{ marginLeft: 8, color: "#a52020" }}>Discovered ≠ Candidate ≠ Registered ≠ Verified ≠ Active.</strong>
          </div>
        </div>
        <span style={{ padding: "8px 14px", background: "#f4f1eb", color: "#8a8776", border: "1px dashed #ccc", borderRadius: 999, fontSize: 12, whiteSpace: "nowrap" }}>
          No live customer transport page yet · Stage-B locked
        </span>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <MetricCard label="Total records" value={totals.totalRecords} />
        <MetricCard label="New today" value={totals.newToday} />
        <MetricCard label="Duplicate phones dedupd" value={totals.duplicatePhones} />
        <MetricCard label="Automated outreach sent" value={totals.outreachSent} note={totals.outreachSent === 0 ? "0 · doctrine holds" : "unexpected · investigate"} noteAccent={totals.outreachSent === 0 ? "ok" : "warn"} />
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Category breakdown</h2>
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #eee", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#fafafa", textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: "10px 14px" }}>Category</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Discovered</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Contactable</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>WhatsApp-capable</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Verified</th>
                <th style={{ padding: "10px 14px", textAlign: "right" }}>Active</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORY_ROWS.map((cat) => {
                const r = rowFor(cat.key);
                return (
                  <tr key={cat.key} style={{ borderBottom: "1px solid #f4f4f4" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ marginRight: 8 }}>{cat.emoji}</span>
                      {cat.label}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{r?.discovered ?? "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{r?.contactable ?? "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{r?.withWhatsapp ?? "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: r?.verified ? "#1f6b1f" : "#aaa" }}>{r?.verified ?? "—"}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: r?.active ? "#1f6b1f" : "#aaa" }}>{r?.active ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: "#8a8776" }}>
          Dashes mean NEX has not discovered any record for that category yet · not zero supply. Verified + Active require voluntary registration + KYC + vehicle + insurance + approved legal model. Currently both columns are zero across all categories by design · Stage-B remains locked.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Discovery cycles</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
          <MetricCard label="Last cycle status" value={lastCycle?.status ?? "—"} note={lastCycle?.startedAt ? new Date(lastCycle.startedAt).toISOString().slice(0, 19) + "Z" : ""} />
          <MetricCard label="Last successful cycle" value={lastSuccess?.startedAt ? new Date(lastSuccess.startedAt).toISOString().slice(0, 19) + "Z" : "none"} />
          <MetricCard label="Cycles in last 10" value={cycles.length} />
        </div>
        <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #eee", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#fafafa", textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: "8px 12px" }}>Started</th>
                <th style={{ padding: "8px 12px" }}>Status</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Duration (s)</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Processed</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>New</th>
                <th style={{ padding: "8px 12px", textAlign: "right" }}>Errors</th>
              </tr>
            </thead>
            <tbody>
              {cycles.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "14px 12px", color: "#8a8776" }}>No Transport Walker cycles recorded yet.</td></tr>
              )}
              {cycles.map((c) => (
                <tr key={c.cycleId} style={{ borderBottom: "1px solid #f4f4f4" }}>
                  <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{new Date(c.startedAt).toISOString().slice(0, 19)}Z</td>
                  <td style={{ padding: "8px 12px", color: c.status === "completed" ? "#1f6b1f" : c.status === "failed" ? "#a52020" : "#666" }}>{c.status}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{c.durationS ?? "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{c.processed ?? "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right" }}>{c.persisted ?? "—"}</td>
                  <td style={{ padding: "8px 12px", textAlign: "right", color: c.errors > 0 ? "#a52020" : "#666" }}>{c.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Doctrine boundary</h2>
        <ul style={{ fontSize: 13, lineHeight: 1.6, color: "#333", paddingLeft: 18 }}>
          <li>🟢 Public-source only (schema CHECK <code>source_kind_must_be_public</code>)</li>
          <li>🟢 Discovery only · all rows enter at <code>discovered</code></li>
          <li>🟢 Zero automatic outreach · <code>transport_acquisition_outreach</code> ledger untouched</li>
          <li>🟢 Zero real dispatch · Stage-B triple-gated · legal model still <code>researching</code></li>
          <li>🟢 Zero real money movement</li>
          <li>🟢 One dashboard rule preserved · this is a subordinate HQ page</li>
        </ul>
      </section>

      <p style={{ fontSize: 12, color: "#8a8776" }}>
        <Link href="/nex-head-quarters" style={{ color: "#8a8776", textDecoration: "underline" }}>← back to NEX Reception</Link>
      </p>
    </div>
  );
}

function MetricCard({ label, value, note, noteAccent }: {
  label: string;
  value: string | number;
  note?: string;
  noteAccent?: "ok" | "warn" | "muted";
}): React.JSX.Element {
  const noteColor = noteAccent === "ok" ? "#1f6b1f" : noteAccent === "warn" ? "#a52020" : "#8a8776";
  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: 0.6, color: "#8a8776", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
      {note && <div style={{ marginTop: 4, fontSize: 11, color: noteColor }}>{note}</div>}
    </div>
  );
}
