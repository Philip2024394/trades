// Walker Findings section for Food Ops page · cream theme.
// Reuses the promote-to-directory API route already shipped.

import { getFoodDbPool } from "@/lib/nex-food/db";
import { PromoteButton } from "./PromoteButton";

interface Row {
  public_listing_ref: string;
  business_name: string;
  category: string;
  address: string | null;
  whatsapp_number: string | null;
  phone: string | null;
  website: string | null;
  source: string;
  source_reference: string | null;
  provenance_rows_owner_verified: number;
}

async function load() {
  const pool = getFoodDbPool();
  const r = await pool.query<Row>(`
    SELECT
      b.public_listing_ref, b.business_name, b.category, b.address,
      b.whatsapp_number, b.phone, b.website, b.source, b.source_reference,
      COALESCE((SELECT count(*)::int FROM nex.food_business_field_provenance p WHERE p.business_ref = b.public_listing_ref AND p.trust_layer = 'owner_verified'), 0) AS provenance_rows_owner_verified
    FROM nex.food_business b
    WHERE b.claim_status = 'discovered'
    ORDER BY b.source_ingested_at DESC
    LIMIT 200
  `);
  const rows = r.rows.map((row) => {
    const hasContact = Boolean(row.whatsapp_number) || Boolean(row.phone);
    const eligibility = hasContact ? "READY_TO_PROMOTE" : "OWNER_CLAIM_PREFERRED";
    return { ...row, eligibility };
  });
  const counts = { READY_TO_PROMOTE: 0, OWNER_CLAIM_PREFERRED: 0 };
  for (const r of rows) counts[r.eligibility as keyof typeof counts]++;
  return { rows, counts };
}

export async function FoodOpsWalkerFindings() {
  const d = await load();
  return (
    <div>
      <div style={countsRowStyle}>
        <div style={countTileStyle("green")}>
          <div style={countStyle}>{d.counts.READY_TO_PROMOTE}</div>
          <div style={countLabelStyle}>Ready to promote · has contact</div>
        </div>
        <div style={countTileStyle("blue")}>
          <div style={countStyle}>{d.counts.OWNER_CLAIM_PREFERRED}</div>
          <div style={countLabelStyle}>Owner claim preferred · no contact</div>
        </div>
      </div>

      <div style={doctrineNoteStyle}>
        <strong style={{ color: "var(--nex-accent-700)" }}>DOCTRINE:</strong> Walker
        discoveries are NOT auto-published. Only admin promotion (here) or owner
        claim via /food/register moves a record into the public Food Directory.
        Every promotion writes to audit_log · owner_verified fields untouched ·
        no fabrication.
      </div>

      {d.rows.length === 0 ? (
        <div style={mutedStyle}>No discovered records pending. Walker either hasn&apos;t run recently, or every discovery has been promoted/claimed.</div>
      ) : (
        <div style={panelStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Ref</th>
                <th style={thStyle}>Business</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Location</th>
                <th style={thStyle}>Contact</th>
                <th style={thStyle}>Website</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Action</th>
              </tr>
            </thead>
            <tbody>
              {d.rows.map((r) => (
                <tr key={r.public_listing_ref}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11 }}>{r.public_listing_ref}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {r.business_name}
                    {r.provenance_rows_owner_verified > 0 && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: "#047857" }}>owner_verified</span>
                    )}
                  </td>
                  <td style={tdStyle}>{r.category}</td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>{r.address ?? "—"}</td>
                  <td style={{ ...tdStyle, fontSize: 11, fontFamily: "monospace" }}>
                    {r.whatsapp_number && <div>wa: {r.whatsapp_number}</div>}
                    {r.phone && <div>tel: {r.phone}</div>}
                    {!r.whatsapp_number && !r.phone && <span style={{ opacity: 0.5 }}>(none)</span>}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 11 }}>
                    {r.website ? (
                      <a href={r.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--nex-accent-600)" }}>
                        {r.website.replace(/^https?:\/\//, "").slice(0, 30)}
                      </a>
                    ) : <span style={{ opacity: 0.5 }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 10 }}>
                    <div>{r.source}</div>
                    <div style={{ color: "var(--nex-neutral-500)" }}>{r.source_reference ?? "—"}</div>
                  </td>
                  <td>
                    {r.eligibility === "READY_TO_PROMOTE" ? (
                      <PromoteButton publicListingRef={r.public_listing_ref} />
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--nex-neutral-500)" }}>await owner claim</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const countsRowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 12 };
function countTileStyle(color: "green" | "blue"): React.CSSProperties {
  const map = { green: "rgba(16, 185, 129, 0.45)", blue: "rgba(59, 130, 246, 0.40)" };
  return { background: "var(--nex-neutral-0)", border: `1px solid ${map[color]}`, borderRadius: 12, padding: "14px 14px" };
}
const countStyle: React.CSSProperties = { fontSize: 26, fontWeight: 800, color: "var(--nex-neutral-900)" };
const countLabelStyle: React.CSSProperties = { fontSize: 12, color: "var(--nex-neutral-700)", fontWeight: 600, marginTop: 4 };
const doctrineNoteStyle: React.CSSProperties = { padding: "12px 14px", borderRadius: 10, background: "rgba(249, 115, 22, 0.06)", border: "1px solid rgba(249, 115, 22, 0.25)", fontSize: 12, color: "var(--nex-neutral-800)", lineHeight: 1.55, marginBottom: 12 };
const panelStyle: React.CSSProperties = { background: "var(--nex-neutral-0)", border: "1px solid var(--nex-neutral-200)", borderRadius: 12, padding: "12px 16px", overflowX: "auto" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const thStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", padding: "8px 8px 8px 0", textAlign: "left", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid var(--nex-neutral-200)" };
const tdStyle: React.CSSProperties = { color: "var(--nex-neutral-900)", padding: "10px 8px 10px 0", verticalAlign: "top", borderTop: "1px solid var(--nex-neutral-100)" };
const mutedStyle: React.CSSProperties = { color: "var(--nex-neutral-500)", fontSize: 13, padding: "16px", textAlign: "center", background: "var(--nex-neutral-0)", border: "1px dashed var(--nex-neutral-200)", borderRadius: 12 };
