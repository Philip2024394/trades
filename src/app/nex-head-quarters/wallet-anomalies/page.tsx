// src/app/nex-head-quarters/wallet-anomalies/page.tsx · Philip 2026-08-29
//
// HQ pane · WALLET_UNDERFUNDED events.
//
// When a provider slips past the eligibility gate and their wallet cannot
// cover the network fee at completion time, completeRequest() writes an
// `adjustment` row noting WALLET_UNDERFUNDED and completes the service
// anyway (customer is never abandoned). This pane surfaces those rows for
// operator review so we can collect the missing fee out-of-band or write
// it off.
//
// Read-only server component. Direct DB query. No new API surface.

import { getMobilityPool } from "@/lib/nex-mobility/pool";

export const dynamic = "force-dynamic";

interface AnomalyRow {
  transaction_id: string;
  provider_id: string;
  provider_name: string | null;
  provider_plate: string | null;
  provider_city: string | null;
  request_id: string;
  destination_text: string | null;
  price_agreed_idr: number | null;
  network_fee_idr: number | null;
  balance_at_time_idr: number;
  note: string;
  created_at: string;
}

async function loadAnomalies(limit = 200): Promise<AnomalyRow[]> {
  const pool = getMobilityPool();
  const { rows } = await pool.query(
    `SELECT t.transaction_id,
            t.provider_id,
            p.full_name              AS provider_name,
            p.plate                  AS provider_plate,
            p.city                   AS provider_city,
            t.related_request_id     AS request_id,
            r.destination_text,
            r.price_agreed_idr,
            r.network_fee_idr,
            t.balance_after_idr      AS balance_at_time_idr,
            t.note,
            t.created_at
     FROM nex.provider_wallet_transaction t
     LEFT JOIN nex.provider_profile p ON p.provider_id = t.provider_id
     LEFT JOIN nex.service_request r  ON r.request_id  = t.related_request_id
     WHERE t.kind = 'adjustment'
       AND t.note LIKE 'WALLET_UNDERFUNDED%'
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows as AnomalyRow[];
}

function fmtIdr(n: number | null | undefined): string {
  if (n == null) return "—";
  return "Rp " + Number(n).toLocaleString("id-ID");
}
function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default async function WalletAnomaliesPage() {
  const rows = await loadAnomalies();
  const uniqueProviders = new Set(rows.map((r) => r.provider_id)).size;
  const totalOwed = rows.reduce((sum, r) => sum + Number(r.network_fee_idr ?? 0), 0);

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
      <div style={{
        fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase",
        color: "#dc2626", fontWeight: 800, marginBottom: 4,
      }}>HQ · Wallet anomalies</div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.3, color: "#111827" }}>
        Providers who slipped past the wallet gate
      </h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8, marginBottom: 24, lineHeight: 1.55, maxWidth: 720 }}>
        Every row is a completed service where the provider&apos;s wallet could
        not cover the 8% network fee at completion time. The customer&apos;s
        service was honoured; NEX did NOT deduct because the balance was
        already below the fee. These are operator follow-ups &mdash; collect
        the missing fee out-of-band, or write it off.
      </p>

      {/* Summary strip */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12, marginBottom: 24,
      }}>
        <SummaryStat label="Open anomalies" value={rows.length.toString()} />
        <SummaryStat label="Distinct providers" value={uniqueProviders.toString()} />
        <SummaryStat label="Uncollected fees (est.)" value={fmtIdr(totalOwed)} />
      </div>

      {rows.length === 0 ? (
        <div style={{
          padding: "40px 24px", textAlign: "center",
          background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12,
          color: "#166534", fontSize: 14, fontWeight: 600,
        }}>
          No wallet anomalies. Every completed service was covered by the
          provider&apos;s wallet or the monthly allowance.
        </div>
      ) : (
        <div style={{
          background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12,
          overflow: "hidden",
        }}>
          <table style={{
            width: "100%", borderCollapse: "collapse", fontSize: 13,
          }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <Th>When</Th>
                <Th>Provider</Th>
                <Th>Destination</Th>
                <Th align="right">Price</Th>
                <Th align="right">Fee owed</Th>
                <Th align="right">Balance</Th>
                <Th align="right">Shortfall</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const shortfall = Number(r.network_fee_idr ?? 0) - Number(r.balance_at_time_idr);
                return (
                  <tr key={r.transaction_id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <Td>
                      <div style={{ color: "#111827", fontWeight: 500 }}>{fmtWhen(r.created_at)}</div>
                    </Td>
                    <Td>
                      <div style={{ color: "#111827", fontWeight: 600 }}>{r.provider_name ?? "—"}</div>
                      <div style={{ color: "#6b7280", fontSize: 11, marginTop: 2 }}>
                        {r.provider_city ?? ""}
                        {r.provider_plate ? ` · ${r.provider_plate}` : ""}
                      </div>
                    </Td>
                    <Td>
                      <div style={{ color: "#111827" }}>{r.destination_text ?? "—"}</div>
                      <div style={{ color: "#6b7280", fontSize: 10, marginTop: 2, fontFamily: "monospace" }}>
                        req {r.request_id.slice(0, 8)}…
                      </div>
                    </Td>
                    <Td align="right"><Tabular>{fmtIdr(r.price_agreed_idr)}</Tabular></Td>
                    <Td align="right"><Tabular>{fmtIdr(r.network_fee_idr)}</Tabular></Td>
                    <Td align="right"><Tabular>{fmtIdr(r.balance_at_time_idr)}</Tabular></Td>
                    <Td align="right">
                      <Tabular color="#b91c1c" weight={700}>
                        {shortfall > 0 ? fmtIdr(shortfall) : "—"}
                      </Tabular>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 24, fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
        Data queried live from nex.provider_wallet_transaction · WALLET_UNDERFUNDED
        adjustment rows only · newest first · max 200.
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: "14px 16px",
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
        color: "#6b7280", fontWeight: 700, marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 22, fontWeight: 800, color: "#111827",
        letterSpacing: -0.3, fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
    </div>
  );
}
function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      padding: "10px 14px", textAlign: align,
      fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase",
      fontWeight: 700, color: "#6b7280",
    }}>{children}</th>
  );
}
function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td style={{ padding: "10px 14px", verticalAlign: "top", textAlign: align, color: "#111827" }}>
      {children}
    </td>
  );
}
function Tabular({ children, color, weight }: { children: React.ReactNode; color?: string; weight?: number }) {
  return (
    <span style={{ fontVariantNumeric: "tabular-nums", color, fontWeight: weight }}>
      {children}
    </span>
  );
}
