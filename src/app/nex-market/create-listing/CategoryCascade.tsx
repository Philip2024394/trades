"use client";

// Cascade Master → L1 → L2 dropdowns · submits selected L2 category_id as
// `categoryId` form field. When user picks a master, L1 options load. When
// user picks an L1, L2 options load. Storing selected L2 gives full path.

import { useMemo, useState } from "react";
import type { CategoryTreeNode } from "@/lib/nex-shop/queries";

export default function CategoryCascade({ tree }: { tree: CategoryTreeNode[] }): React.JSX.Element {
  const [masterId, setMasterId] = useState<string>("");
  const [l1Id, setL1Id]         = useState<string>("");
  const [l2Id, setL2Id]         = useState<string>("");

  const master = useMemo(() => tree.find((m) => m.categoryId === masterId) ?? null, [tree, masterId]);
  const l1     = useMemo(() => master?.children.find((c) => c.categoryId === l1Id) ?? null, [master, l1Id]);
  const l2Path = useMemo(() => {
    const l2 = l1?.children.find((c) => c.categoryId === l2Id) ?? null;
    return l2?.path ?? null;
  }, [l1, l2Id]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "#8a8776", fontWeight: 500 }}>Category</label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <select
          value={masterId}
          onChange={(e) => { setMasterId(e.target.value); setL1Id(""); setL2Id(""); }}
          style={selectStyle}
        >
          <option value="">Master category…</option>
          {tree.map((m) => (
            <option key={m.categoryId} value={m.categoryId}>{m.label}</option>
          ))}
        </select>
        <select
          value={l1Id}
          onChange={(e) => { setL1Id(e.target.value); setL2Id(""); }}
          disabled={!master}
          style={{ ...selectStyle, opacity: master ? 1 : 0.5 }}
        >
          <option value="">Sub-category…</option>
          {master?.children.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>{c.label}</option>
          ))}
        </select>
        <select
          value={l2Id}
          onChange={(e) => setL2Id(e.target.value)}
          disabled={!l1}
          style={{ ...selectStyle, opacity: l1 ? 1 : 0.5 }}
        >
          <option value="">Micro-niche…</option>
          {l1?.children.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>{c.label}</option>
          ))}
        </select>
      </div>
      {l2Path && (
        <div style={{ fontSize: 12, color: "#8a8776" }}>Selected: <strong style={{ color: "#1a1a1a" }}>{l2Path}</strong></div>
      )}
      {/* Hidden fields the server action reads */}
      <input type="hidden" name="categoryId" value={l2Id} />
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid rgba(0,0,0,0.14)",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  background: "#fff",
  width: "100%",
};
