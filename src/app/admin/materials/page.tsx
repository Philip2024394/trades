// Admin dashboard for the Materials Application Module (placeholder).
// Deliberately unstyled per Philip 2026-07-28: "Do NOT build beautiful UI.
// Build production architecture. Simple placeholders only."

import Link from "next/link";
import { requireAuth } from "@/lib/nex/brains/_auth";
import { stockSummaryForOwner } from "@/apps/materials/_services/stock";

export const dynamic = "force-dynamic";

export default async function MaterialsDashboardPage() {
  const user = await requireAuth();
  const summary = await stockSummaryForOwner(user.email);

  const totalVolume = summary.reduce((s, r) => s + r.total_volume_m3, 0);
  const totalBoards = summary.reduce((s, r) => s + r.board_count, 0);
  const totalPacks  = summary.reduce((s, r) => s + r.pack_count, 0);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 960 }}>
      <h1 style={{ marginTop: 0 }}>Materials</h1>
      <p style={{ color: "#666" }}>Application Module · Layer 2 · owned by {user.email}</p>

      <nav style={{ margin: "16px 0", padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
        <Link href="/admin/materials/hardwood">Hardwood packs →</Link>
      </nav>

      <h2>Stock summary</h2>
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 8 }}>
        <thead>
          <tr style={{ background: "#eee" }}>
            <th style={cell}>Species</th>
            <th style={cell}>Packs</th>
            <th style={cell}>Boards</th>
            <th style={cell}>Measured</th>
            <th style={cell}>Awaiting</th>
            <th style={cell}>Allocated</th>
            <th style={cell}>Volume (m³)</th>
          </tr>
        </thead>
        <tbody>
          {summary.length === 0 && (
            <tr><td colSpan={7} style={{ ...cell, textAlign: "center", color: "#888" }}>No packs yet</td></tr>
          )}
          {summary.map(r => (
            <tr key={r.species_id}>
              <td style={cell}>{r.species_display_name}</td>
              <td style={cell}>{r.pack_count}</td>
              <td style={cell}>{r.board_count}</td>
              <td style={cell}>{r.measured_board_count}</td>
              <td style={cell}>{r.awaiting_measurement_count}</td>
              <td style={cell}>{r.allocated_count}</td>
              <td style={cell}>{r.total_volume_m3.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#f5f5f5", fontWeight: 600 }}>
            <td style={cell}>Total</td>
            <td style={cell}>{totalPacks}</td>
            <td style={cell}>{totalBoards}</td>
            <td style={cell} colSpan={3} />
            <td style={cell}>{totalVolume.toFixed(4)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const cell: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "6px 10px",
  fontSize: 13,
  textAlign: "left",
};
