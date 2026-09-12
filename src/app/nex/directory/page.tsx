// src/app/nex/directory/page.tsx
//
// Founder Phase 27 · P27-3 · NEX Directory (Google-surpassing).
//
// Landscape cards.
//   Click once  → expand-in-place · shows products / amenities / details
//   Click "View website" → inline iframe full-screen · floating "back to NEX"
//   Iframe blocked (X-Frame-Options) → honest fallback with "open in new tab"
//
// Doctrine #6 chip on every card. Trust badge visible. Never fabricates.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Card = {
  ref_id: string;
  kind: "accommodation";
  title: string;
  primary_category: string | null;
  categories: string[];
  snippet: string;
  city: string | null;
  district: string | null;
  address: string | null;
  hero_image_url: string | null;
  website: string | null;
  phone: string | null;
  whatsapp: string | null;
  star_rating: number | null;
  rating: number | null;
  review_count: number | null;
  room_count: number | null;
  amenities_preview: string[];
  product_count: number;
  trust_layer: "canonical_verified" | "canonical_authoritative" | "provisional" | "unknown";
  verified: boolean;
  doctrine_6_label: "verified" | "unconfirmed";
};

type CardsResponse = {
  query: string; cards: Card[];
  counts: { verified: number; unconfirmed: number };
  ms: number; doctrine_note: string;
};

type Detail = Card & {
  amenities_full: string[];
  products: Array<{ name: string; kind: "amenity" | "category" | "room"; verified: boolean }>;
  social_links: Record<string, string> | null;
  last_verified_at: string | null;
  source_reference: string | null;
};

