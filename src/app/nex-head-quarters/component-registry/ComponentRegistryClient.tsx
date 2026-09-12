"use client";

import { useEffect, useState } from "react";

interface Row {
  name: string;
  version: string;
  capabilityId: string;
  path: string;
  nexDnaVerdict: string;
  doctrineTags: string[];
  deprecatedBy: string | null;
  registeredAt: string;
}

export function ComponentRegistryClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    const load = async () => {
      const r = await fetch("/api/nex/component-registry/list", { cache: "no-store" });
      const j = await r.json();
      setRows(j.rows ?? []);
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const filtered = rows.filter((r) =>
    !q ||
    r.name.toLowerCase().includes(q.toLowerCase()) ||
    r.capabilityId.toLowerCase().includes(q.toLowerCase()) ||
    r.doctrineTags.some((t) => t.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          className="nws-input"
          placeholder="Search by name · capability · doctrine tag…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 420 }}
        />
        <span style={{ fontSize: 12, color: "var(--nws-slate)" }}>{filtered.length} of {rows.length}</span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            {["Name", "Version", "Capability", "DNA verdict", "Doctrine tags", "Path", "Deprecated"].map((h) => (
              <th key={h} style={{ padding: "8px 10px", fontSize: 11, color: "var(--nws-slate)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--nws-card-border)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={`${r.name}-${r.version}`} style={{ borderBottom: "1px solid var(--nws-card-border)" }}>
              <td style={{ padding: "10px", color: "var(--nws-soft-white)" }}><strong>{r.name}</strong></td>
              <td style={{ padding: "10px" }}><code>{r.version}</code></td>
              <td style={{ padding: "10px" }}><code>{r.capabilityId}</code></td>
              <td style={{ padding: "10px" }}><span className={`nws-badge ${r.nexDnaVerdict === "PASS" ? "nws-badge-green" : r.nexDnaVerdict === "FAIL" ? "nws-badge-red" : "nws-badge-slate"}`}>{r.nexDnaVerdict}</span></td>
              <td style={{ padding: "10px", fontSize: 11, color: "var(--nws-slate)" }}>{r.doctrineTags.join(" · ")}</td>
              <td style={{ padding: "10px", fontSize: 11 }}><code style={{ color: "var(--nws-slate)" }}>{r.path}</code></td>
              <td style={{ padding: "10px" }}>
                {r.deprecatedBy ? <span className="nws-badge nws-badge-red">→ {r.deprecatedBy}</span> : <span style={{ color: "var(--nws-slate)", fontSize: 11 }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
