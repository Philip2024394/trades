// src/components/nex-head-quarters/EmailHarvestStub.tsx
//
// The single honest stub component used by every EMAIL HARVEST sub-page
// whose backend/wire is not yet real. It NEVER fakes progress · NEVER
// shows fabricated counts · always names its exact blocker.

import Link from "next/link";
import type { EmailHarvestPage } from "@/lib/nex-hq/email-harvest-manifest";

export function EmailHarvestStub({ page }: { page: EmailHarvestPage }) {
  const label =
    page.status === "stub" ? "NOT YET BUILT"
    : page.status === "partial" ? "PARTIALLY WIRED"
    : "REAL";

  const tone =
    page.status === "stub" ? { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" }
    : page.status === "partial" ? { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" }
    : { bg: "#ecfdf5", fg: "#166534", border: "#86efac" };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 6 }}>
        Email Harvest · {page.label}
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 12px", color: "#111" }}>
        {page.purpose}
      </h1>
      <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 999, background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`, fontWeight: 700, fontSize: 12, letterSpacing: "0.05em", marginBottom: 20 }}>
        ● {label}
      </div>

      {page.blocker && (
        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 6 }}>
            What is blocking this page from being fully real
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "#111" }}>
            {page.blocker}
          </p>
        </section>
      )}

      {page.reads_from && page.reads_from.length > 0 && (
        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 8 }}>
            When wired, this page will read from
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#111", lineHeight: 1.7 }}>
            {page.reads_from.map(src => (
              <li key={src}><code style={{ background: "#f5f5f4", padding: "1px 6px", borderRadius: 4 }}>{src}</code></li>
            ))}
          </ul>
        </section>
      )}

      {page.related_links && page.related_links.length > 0 && (
        <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666", marginBottom: 8 }}>
            Related pages that already show useful state
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#111", lineHeight: 1.7 }}>
            {page.related_links.map(l => (
              <li key={l.href}><Link href={l.href} style={{ color: "#0e7490" }}>{l.label}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <section style={{ padding: 12, background: "#f8faf7", borderRadius: 8, fontSize: 11, color: "#666", lineHeight: 1.6 }}>
        <strong style={{ color: "#166534" }}>Anti-fabrication rule:</strong>
        &nbsp;This page will not render counts, progress bars, worker lists, or emails until the underlying subsystem is wired. Honest empty state beats fake activity every time.
      </section>
    </div>
  );
}
