// Pack detail (placeholder admin UI).
// Shows pack info + boards table + existing worker links.

import Link from "next/link";
import { requireAuth } from "@/lib/nex/brains/_auth";
import { getPack } from "@/apps/materials/_services/packs";
import { getProvider } from "@/apps/materials/_providers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ packId: string }> };

export default async function PackDetailPage({ params }: Ctx) {
  const { packId } = await params;
  const user = await requireAuth();
  const pack = await getPack(user.email, packId);
  const provider = getProvider("hardwood");
  const packVolumeM3 = provider.computePackVolumeM3(pack);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 1200 }}>
      <p><Link href="/admin/materials/hardwood">← Hardwood packs</Link></p>
      <h1 style={{ marginTop: 0 }}>Pack {pack.pack_ref}</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
        <div style={panel}>
          <h3 style={h3}>Pack</h3>
          <dl style={dl}>
            <dt>Species</dt><dd>{pack.species.display_name}</dd>
            <dt>Status</dt><dd>{pack.status}</dd>
            <dt>Progress</dt><dd>{provider.packProgressLabel(pack)}</dd>
            <dt>Volume</dt><dd>{packVolumeM3.toFixed(4)} m³</dd>
            <dt>Grade</dt><dd>{pack.grade ?? "—"}</dd>
            <dt>Supplier</dt><dd>{pack.supplier?.name ?? "—"}</dd>
            <dt>Purchase date</dt><dd>{pack.purchase_date ?? "—"}</dd>
            <dt>Purchase ref</dt><dd>{pack.purchase_reference ?? "—"}</dd>
            <dt>Notes</dt><dd>{pack.notes ?? "—"}</dd>
          </dl>
        </div>

        <div style={panel}>
          <h3 style={h3}>Worker links</h3>
          {pack.worker_links.length === 0 && <p style={{ color: "#888" }}>None yet.</p>}
          {pack.worker_links.map(l => (
            <div key={l.id} style={{ marginBottom: 8, padding: 8, background: l.revoked_at ? "#fdd" : "#efe", borderRadius: 4 }}>
              <div style={{ fontSize: 12 }}>
                <strong>{l.label ?? "(no label)"}</strong>
                {l.revoked_at && <span style={{ color: "#a00" }}> · revoked</span>}
              </div>
              <div style={{ fontSize: 11, color: "#666" }}>
                Uses: {l.current_uses}{l.max_uses ? ` / ${l.max_uses}` : ""}
                {l.expires_at && ` · expires ${new Date(l.expires_at).toLocaleString()}`}
                {l.last_used_at && ` · last used ${new Date(l.last_used_at).toLocaleString()}`}
              </div>
            </div>
          ))}
          <p style={{ fontSize: 11, color: "#666", marginTop: 8 }}>
            Create via <code>POST /api/materials/packs/{packId}/worker-link</code>. Worker URL format:{" "}
            <code>/w/&lt;token&gt;</code>
          </p>
        </div>
      </div>

      <h3 style={{ marginTop: 24 }}>Boards ({pack.boards.length})</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 8 }}>
        <thead>
          <tr style={{ background: "#eee" }}>
            <th style={cell}>#</th>
            <th style={cell}>Ref</th>
            <th style={cell}>Status</th>
            <th style={cell}>L (mm)</th>
            <th style={cell}>W avg (mm)</th>
            <th style={cell}>T avg (mm)</th>
            <th style={cell}>Volume (m³)</th>
            <th style={cell}>Version</th>
            <th style={cell}>Measured at</th>
          </tr>
        </thead>
        <tbody>
          {pack.boards.length === 0 && (
            <tr><td colSpan={9} style={{ ...cell, textAlign: "center", color: "#888" }}>No boards yet</td></tr>
          )}
          {pack.boards.map(b => {
            const m = b.current_measurement;
            const avgW = m ? Math.round((m.width_end_a_mm + m.width_centre_mm + m.width_end_b_mm) / 3) : null;
            const avgT = m ? Math.round((m.thickness_end_a_mm + m.thickness_centre_mm + m.thickness_end_b_mm) / 3) : null;
            const vol = m ? provider.computeVolume(m).volume_m3 : null;
            return (
              <tr key={b.id}>
                <td style={cell}>{b.position_in_pack}</td>
                <td style={cell}>{b.board_ref}</td>
                <td style={cell}>{b.status}</td>
                <td style={cell}>{m?.length_mm ?? "—"}</td>
                <td style={cell}>{avgW ?? "—"}</td>
                <td style={cell}>{avgT ?? "—"}</td>
                <td style={cell}>{vol != null ? vol.toFixed(4) : "—"}</td>
                <td style={cell}>{m?.measurement_version ?? "—"}</td>
                <td style={cell}>{m?.measured_at ? new Date(m.measured_at).toLocaleString() : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const cell: React.CSSProperties = {
  border: "1px solid #ddd",
  padding: "6px 10px",
  fontSize: 12,
  textAlign: "left",
};
const panel: React.CSSProperties = {
  padding: 12,
  border: "1px solid #ddd",
  borderRadius: 6,
};
const h3: React.CSSProperties = { margin: 0, marginBottom: 8, fontSize: 14 };
const dl: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: "4px 12px",
  fontSize: 12,
  margin: 0,
};
