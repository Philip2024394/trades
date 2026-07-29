// Hardwood packs list (placeholder admin UI).

import Link from "next/link";
import { requireAuth } from "@/lib/nex/brains/_auth";
import { listPacks } from "@/apps/materials/_services/packs";

export const dynamic = "force-dynamic";

export default async function HardwoodPacksPage() {
  const user = await requireAuth();
  const packs = await listPacks(user.email);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1100 }}>
      <p><Link href="/admin/materials">← Materials</Link></p>
      <h1 style={{ marginTop: 0 }}>Hardwood packs</h1>
      <p style={{ color: "#666" }}>Placeholder UI · {packs.length} pack{packs.length === 1 ? "" : "s"}</p>

      <div style={{ marginTop: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
        <strong>Create new pack</strong> — currently only via API:
        <pre style={{ background: "#fff", padding: 8, marginTop: 8, fontSize: 12, overflow: "auto" }}>
{`curl -X POST /api/materials/packs \\
  -H "Content-Type: application/json" \\
  -d '{"pack_ref":"PACK-2026-042","species_id":"oak_american_white","board_count_expected":60}'`}
        </pre>
      </div>

      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
        <thead>
          <tr style={{ background: "#eee" }}>
            <th style={cell}>Pack ref</th>
            <th style={cell}>Species</th>
            <th style={cell}>Status</th>
            <th style={cell}>Expected boards</th>
            <th style={cell}>Purchase date</th>
            <th style={cell}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {packs.length === 0 && (
            <tr><td colSpan={6} style={{ ...cell, textAlign: "center", color: "#888" }}>No packs yet</td></tr>
          )}
          {packs.map(p => (
            <tr key={p.id}>
              <td style={cell}>{p.pack_ref}</td>
              <td style={cell}>{p.species_id}</td>
              <td style={cell}><StatusBadge status={p.status} /></td>
              <td style={cell}>{p.board_count_expected ?? "—"}</td>
              <td style={cell}>{p.purchase_date ?? "—"}</td>
              <td style={cell}>
                <Link href={`/admin/materials/hardwood/packs/${p.id}`}>Open →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colours: Record<string, string> = {
    pending:   "#999",
    measuring: "#c88900",
    complete:  "#0a7a2f",
    allocated: "#1155cc",
    consumed:  "#666",
    retired:   "#aaa",
  };
  return (
    <span style={{
      background: colours[status] ?? "#666",
      color: "white",
      padding: "2px 8px",
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
    }}>{status}</span>
  );
}

const cell: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "6px 10px",
  fontSize: 13,
  textAlign: "left",
};
