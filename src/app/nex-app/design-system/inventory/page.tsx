// NEX Design System Finalisation · live inventory (Philip 2026-08-14 · Phase D).
//
// Route: /nex-app/design-system/inventory
// Dev-only. Owner reviews every registered section grouped by proposed
// design family, sees a LIVE render (iframe to /preview/section/{id})
// and the metadata card next to it, then approves/rejects families.
//
// Consumes:
//   data/design-system/section-inventory.json       (enumeration)
//   data/design-system/family-assignments.json      (family clustering)
//
// Do NOT redesign sections here. This page reflects the library as-is.

import { notFound } from "next/navigation";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";
export const metadata = { title: "Section inventory · dev preview", robots: { index: false } };

type Inventory = {
  ranAt: string;
  totalSections: number;
  byLibrary: Record<string, number>;
  latentSsrBombs: string[];
  inventory: Array<{
    id: string;
    library: string;
    name: string;
    description: string;
    category: string | null;
    supportedThemes: string[];
    supportedIndustries: string[];
    bestForVerticals: string[];
    responsiveBehaviour: unknown;
    editableFieldCount: number;
    editableFieldKeys: string[];
    aiPromptableFieldCount: number;
    imagePlaceholderCount: number;
    telemetryTags: string[];
    sourceFile: string;
    hasMetaSidecar: boolean;
    rendererIsClient: boolean | null;
  }>;
};

type FamilyAssignments = {
  families: Array<{ name: string; description: string }>;
  byFamily: Record<string, number>;
  assignments: Array<{ id: string; library: string; name: string; family: string }>;
};

export default function DesignSystemInventoryPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const inv: Inventory = JSON.parse(
    readFileSync(join(process.cwd(), "data", "design-system", "section-inventory.json"), "utf8")
  );
  const fam: FamilyAssignments = JSON.parse(
    readFileSync(join(process.cwd(), "data", "design-system", "family-assignments.json"), "utf8")
  );

  const familyByRegId = new Map(fam.assignments.map((a) => [a.id, a.family]));
  const bombs = new Set(inv.latentSsrBombs);

  // Group sections by family, preserving family declaration order.
  const grouped = new Map<string, typeof inv.inventory>();
  for (const f of fam.families) grouped.set(f.name, []);
  for (const s of inv.inventory) {
    const family = familyByRegId.get(s.id) ?? "Uncategorised";
    if (!grouped.has(family)) grouped.set(family, []);
    grouped.get(family)!.push(s);
  }

  return (
    <main
      style={{
        maxWidth: 1600,
        margin: "0 auto",
        padding: "32px 20px",
        fontFamily: "Inter, system-ui, sans-serif",
        color: "#0a0a0a",
        background: "#fff"
      }}
      data-testid="design-inventory-root"
    >
      <header style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "#6b7280", fontWeight: 700 }}>
          NEX · Design System Finalisation
        </div>
        <h1 style={{ margin: "12px 0 8px", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}>
          Section inventory · {inv.totalSections} sections · {fam.families.length} proposed families
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "#525252", maxWidth: 900 }}>
          Every registered Studio section, rendered live in isolation with its defaultConfig. Grouped by the family cluster proposed by <code>scripts/design-system/cluster-families.mjs</code>. Approve, reject, or re-tag sections in review — the audit is a mirror of what exists today; no redesign has happened here.
        </p>
        <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
          Enumerated {new Date(inv.ranAt).toISOString()} · Latent SSR-unsafe (no <code>.meta</code> sidecar): {inv.latentSsrBombs.length}
        </div>
      </header>

      {[...grouped.entries()].map(([familyName, sections]) => {
        const familyMeta = fam.families.find((f) => f.name === familyName);
        return (
          <section
            key={familyName}
            data-testid={`family-${familyName.replace(/[^a-zA-Z]/g, "-")}`}
            style={{ marginBottom: 48, paddingBottom: 16, borderBottom: "1px solid #e5e5e5" }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0a0a0a" }}>{familyName}</h2>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>{sections.length} section{sections.length === 1 ? "" : "s"}</div>
            </div>
            {familyMeta?.description && (
              <p style={{ margin: "0 0 20px", fontSize: 13, color: "#525252", maxWidth: 900 }}>{familyMeta.description}</p>
            )}
            <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(560px, 1fr))" }}>
              {sections.map((s) => (
                <article
                  key={s.id}
                  data-testid={`section-card-${s.id}`}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e5e5",
                    borderRadius: 10,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column"
                  }}
                >
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, monospace", marginTop: 2 }}>
                        {s.id} · v{(inv.inventory.find((x) => x.id === s.id) as { version?: string } | undefined)?.version ?? "?"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Chip color={s.hasMetaSidecar ? "#166534" : s.rendererIsClient ? "#991b1b" : "#525252"}>
                        {s.hasMetaSidecar ? ".meta ✓" : s.rendererIsClient ? "SSR-unsafe" : "server-safe"}
                      </Chip>
                      <Chip color="#374151">{s.editableFieldCount} fields</Chip>
                      {s.aiPromptableFieldCount > 0 && <Chip color="#5b21b6">{s.aiPromptableFieldCount} AI</Chip>}
                    </div>
                  </div>
                  <div style={{ position: "relative", width: "100%", height: 340, background: "#0a0a0a" }}>
                    <iframe
                      src={`/preview/section/${encodeURIComponent(s.id)}`}
                      title={`Preview: ${s.name}`}
                      loading="lazy"
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                    />
                  </div>
                  <div style={{ padding: "12px 14px", fontSize: 12, color: "#525252" }}>
                    {s.description && <p style={{ margin: "0 0 8px" }}>{s.description}</p>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(s.telemetryTags ?? []).slice(0, 8).map((t) => (
                        <span key={t} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "#f3f4f6", color: "#525252" }}>{t}</span>
                      ))}
                    </div>
                  </div>
                  <details style={{ padding: "8px 14px", borderTop: "1px solid #f3f4f6" }}>
                    <summary style={{ cursor: "pointer", fontSize: 11, color: "#6b7280" }}>Metadata</summary>
                    <dl style={{ margin: "6px 0 0", fontSize: 11, color: "#525252" }}>
                      <MetaRow label="Source" value={<code>{s.sourceFile}</code>} />
                      <MetaRow label="Themes" value={(s.supportedThemes ?? []).join(", ") || "—"} />
                      <MetaRow label="Industries" value={(s.supportedIndustries ?? []).slice(0, 6).join(", ") || (s.bestForVerticals ?? []).slice(0, 6).join(", ") || "—"} />
                      <MetaRow label="Responsive" value={s.responsiveBehaviour ? JSON.stringify(s.responsiveBehaviour) : "—"} />
                      <MetaRow label="Editable fields" value={s.editableFieldKeys.join(", ")} />
                    </dl>
                  </details>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#fff", border: `1px solid ${color}`, color }}>
      {children}
    </span>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, marginBottom: 2 }}>
      <dt style={{ color: "#9ca3af", fontWeight: 600 }}>{label}</dt>
      <dd style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{value}</dd>
    </div>
  );
}