export default function NexDirectoryPage() {
  const [q, setQ] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CardsResponse | null>(null);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [siteView, setSiteView] = useState<{ url: string; title: string } | null>(null);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [honestyByRef, setHonestyByRef] = useState<Record<string, { label: string; kind: "good" | "warn" | "neutral" | "bad"; reason?: string } | "loading">>({});
  const [askDraft, setAskDraft] = useState<Record<string, string>>({});
  const [askByRef, setAskByRef] = useState<Record<string, { answer: string; ms: number; used_honesty_audit: boolean } | "loading">>({});
  // Phase 31 · NEX Chat drawer state (per listing). NEX Chat REPLACES
  // the WhatsApp deep-link entirely — every listing conversation is
  // two-party inside NEX (Doctrine #7).
  const [chatOpen, setChatOpen] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState<Record<string, string>>({});
  const [chatOwnerEmailHint, setChatOwnerEmailHint] = useState<Record<string, string>>({});
  const [chatByRef, setChatByRef] = useState<Record<string, { messages: Array<{ from_role: string; body: string; sent_at: string }>; status: string; loading?: boolean }>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q");
    if (initial) { setQ(initial); void runSearch(initial, verifiedOnly); }
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = useCallback(async (query: string, vOnly: boolean) => {
    setBusy(true); setError(null); setExpandedRef(null); setDetail(null);
    try {
      const url = new URL("/api/nex/directory", window.location.origin);
      url.searchParams.set("q", query);
      if (vOnly) url.searchParams.set("verified_only", "1");
      const r = await fetch(url.toString(), { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      const params = new URLSearchParams(window.location.search);
      params.set("q", query);
      if (vOnly) params.set("verified_only", "1"); else params.delete("verified_only");
      window.history.replaceState(null, "", `?${params.toString()}`);
    } catch (e) { setError(e instanceof Error ? e.message : "search_failed"); }
    finally { setBusy(false); }
  }, []);

  const expand = useCallback(async (card: Card) => {
    if (expandedRef === card.ref_id) {
      setExpandedRef(null); setDetail(null); return;
    }
    setExpandedRef(card.ref_id); setDetail(null); setDetailBusy(true);
    try {
      const r = await fetch(`/api/nex/directory/${encodeURIComponent(card.ref_id)}`, { cache: "no-store" });
      if (r.ok) setDetail((await r.json()).detail);
    } finally { setDetailBusy(false); }
    // Fire honesty audit in background (only if the site exists and we haven't seen it yet)
    if (card.website && !honestyByRef[card.ref_id]) {
      setHonestyByRef((prev) => ({ ...prev, [card.ref_id]: "loading" }));
      try {
        const hr = await fetch(`/api/nex/directory/${encodeURIComponent(card.ref_id)}/honesty`, { cache: "no-store" });
        if (hr.ok) {
          const j = await hr.json();
          const v = j.verdict;
          if (!v) {
            setHonestyByRef((prev) => ({ ...prev, [card.ref_id]: { label: "No website", kind: "neutral" } }));
          } else {
            const kind: "good" | "warn" | "neutral" | "bad" =
              v.overall === "verified_free_no_cc" ? "good" :
              v.overall === "free_with_cc_required" ? "bad" :
              v.overall === "trial_details_unclear" ? "warn" : "neutral";
            const label =
              v.overall === "verified_free_no_cc" ? "✓ Free · no credit card" :
              v.overall === "free_with_cc_required" ? "⚠ Free trial · card required" :
              v.overall === "trial_details_unclear" ? "⚠ Trial details unclear" :
              v.overall === "paid_only" ? "Paid plans only" :
              v.overall === "pricing_not_stated" ? "Pricing not stated" :
              "Site blocked scan";
            setHonestyByRef((prev) => ({ ...prev, [card.ref_id]: { label, kind, reason: v.overall_reason } }));
          }
        }
      } catch { /* honesty is best-effort */ }
    }
  }, [expandedRef, honestyByRef]);

  const submitAsk = useCallback(async (card: Card) => {
    const question = (askDraft[card.ref_id] ?? "").trim();
    if (!question) return;
    setAskByRef((prev) => ({ ...prev, [card.ref_id]: "loading" }));
    try {
      const r = await fetch(`/api/nex/directory/${encodeURIComponent(card.ref_id)}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, scan_site: true }),
      });
      const j = await r.json().catch(() => ({}));
      setAskByRef((prev) => ({
        ...prev,
        [card.ref_id]: {
          answer: j?.answer ?? j?.error ?? "(no answer)",
          ms: j?.ms ?? 0,
          used_honesty_audit: !!j?.used_honesty_audit,
        },
      }));
    } catch (e) {
      setAskByRef((prev) => ({ ...prev, [card.ref_id]: { answer: `Error: ${(e as Error).message}`, ms: 0, used_honesty_audit: false } }));
    }
  }, [askDraft]);

  // ══ Phase 31 · NEX Chat handlers ══
  const loadChatThread = useCallback(async (ref_id: string) => {
    setChatByRef((prev) => ({ ...prev, [ref_id]: { messages: prev[ref_id]?.messages ?? [], status: prev[ref_id]?.status ?? "opening", loading: true } }));
    try {
      const r = await fetch(`/api/nex/directory/${encodeURIComponent(ref_id)}/chat/history`, { cache: "no-store" });
      if (r.status === 401) {
        setChatByRef((prev) => ({ ...prev, [ref_id]: { messages: [], status: "please_sign_in_on_settings", loading: false } }));
        return;
      }
      const j = await r.json().catch(() => ({}));
      const messages = (j?.messages ?? []).map((m: { from_role: string; body: string; sent_at: string }) => ({ from_role: m.from_role, body: m.body, sent_at: m.sent_at }));
      setChatByRef((prev) => ({ ...prev, [ref_id]: { messages, status: j?.thread ? "open" : "no_thread_yet", loading: false } }));
    } catch (e) {
      setChatByRef((prev) => ({ ...prev, [ref_id]: { messages: [], status: `error:${(e as Error).message}`, loading: false } }));
    }
  }, []);

  const sendChatMessage = useCallback(async (card: { ref_id: string; title: string }) => {
    const body = (chatDraft[card.ref_id] ?? "").trim();
    if (!body) return;
    const ownerHint = (chatOwnerEmailHint[card.ref_id] ?? "").trim();
    try {
      const r = await fetch(`/api/nex/directory/${encodeURIComponent(card.ref_id)}/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, owner_email_hint: ownerHint || undefined }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setChatByRef((prev) => ({ ...prev, [card.ref_id]: { ...(prev[card.ref_id] ?? { messages: [] }), status: `error:${j?.error ?? r.status}` } }));
        return;
      }
      setChatDraft((prev) => ({ ...prev, [card.ref_id]: "" }));
      await loadChatThread(card.ref_id);
      const status = j?.delivery_status ?? "sent";
      const inviteNote = j?.owner_invite?.smtp_configured === false
        ? " · owner-invite email QUEUED (SMTP not configured yet)"
        : (j?.owner_invite ? " · owner-invite email sent" : "");
      setChatByRef((prev) => ({ ...prev, [card.ref_id]: { ...(prev[card.ref_id] ?? { messages: [] }), status: `${status}${inviteNote}` } }));
    } catch (e) {
      setChatByRef((prev) => ({ ...prev, [card.ref_id]: { ...(prev[card.ref_id] ?? { messages: [] }), status: `error:${(e as Error).message}` } }));
    }
  }, [chatDraft, chatOwnerEmailHint, loadChatThread]);

  const openSite = useCallback((card: Card) => {
    if (!card.website) return;
    let url = card.website.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setIframeBlocked(false);
    setSiteView({ url, title: card.title });
    // Iframe X-Frame-Options detection · we can't sniff cross-origin
    // headers from JS so we time-out onload and mark blocked.
    setTimeout(() => setIframeBlocked((prev) => (prev === false ? true : prev)), 3500);
  }, []);

  const closeSite = useCallback(() => { setSiteView(null); setIframeBlocked(false); }, []);

  const chip = useMemo(() => ({
    verified: { label: "✓ Verified", bg: "#dcfce7", fg: "#166534", border: "#86efac" },
    unconfirmed: { label: "⚠ Unconfirmed", bg: "#fef3c7", fg: "#92400e", border: "#fcd34d" },
  }), []);

  const s: Record<string, React.CSSProperties> = {
    main: { maxWidth: 1180, margin: "1.75rem auto", padding: "1rem", fontFamily: "system-ui" },
    brand: { fontSize: "1.9rem", fontWeight: 700, marginBottom: "0.75rem", textAlign: "center", color: "#0f172a" },
    brandDot: { color: "#166534" },
    form: { display: "flex", gap: 8, alignItems: "center" },
    input: { flex: 1, padding: "0.7rem 1rem", border: "1px solid #d4d4d8", borderRadius: 999, fontSize: "1rem", outline: "none" },
    btn: { padding: "0.7rem 1.2rem", background: "#0f172a", color: "#fff", border: 0, borderRadius: 999, cursor: "pointer", fontSize: "0.9rem", fontWeight: 600 },
    toolbar: { marginTop: "0.5rem", display: "flex", gap: 12, alignItems: "center", fontSize: "0.85rem", color: "#52525b" },
    grid: { display: "grid", gridTemplateColumns: "1fr", gap: "0.75rem", marginTop: "1rem" },
    card: (expanded: boolean): React.CSSProperties => ({
      border: `1px solid ${expanded ? "#166534" : "#e4e4e7"}`,
      borderRadius: 10, background: "#ffffff",
      overflow: "hidden", transition: "border-color 120ms",
    }),
    cardTop: { padding: "0.85rem 1rem", cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" },
    hero: { width: 110, height: 82, background: "#f4f4f5", borderRadius: 6, objectFit: "cover", flexShrink: 0 },
    cardBody: { flex: 1, minWidth: 0 },
    cardHead: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: "0.2rem" },
    cardTitle: { fontSize: "1.05rem", fontWeight: 600, color: "#0f172a" },
    cardMeta: { fontSize: "0.8rem", color: "#52525b", marginTop: "0.15rem" },
    cardChips: { marginTop: "0.35rem", display: "flex", gap: 6, flexWrap: "wrap" },
    chipStyle: (bg: string, fg: string, border: string): React.CSSProperties => ({
      display: "inline-block", padding: "0.05rem 0.5rem",
      background: bg, color: fg, border: `1px solid ${border}`,
      borderRadius: 999, fontSize: "0.7rem", fontWeight: 600,
    }),
    productChip: { display: "inline-block", padding: "0.05rem 0.5rem", background: "#f4f4f5", color: "#3f3f46", borderRadius: 4, fontSize: "0.7rem", marginRight: 4, marginBottom: 4 },
    expandBadge: { fontSize: "0.7rem", color: "#166534", marginLeft: "auto", padding: "0.15rem 0.55rem", background: "#dcfce7", borderRadius: 999, fontWeight: 600, whiteSpace: "nowrap" },
    drawer: { padding: "0 1rem 1rem", borderTop: "1px dashed #e4e4e7", background: "#fafafa" },
    drawerHead: { padding: "0.75rem 0", fontSize: "0.75rem", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.05em" },
    productGrid: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: "0.25rem" },
    actionRow: { marginTop: "0.75rem", display: "flex", gap: 8, flexWrap: "wrap" },
    actionBtn: { padding: "0.4rem 0.85rem", background: "#166534", color: "#fff", border: 0, borderRadius: 6, cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 },
    actionBtnAlt: { padding: "0.4rem 0.85rem", background: "#f4f4f5", color: "#18181b", border: "1px solid #d4d4d8", borderRadius: 6, cursor: "pointer", fontSize: "0.8rem" },
    footer: { marginTop: "1.75rem", padding: "0.75rem 1rem", background: "#fafafa", border: "1px solid #e4e4e7", borderRadius: 8, fontSize: "0.78rem", color: "#52525b" },
    // Site-view overlay
    siteOverlay: { position: "fixed", inset: 0, background: "#0f172a", zIndex: 1000, display: "flex", flexDirection: "column" },
    siteBar: { display: "flex", gap: 10, alignItems: "center", padding: "0.5rem 1rem", background: "#0f172a", color: "#f4f4f5", fontSize: "0.85rem" },
    siteIframe: { flex: 1, border: 0, background: "#fff" },
    backBtn: { position: "fixed", bottom: 20, left: 20, zIndex: 1001, padding: "0.65rem 1.1rem", background: "#166534", color: "#fff", border: 0, borderRadius: 999, cursor: "pointer", fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" },
  };

  const trustBadgeBg = (layer: string) => layer.startsWith("canonical") ? "#dbeafe" : layer === "provisional" ? "#f3e8ff" : "#f4f4f5";
  const trustBadgeFg = (layer: string) => layer.startsWith("canonical") ? "#1e40af" : layer === "provisional" ? "#6b21a8" : "#3f3f46";

  return (
    <main lang="en" style={s.main} data-nex-directory-page="true">
      <h1 style={s.brand}>NEX<span style={s.brandDot}>·</span>Directory</h1>

      <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) void runSearch(q.trim(), verifiedOnly); }} style={s.form}>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search hotels, restaurants, services…"
          style={s.input} disabled={busy} aria-label="Directory query" />
        <button type="submit" style={s.btn} disabled={busy || !q.trim()}>
          {busy ? "…" : "Search"}
        </button>
      </form>

      <div style={s.toolbar}>
        <label style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={verifiedOnly}
            onChange={(e) => { setVerifiedOnly(e.target.checked); if (q.trim()) void runSearch(q.trim(), e.target.checked); }} />
          {" "}Verified only (Doctrine #6)
        </label>
        {data && (
          <span>
            {data.cards.length} listings · verified{" "}
            <span style={{ ...s.productChip, background: "#dcfce7", color: "#166534" }}>{data.counts.verified}</span>
            · unconfirmed{" "}
            <span style={{ ...s.productChip, background: "#fef3c7", color: "#92400e" }}>{data.counts.unconfirmed}</span>
            · {data.ms}ms
          </span>
        )}
      </div>

      {error && <p style={{ color: "#dc2626", marginTop: "0.75rem" }}>Error: {error}</p>}

      <section aria-live="polite" style={s.grid} data-cards-grid="true">
        {data?.cards.map((c) => {
          const label = chip[c.doctrine_6_label];
          const expanded = expandedRef === c.ref_id;
          return (
            <article key={c.ref_id} style={s.card(expanded)}>
              <div style={s.cardTop} onClick={() => void expand(c)} data-card-toggle="true">
                {c.hero_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.hero_image_url} alt={c.title} style={s.hero} />
                ) : (
                  <div style={{ ...s.hero, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#a1a1aa" }}>
                    no image
                  </div>
                )}
                <div style={s.cardBody}>
                  <div style={s.cardHead}>
                    <span style={s.cardTitle}>{c.title}</span>
                    {c.star_rating != null && <span style={{ fontSize: "0.8rem", color: "#a16207" }}>{"★".repeat(Math.max(1, Math.min(5, c.star_rating)))}</span>}
                    {c.rating != null && <span style={{ fontSize: "0.75rem", color: "#52525b" }}>{c.rating.toFixed(1)} {c.review_count ? `(${c.review_count})` : ""}</span>}
                    <span style={s.expandBadge}>{expanded ? "▲ Close" : `▼ ${c.product_count} details`}</span>
                  </div>
                  <div style={s.cardMeta}>
                    {c.primary_category && <><strong>{c.primary_category}</strong> · </>}
                    {[c.district, c.city].filter(Boolean).join(", ")}
                    {c.address && <> · {c.address}</>}
                  </div>
                  <div style={s.cardChips}>
                    <span style={s.chipStyle(label.bg, label.fg, label.border)}>{label.label}</span>
                    <span style={s.chipStyle(trustBadgeBg(c.trust_layer), trustBadgeFg(c.trust_layer), trustBadgeBg(c.trust_layer))}>
                      {c.trust_layer}
                    </span>
                    {c.website && <span style={{ ...s.productChip, background: "#e0f2fe", color: "#075985" }}>website</span>}
                    <span style={{ ...s.productChip, background: "#dcfce7", color: "#14532d", fontWeight: 600 }} data-nex-chat-badge="true">NEX Chat</span>
                    {c.amenities_preview.slice(0, 4).map((a) => <span key={a} style={s.productChip}>{a}</span>)}
                    {c.amenities_preview.length > 4 && <span style={{ ...s.productChip, fontStyle: "italic" }}>+{c.amenities_preview.length - 4}…</span>}
                    {(() => {
                      const h = honestyByRef[c.ref_id];
                      if (!h) return null;
                      if (h === "loading") return <span style={{ ...s.productChip, background: "#f4f4f5", color: "#71717a" }}>auditing site…</span>;
                      const bg = h.kind === "good" ? "#dcfce7" : h.kind === "bad" ? "#fee2e2" : h.kind === "warn" ? "#fef3c7" : "#f4f4f5";
                      const fg = h.kind === "good" ? "#166534" : h.kind === "bad" ? "#991b1b" : h.kind === "warn" ? "#92400e" : "#3f3f46";
                      return <span title={h.reason} data-honesty-chip="true" style={{ ...s.productChip, background: bg, color: fg, fontWeight: 600 }}>{h.label}</span>;
                    })()}
                  </div>
                </div>
              </div>

              {expanded && (
                <div style={s.drawer} data-card-drawer="true">
                  {detailBusy && <p style={{ fontSize: "0.85rem", color: "#71717a" }}>Loading products…</p>}
                  {detail && (
                    <>
                      <div style={s.drawerHead}>Products &amp; services</div>
                      <div style={s.productGrid}>
                        {detail.products.map((p, i) => (
                          <span key={i} style={{
                            ...s.productChip,
                            background: p.kind === "amenity" ? "#f0f9ff" : p.kind === "room" ? "#fefce8" : "#f5f3ff",
                            color: p.kind === "amenity" ? "#075985" : p.kind === "room" ? "#854d0e" : "#5b21b6",
                          }}>
                            {p.name}
                          </span>
                        ))}
                        {detail.products.length === 0 && <span style={{ fontSize: "0.8rem", color: "#71717a" }}>No products listed yet (honest UNKNOWN · Doctrine #6).</span>}
                      </div>

                      {detail.social_links && Object.keys(detail.social_links).length > 0 && (
                        <>
                          <div style={s.drawerHead}>Social</div>
                          <div style={s.productGrid}>
                            {Object.entries(detail.social_links).map(([k, v]) => (
                              <a key={k} href={v} target="_blank" rel="noopener noreferrer" style={{ ...s.productChip, textDecoration: "none", background: "#f4f4f5", color: "#0f172a" }}>{k}</a>
                            ))}
                          </div>
                        </>
                      )}

                      <div style={s.actionRow}>
                        {/* Phase 31 · Chat Now is the PRIMARY contact button (replaces WhatsApp). */}
                        <button
                          style={{ ...s.actionBtn, background: "#166534" }}
                          onClick={() => { setChatOpen(chatOpen === detail.ref_id ? null : detail.ref_id); void loadChatThread(detail.ref_id); }}
                          data-nex-chat-open="true"
                        >
                          {chatOpen === detail.ref_id ? "▲ Close chat" : "💬 Chat now"}
                        </button>
                        {detail.website && (
                          <button style={s.actionBtnAlt} onClick={() => openSite(detail)} data-view-website="true">
                            View website inside NEX
                          </button>
                        )}
                        {detail.website && (
                          <a href={detail.website} target="_blank" rel="noopener noreferrer" style={{ ...s.actionBtnAlt, textDecoration: "none", display: "inline-block" }}>
                            Open in new tab
                          </a>
                        )}
                        {detail.phone && <a href={`tel:${detail.phone}`} style={{ ...s.actionBtnAlt, textDecoration: "none", display: "inline-block" }}>Call</a>}
                        {/* WhatsApp dropped Phase 31 — every listing conversation runs on NEX Chat (Doctrine #7). */}
                      </div>

                      {chatOpen === detail.ref_id && (() => {
                        const chat = chatByRef[detail.ref_id];
                        return (
                          <div style={{ marginTop: "0.6rem", padding: "0.6rem 0.8rem", background: "#ffffff", border: "1px solid #166534", borderRadius: 8 }} data-nex-chat-drawer="true">
                            <div style={s.drawerHead}>NEX Chat with {detail.title}</div>
                            <div style={{ maxHeight: 220, overflow: "auto", padding: "0.25rem 0", fontSize: "0.85rem" }}>
                              {chat?.loading && <div style={{ color: "#71717a" }}>Loading thread…</div>}
                              {chat?.messages?.length === 0 && !chat?.loading && (
                                <div style={{ color: "#71717a", fontSize: "0.8rem" }}>
                                  No messages yet. Start the conversation — your first message will invite the owner to NEX Chat if they haven&apos;t joined yet.
                                </div>
                              )}
                              {chat?.messages?.map((m, i) => (
                                <div key={i} style={{ marginBottom: "0.3rem", padding: "0.35rem 0.55rem", background: m.from_role === "sender" ? "#eff6ff" : "#f0fdf4", borderRadius: 6 }}>
                                  <div style={{ fontSize: "0.68rem", color: "#71717a" }}>{m.from_role === "sender" ? "You" : "Owner"} · {m.sent_at?.slice(11, 16)}</div>
                                  <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
                                </div>
                              ))}
                            </div>
                            <input
                              placeholder="Owner email (helps invite them to NEX Chat if new)"
                              value={chatOwnerEmailHint[detail.ref_id] ?? ""}
                              onChange={(e) => setChatOwnerEmailHint((p) => ({ ...p, [detail.ref_id]: e.target.value }))}
                              style={{ width: "100%", padding: "0.4rem 0.6rem", marginTop: 8, border: "1px solid #d4d4d8", borderRadius: 6, fontSize: "0.8rem" }}
                            />
                            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                              <input
                                value={chatDraft[detail.ref_id] ?? ""}
                                onChange={(e) => setChatDraft((p) => ({ ...p, [detail.ref_id]: e.target.value }))}
                                placeholder="Type your message…"
                                style={{ flex: 1, padding: "0.5rem 0.7rem", border: "1px solid #d4d4d8", borderRadius: 6, fontSize: "0.85rem" }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void sendChatMessage(detail); } }}
                                data-nex-chat-input="true"
                              />
                              <button onClick={() => void sendChatMessage(detail)} style={s.actionBtn} data-nex-chat-send="true">Send</button>
                            </div>
                            {chat?.status && (
                              <div style={{ marginTop: 6, fontSize: "0.72rem", color: "#71717a" }}>
                                Status: <code>{chat.status}</code> · Doctrine #7 · this thread is private to you and the owner. NEX never trains on it.
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div style={s.drawerHead}>Ask about this listing (no need to visit the website)</div>
                      <div style={{ display: "flex", gap: 8 }} data-ask-form="true">
                        <input
                          value={askDraft[detail.ref_id] ?? ""}
                          onChange={(e) => setAskDraft((prev) => ({ ...prev, [detail.ref_id]: e.target.value }))}
                          placeholder='e.g. "Is there parking?" · "How much does it cost?" · "Do they accept WhatsApp?"'
                          style={{ flex: 1, padding: "0.5rem 0.7rem", border: "1px solid #d4d4d8", borderRadius: 6, fontSize: "0.85rem" }}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submitAsk(detail); } }}
                        />
                        <button onClick={() => void submitAsk(detail)} style={s.actionBtn} data-ask-submit="true">Ask</button>
                      </div>
                      {askByRef[detail.ref_id] === "loading" && (
                        <div style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#71717a" }}>Composing answer…</div>
                      )}
                      {askByRef[detail.ref_id] && askByRef[detail.ref_id] !== "loading" && (() => {
                        const a = askByRef[detail.ref_id] as { answer: string; ms: number; used_honesty_audit: boolean };
                        return (
                          <div style={{ marginTop: "0.5rem", padding: "0.6rem 0.8rem", background: "#ffffff", border: "1px solid #e4e4e7", borderRadius: 6, fontSize: "0.85rem", lineHeight: 1.5 }} data-ask-answer="true">
                            <div style={{ whiteSpace: "pre-wrap" }}>{a.answer}</div>
                            <div style={{ marginTop: 6, fontSize: "0.7rem", color: "#71717a" }}>
                              {a.ms}ms {a.used_honesty_audit && "· pricing scanned from live site"} · Doctrine #6 label enforced
                            </div>
                          </div>
                        );
                      })()}

                      <div style={{ marginTop: "0.5rem", fontSize: "0.7rem", color: "#a1a1aa" }}>
                        ref <code>{detail.ref_id}</code>
                        {detail.last_verified_at && <> · last verified {detail.last_verified_at.slice(0, 10)}</>}
                      </div>
                    </>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {data && data.cards.length === 0 && (
          <p style={{ marginTop: "1rem", color: "#71717a" }}>
            No listings. Try broader terms, another city, or turn off &quot;verified only&quot;.
          </p>
        )}
      </section>

      <div style={s.footer}>
        <strong>How NEX Directory surpasses Google:</strong>
        <ul style={{ margin: "0.3rem 0 0 1rem", padding: 0 }}>
          <li>Landscape cards with product/service preview · no need to open the website to see what a listing offers</li>
          <li>Every listing carries a <strong>Verified</strong> / <strong>Unconfirmed</strong> chip (Doctrine #6)</li>
          <li>Every card shows the trust ladder tier (canonical_verified · provisional · unknown)</li>
          <li>Click once → in-place drawer with full products + contacts + Chat / Call quick actions</li>
          <li><strong>Chat runs on NEX Chat</strong> (Doctrine #7) · WhatsApp is not used for user↔owner messaging · every thread is private to the two parties · NEX never trains on it</li>
          <li>&quot;View website inside NEX&quot; opens the site full-screen with a floating back button — no lost context</li>
          <li>Honest UNKNOWN when a listing hasn&apos;t declared products yet · never fabricated</li>
        </ul>
      </div>

      {siteView && (
        <div style={s.siteOverlay} role="dialog" aria-label={`Website view · ${siteView.title}`}>
          <div style={s.siteBar}>
            <strong style={{ marginRight: 8 }}>NEX website view</strong>
            <span style={{ opacity: 0.85 }}>{siteView.title}</span>
            <span style={{ marginLeft: "auto", opacity: 0.65, fontSize: "0.75rem" }}>{siteView.url}</span>
          </div>
          {iframeBlocked ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", padding: "2rem", textAlign: "center", color: "#3f3f46" }}>
              <div>
                <p style={{ fontSize: "1.05rem", marginBottom: "0.75rem" }}>This site blocks embedded views (X-Frame-Options).</p>
                <a href={siteView.url} target="_blank" rel="noopener noreferrer" style={{ ...s.btn, textDecoration: "none", display: "inline-block" }}>
                  Open {siteView.title} in new tab
                </a>
              </div>
            </div>
          ) : (
            <iframe
              src={siteView.url}
              style={s.siteIframe}
              onLoad={() => setIframeBlocked(false)}
              onError={() => setIframeBlocked(true)}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              referrerPolicy="no-referrer"
              title={`External · ${siteView.title}`}
            />
          )}
          <button style={s.backBtn} onClick={closeSite} data-back-to-directory="true">← Back to NEX Directory</button>
        </div>
      )}
    </main>
  );
}
