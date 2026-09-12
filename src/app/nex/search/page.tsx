// src/app/nex/search/page.tsx
//
// Founder Phase 26 · P26-2 · Google-style NEX Search UI.
//
// Every result carries a Doctrine #6 chip (verified | unconfirmed) and
// a trust badge (Truth Engine ladder). Doctrine banner in the footer.
//
// No frameworks · single client component · fetch → render.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SearchResult = {
  ref_id: string;
  kind: "accommodation" | "conversation";
  title: string;
  snippet: string;
  source_reference: string | null;
  trust_layer: "canonical_verified" | "canonical_authoritative" | "provisional" | "unknown";
  verified: boolean;
  doctrine_6_label: "verified" | "unconfirmed";
  city?: string | null;
  score: number;
};

type SearchResponse = {
  query: string;
  results: SearchResult[];
  counts: { verified: number; unconfirmed: number };
  sources_queried: string[];
  ms: number;
  doctrine_note: string;
};

export default function NexSearchPage() {
  const [q, setQ] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q");
    if (initial) { setQ(initial); void runSearch(initial, verifiedOnly); }
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = useCallback(async (query: string, vOnly: boolean) => {
    setBusy(true); setError(null);
    try {
      const url = new URL("/api/nex/search", window.location.origin);
      url.searchParams.set("q", query);
      if (vOnly) url.searchParams.set("verified_only", "1");
      const r = await fetch(url.toString(), { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as SearchResponse;
      setData(j);
      const params = new URLSearchParams(window.location.search);
      params.set("q", query);
      if (vOnly) params.set("verified_only", "1"); else params.delete("verified_only");
      window.history.replaceState(null, "", `?${params.toString()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "search_failed");
    } finally { setBusy(false); }
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) void runSearch(q.trim(), verifiedOnly);
  };

  const chip = useMemo(() => ({
    verified: {
      label: "✓ Verified",
      bg: "#dcfce7", fg: "#166534", border: "#86efac",
    },
    unconfirmed: {
      label: "⚠ Unconfirmed",
      bg: "#fef3c7", fg: "#92400e", border: "#fcd34d",
    },
  }), []);

  const trustBadge = (layer: string) => {
    const map: Record<string, { label: string; bg: string; fg: string }> = {
      canonical_verified: { label: "canonical_verified", bg: "#dbeafe", fg: "#1e40af" },
      canonical_authoritative: { label: "canonical_authoritative", bg: "#dbeafe", fg: "#1e40af" },
      provisional: { label: "provisional", bg: "#f3e8ff", fg: "#6b21a8" },
      unknown: { label: "unknown", bg: "#f4f4f5", fg: "#3f3f46" },
    };
    return map[layer] ?? map.unknown;
  };

  const s = {
    main: { maxWidth: 820, margin: "2rem auto", padding: "1rem", fontFamily: "system-ui" } as const,
    brand: { fontSize: "1.9rem", fontWeight: 700, marginBottom: "1rem", textAlign: "center" as const, color: "#0f172a" },
    brandDot: { color: "#166534" },
    form: { display: "flex", gap: 8, alignItems: "center" } as const,
    input: {
      flex: 1, padding: "0.7rem 1rem", border: "1px solid #d4d4d8",
      borderRadius: 999, fontSize: "1rem", outline: "none",
    } as const,
    btn: {
      padding: "0.7rem 1.2rem", background: "#0f172a", color: "#fff", border: 0,
      borderRadius: 999, cursor: "pointer", fontSize: "0.9rem", fontWeight: 600,
    } as const,
    toolbar: { marginTop: "0.5rem", display: "flex", gap: 12, alignItems: "center", fontSize: "0.85rem", color: "#52525b" } as const,
    result: {
      padding: "0.85rem 1rem", marginTop: "0.75rem",
      border: "1px solid #e4e4e7", borderRadius: 8, background: "#ffffff",
    } as const,
    resultHead: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const, marginBottom: "0.35rem" },
    resultTitle: { fontSize: "1.05rem", color: "#1d4ed8", textDecoration: "none", fontWeight: 500 } as const,
    resultMeta: { fontSize: "0.75rem", color: "#71717a", marginTop: "0.15rem" },
    resultSnippet: { fontSize: "0.9rem", color: "#3f3f46", marginTop: "0.35rem", lineHeight: 1.4 },
    chipBase: (bg: string, fg: string, border: string) => ({
      display: "inline-block", padding: "0.1rem 0.55rem",
      background: bg, color: fg, border: `1px solid ${border}`,
      borderRadius: 999, fontSize: "0.72rem", fontWeight: 600,
    }),
    trustBadgeStyle: (bg: string, fg: string) => ({
      display: "inline-block", padding: "0.05rem 0.5rem",
      background: bg, color: fg, borderRadius: 4, fontSize: "0.68rem", fontFamily: "monospace",
    }),
    footer: {
      marginTop: "1.75rem", padding: "0.75rem 1rem",
      background: "#fafafa", border: "1px solid #e4e4e7",
      borderRadius: 8, fontSize: "0.78rem", color: "#52525b",
    } as const,
    countBadge: (kind: "verified" | "unconfirmed") => ({
      display: "inline-block", padding: "0.1rem 0.55rem", marginLeft: 4,
      background: kind === "verified" ? "#dcfce7" : "#fef3c7",
      color: kind === "verified" ? "#166534" : "#92400e",
      borderRadius: 999, fontSize: "0.72rem", fontWeight: 600,
    }),
  };

  return (
    <main style={s.main} data-nex-search-page="true">
      <h1 style={s.brand}>
        NEX<span style={s.brandDot}>·</span>Search
      </h1>

      <form onSubmit={onSubmit} style={s.form}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search accommodation, saved conversations, evidence…"
          style={s.input}
          disabled={busy}
          aria-label="Search query"
        />
        <button type="submit" style={s.btn} disabled={busy || !q.trim()}>
          {busy ? "…" : "Search"}
        </button>
      </form>

      <div style={s.toolbar}>
        <label style={{ cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={verifiedOnly}
            onChange={(e) => { setVerifiedOnly(e.target.checked); if (q.trim()) void runSearch(q.trim(), e.target.checked); }}
          />{" "}
          Verified only (Doctrine #6)
        </label>
        {data && (
          <span>
            {data.results.length} result{data.results.length === 1 ? "" : "s"}
            · verified <span style={s.countBadge("verified")}>{data.counts.verified}</span>
            · unconfirmed <span style={s.countBadge("unconfirmed")}>{data.counts.unconfirmed}</span>
            · {data.ms}ms
          </span>
        )}
      </div>

      {error && <p style={{ color: "#dc2626", marginTop: "0.75rem" }}>Error: {error}</p>}

      <section aria-live="polite">
        {data?.results.map((r) => {
          const c = chip[r.doctrine_6_label];
          const tb = trustBadge(r.trust_layer);
          const href = r.source_reference ?? "#";
          return (
            <article key={r.ref_id} style={s.result}>
              <div style={s.resultHead}>
                <span style={s.chipBase(c.bg, c.fg, c.border)}>{c.label}</span>
                <span style={s.trustBadgeStyle(tb.bg, tb.fg)}>{tb.label}</span>
                <span style={{ fontSize: "0.7rem", color: "#a1a1aa" }}>{r.kind}</span>
                {r.city && <span style={{ fontSize: "0.7rem", color: "#a1a1aa" }}>· {r.city}</span>}
              </div>
              <a href={href} target={r.source_reference?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" style={s.resultTitle}>
                {r.title}
              </a>
              <div style={s.resultMeta}>
                <code style={{ fontSize: "0.7rem" }}>{r.ref_id}</code>
                {r.source_reference && <> · source: <span style={{ fontSize: "0.72rem" }}>{r.source_reference.slice(0, 60)}{r.source_reference.length > 60 ? "…" : ""}</span></>}
              </div>
              {r.snippet && (
                <p style={s.resultSnippet} dangerouslySetInnerHTML={{ __html: r.snippet }} />
              )}
            </article>
          );
        })}
        {data && data.results.length === 0 && (
          <p style={{ marginTop: "1rem", color: "#71717a" }}>
            No results. Try broader terms or turn off the &quot;verified only&quot; filter.
          </p>
        )}
      </section>

      <div style={s.footer}>
        <strong>Doctrine #6 · Truth or Unconfirmed:</strong>{" "}
        every result carries a verified|unconfirmed classification.{" "}
        <strong>Verified</strong> = traces to canonical evidence.{" "}
        <strong>Unconfirmed</strong> = legend, spiritual claim, unverified history, rumor, or user-supplied content.{" "}
        <strong>NEX never presents unconfirmed results as fact.</strong>
      </div>
    </main>
  );
}
