"use client";

// NEX Email Marketing HQ · Founder Control Centre client
//
// Founder-authorised programme. Thin over the Founder backend service.
// Server-side is the security boundary · UI is a control panel not a truth layer.
//
// Layout (Email Storage UI wave · 2026-09-21):
//   1 · HERO
//   2 · EMAIL SENDER
//   3 · EMAIL STORAGE      ← new · directly under sender · never below composer
//   4 · COMPOSER
//   5 · PREVIEW
//   6 · TEST / REVIEW / SEND
//
// Absolutely NO raw addresses displayed · no export/download/CSV · no
// send authorisation opened by this wave.

import { useCallback, useEffect, useMemo, useState } from "react";

type SystemStatus = {
  ready: boolean; send_enabled: boolean; primary_provider: string;
  configured_providers: string[]; active_senders: number; total_founder_senders: number;
  pending_queue: number; auto_state: string; compliance_ok: boolean;
  last_activity_at: string | null; backend_available: boolean;
};

type Sender = {
  sender_id: string; email: string; display_name: string | null;
  provider: string; authentication_state: string; health_state: string;
  capacity: {
    hourly_limit: number | null; hourly_used: number; hourly_remaining: number | null;
    daily_limit: number | null; daily_used: number; daily_remaining: number | null;
    effective_remaining: number | null;
  };
  is_sendable: boolean;
};

type AudienceCount = {
  total_discovered: number; eligible: number; opt_out: number; hard_bounced: number; complaint: number;
};

type Campaign = {
  campaign_id: string; display_name: string; status: string;
  target_count: number; send_count: number; fail_count: number;
  opened_count: number; clicked_count: number;
  created_at: string;
};

type Review = {
  send_ready: boolean;
  audience_count: AudienceCount;
  sender: Sender;
  refusal_reasons: { kind: string; detail: string }[];
};

type Inventory = {
  total: number; distinct_lower_email: number; not_suppressed: number;
  suppressed: { opt_out: number; hard_bounced: number; complaint: number; total: number };
  countries: { iso: string; name: string; total: number; not_suppressed: number }[];
  categories: { key: string; label: string; total: number; not_suppressed: number }[];
  sources: { source_table: string; n: number }[];
  activity: { last_first_seen_at: string | null; last_ingestion_at: string | null; new_last_7_days: number | null };
  contact_proof_available: false;
  computed_at: string;
};

type DiscoveryStatus = {
  topic: string;
  running_cycle_id: string | null;
  last_completed_cycle: CycleReport | null;
  next_expected_at: string | null;
  cadence_seconds: number;
};

type CycleReport = {
  cycle_id: string; cycle_seq: number; topic: string;
  started_at: string; finished_at: string | null; duration_ms: number | null;
  searches_attempted: number; terms_used: string[]; countries_touched: string[]; sources_attempted: string[];
  businesses_discovered: number; new_emails: number; existing_matched: number; rejected_emails: number;
  newly_classified: number; newly_eligible: number; categories_touched: string[];
  source_outcomes: { source: string; outcome: string; elements: number; bytes: number | null; ms: number; note: string | null }[];
  outcome: string; note: string | null;
  sends_triggered: 0; addresses_exposed: 0;
};

type Vocabulary = {
  topic: string;
  seeds: { term: string; family: string | null; evidence_count: number }[];
  validated: { term: string; family: string | null; evidence_count: number }[];
  candidates: { term: string; family: string | null; evidence_count: number }[];
  rejected: { term: string; family: string | null; evidence_count: number }[];
  by_family: Record<string, { term: string; status: string; evidence_count: number }[]>;
};

type Relationship = {
  parent_term: string; child_term: string; relationship_kind: string;
  evidence_count: number; confidence: number; status: string;
};

const STANDARD_FOOTER =
  "Sent via NEX · thenetworkers.app · one-click unsubscribe below · we honour every request within seconds.";

const SEND_COUNT_OPTIONS = [100, 200, 300, 400, 500] as const;
type SendChoice = number | "AUTO";

export function FounderControlCentre() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSender, setSelectedSender] = useState<string>("");
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [audienceCount, setAudienceCount] = useState<AudienceCount | null>(null);
  const [sendChoice, setSendChoice] = useState<SendChoice>("AUTO");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [footer, setFooter] = useState(STANDARD_FOOTER);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [currentCampaign, setCurrentCampaign] = useState<Campaign | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [testRecipient, setTestRecipient] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showAddSender, setShowAddSender] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<DiscoveryStatus | null>(null);
  const [discoveryCycles, setDiscoveryCycles] = useState<CycleReport[]>([]);
  const [vocabulary, setVocabulary] = useState<Vocabulary | null>(null);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [tickBusy, setTickBusy] = useState(false);
  const [addSenderForm, setAddSenderForm] = useState({
    email: "", display_name: "", provider: "resend", capacity_source: "",
    daily_capacity: "", hourly_capacity: "",
  });

  const flashOk  = (t: string) => { setFlash({ kind: "ok",  text: t }); setTimeout(() => setFlash(null), 4500); };
  const flashErr = (t: string) => { setFlash({ kind: "err", text: t }); setTimeout(() => setFlash(null), 6000); };

  // ─── Loaders ──────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    const r = await fetch("/api/nex/founder/marketing/status", { credentials: "include" }).catch(() => null);
    if (!r || !r.ok) return;
    const j = await r.json();
    if (j.ok) setStatus(j.status);
  }, []);
  const loadSenders = useCallback(async () => {
    const r = await fetch("/api/nex/founder/marketing/senders", { credentials: "include" }).catch(() => null);
    if (!r || !r.ok) return;
    const j = await r.json();
    if (j.ok) {
      setSenders(j.senders);
      if (!selectedSender && j.senders.length > 0) {
        const first = j.senders.find((s: Sender) => s.is_sendable) ?? j.senders[0];
        setSelectedSender(first.sender_id);
      }
    }
  }, [selectedSender]);
  const loadCampaigns = useCallback(async () => {
    const r = await fetch("/api/nex/founder/marketing/campaigns", { credentials: "include" }).catch(() => null);
    if (!r || !r.ok) return;
    const j = await r.json();
    if (j.ok) setCampaigns(j.campaigns);
  }, []);
  const loadInventory = useCallback(async () => {
    const r = await fetch("/api/nex/founder/marketing/inventory", { credentials: "include" }).catch(() => null);
    if (!r || !r.ok) return;
    const j = await r.json();
    if (j.ok && j.inventory) {
      setInventory(j.inventory);
      // Preselect the single populated country (e.g. ID with 1019 rows) if the founder hasn't picked
      if (!selectedCountry && j.inventory.countries.length > 0) {
        const first = j.inventory.countries.find((c: any) => c.not_suppressed > 0) ?? j.inventory.countries[0];
        setSelectedCountry(first.iso);
      }
    }
  }, [selectedCountry]);
  const loadAudience = useCallback(async () => {
    if (!selectedCountry && !selectedCategory) { setAudienceCount(null); return; }
    const r = await fetch("/api/nex/founder/marketing/audience", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ country: selectedCountry || undefined, category: selectedCategory || undefined }),
    }).catch(() => null);
    if (!r || !r.ok) return;
    const j = await r.json();
    if (j.ok) setAudienceCount(j.count);
  }, [selectedCountry, selectedCategory]);

  const loadDiscovery = useCallback(async () => {
    const [s, c, v, r] = await Promise.all([
      fetch("/api/nex/founder/discovery/status?topic=scaffolding",       { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch("/api/nex/founder/discovery/cycles?topic=scaffolding&limit=12", { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch("/api/nex/founder/discovery/vocabulary?topic=scaffolding",   { credentials: "include" }).then(r => r.json()).catch(() => null),
      fetch("/api/nex/founder/discovery/relationships?topic=scaffolding", { credentials: "include" }).then(r => r.json()).catch(() => null),
    ]);
    if (s?.ok) setDiscoveryStatus(s.status);
    if (c?.ok) setDiscoveryCycles(c.cycles ?? []);
    if (v?.ok) setVocabulary(v.vocabulary);
    if (r?.ok) setRelationships(r.relationships ?? []);
  }, []);

  const triggerCycle = async () => {
    setTickBusy(true);
    const r = await fetch("/api/cron/nex-discovery-tick?topic=scaffolding&countries=GB", { credentials: "include" }).catch(() => null);
    setTickBusy(false);
    if (!r) return flashErr("Discovery tick failed to reach server.");
    const j = await r.json();
    if (!j.ok) return flashErr(`Discovery tick failed: ${j.error ?? "unknown"}`);
    flashOk(`Discovery cycle #${j.report.cycle_seq} · outcome ${j.report.outcome} · ${j.report.businesses_discovered} businesses observed.`);
    void loadDiscovery();
  };

  useEffect(() => { void loadStatus(); void loadSenders(); void loadCampaigns(); void loadInventory(); void loadDiscovery(); }, [loadStatus, loadSenders, loadCampaigns, loadInventory, loadDiscovery]);
  useEffect(() => { void loadAudience(); }, [loadAudience]);
  useEffect(() => { const id = setInterval(() => { void loadDiscovery(); }, 30_000); return () => clearInterval(id); }, [loadDiscovery]);

  // ─── Send-count guard · never exceeds actual eligible ─────────
  const effectiveSendCount = useMemo(() => {
    if (!audienceCount) return 0;
    if (sendChoice === "AUTO") return audienceCount.eligible;
    return Math.min(sendChoice, audienceCount.eligible);
  }, [audienceCount, sendChoice]);

  // ─── Actions (unchanged from prior Founder Control Centre wave) ─
  const saveDraft = async () => {
    if (!selectedSender) return flashErr("Choose a sender first.");
    if (subject.trim().length < 3) return flashErr("Subject too short.");
    if (bodyText.trim().length < 5) return flashErr("Body too short.");
    const chosen = senders.find(s => s.sender_id === selectedSender);
    if (!chosen) return flashErr("Sender not found.");
    setBusy("saving");
    const blocks: any[] = [];
    if (bannerUrl.trim()) blocks.push({ kind: "image", url: bannerUrl.trim(), alt: "Banner" });
    blocks.push({ kind: "paragraph", text: bodyText });
    if (ctaUrl.trim() && ctaLabel.trim()) blocks.push({ kind: "cta", url: ctaUrl.trim(), label: ctaLabel.trim() });
    if (attachmentUrl.trim()) blocks.push({ kind: "paragraph", text: `Attachment: ${attachmentUrl.trim()}` });

    const r = await fetch("/api/nex/founder/marketing/campaigns", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: subject.slice(0, 80),
        subject_line: subject, preheader,
        from_email: chosen.email, from_name: chosen.display_name ?? undefined,
        sender_id: selectedSender,
        audience: { country: selectedCountry || undefined, category: selectedCategory || undefined },
        content_blocks: blocks,
        banner_image_url: bannerUrl || undefined,
        cta_url: ctaUrl || undefined, cta_label: ctaLabel || undefined,
        footer_text: footer,
      }),
    }).catch(() => null);
    setBusy(null);
    if (!r) return flashErr("Network failure.");
    const j = await r.json();
    if (!j.ok) return flashErr(`${j.error}${j.detail ? ": " + j.detail : ""}`);
    setCurrentCampaign(j.campaign);
    flashOk("Draft saved.");
    void loadCampaigns();
    void loadPreview(j.campaign.campaign_id);
  };

  const loadPreview = async (id: string) => {
    const r = await fetch(`/api/nex/founder/marketing/campaigns/${id}/preview`, { credentials: "include" });
    const j = await r.json();
    if (j.ok) setPreviewHtml(j.preview.compiled_html);
  };

  const doReview = async () => {
    if (!currentCampaign) return flashErr("Save a draft first.");
    setBusy("review");
    const r = await fetch(`/api/nex/founder/marketing/campaigns/${currentCampaign.campaign_id}/review`, { credentials: "include" });
    setBusy(null);
    const j = await r.json();
    if (!j.ok) return flashErr(j.error);
    setReview(j.review);
    if (j.review.send_ready) flashOk("Review PASS · ready to send.");
    else flashErr(`Review found ${j.review.refusal_reasons.length} refusal reason(s).`);
  };

  const sendTest = async () => {
    if (!currentCampaign) return flashErr("Save a draft first.");
    if (!testRecipient) return flashErr("Enter a test recipient.");
    setBusy("test");
    const r = await fetch(`/api/nex/founder/marketing/campaigns/${currentCampaign.campaign_id}/test`, {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ test_recipient: testRecipient }),
    });
    setBusy(null);
    const j = await r.json();
    if (!j.ok) return flashErr(`Test refused: ${j.detail ?? j.error}`);
    flashOk(`Test email accepted by provider (${j.result.provider_message_id ?? "no-id"}).`);
  };

  const doSend = async (mode: "send_to_selected" | "auto_send") => {
    if (!currentCampaign) return flashErr("Save a draft first.");
    if (!review || !review.send_ready) return flashErr("Run review · not send-ready.");
    if (!confirm(`Confirm ${mode.replace("_", " ").toUpperCase()} · ${effectiveSendCount} recipient(s)?`)) return;
    setBusy("send");
    const r = await fetch(`/api/nex/founder/marketing/campaigns/${currentCampaign.campaign_id}/send`, {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    setBusy(null);
    const j = await r.json();
    if (!j.ok) return flashErr(`Send failed: ${j.error}`);
    flashOk(`Enqueued ${j.queued} · executor will pick up.`);
    void loadCampaigns();
  };

  const addSender = async () => {
    if (!addSenderForm.email || !addSenderForm.capacity_source) return flashErr("Email + capacity_source required · never hard-code provider limits.");
    setBusy("add-sender");
    const r = await fetch("/api/nex/founder/marketing/senders", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...addSenderForm,
        daily_capacity: addSenderForm.daily_capacity ? Number(addSenderForm.daily_capacity) : undefined,
        hourly_capacity: addSenderForm.hourly_capacity ? Number(addSenderForm.hourly_capacity) : undefined,
      }),
    });
    setBusy(null);
    const j = await r.json();
    if (!j.ok) return flashErr(`Add failed: ${j.error}${j.detail ? ": " + j.detail : ""}`);
    flashOk(`Sender added · state=${j.sender.authentication_state} · verify before sending.`);
    setShowAddSender(false);
    setAddSenderForm({ email: "", display_name: "", provider: "resend", capacity_source: "", daily_capacity: "", hourly_capacity: "" });
    void loadSenders();
  };

  const chosenSender = useMemo(() => senders.find(s => s.sender_id === selectedSender) ?? null, [senders, selectedSender]);
  const chosenCountry = useMemo(() => inventory?.countries.find(c => c.iso === selectedCountry) ?? null, [inventory, selectedCountry]);
  const chosenCategory = useMemo(() => inventory?.categories.find(c => c.key === selectedCategory) ?? null, [inventory, selectedCategory]);

  // ═══════════════════════════════════════════════════════════════
  // Layout · vertical bands · mobile-first
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1080, margin: "0 auto" }}>

      {flash && (
        <div style={{ position: "sticky", top: 12, zIndex: 10, padding: 10, borderRadius: 6, background: flash.kind === "ok" ? "#e6f7ec" : "#fdecea", color: flash.kind === "ok" ? "#155724" : "#7a1723", fontSize: 13 }}>
          {flash.text}
        </div>
      )}

      {/* ─── 1 · HERO / STATUS ────────────────────────────────── */}
      <SectionCard>
        <StatusStrip status={status} />
      </SectionCard>

      {/* ─── 2 · EMAIL SENDER ─────────────────────────────────── */}
      <SectionCard>
        <SectionTitle>Email Sender</SectionTitle>
        {senders.length === 0 && <Muted>No Founder-lane senders yet. Add one below.</Muted>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
          <select value={selectedSender} onChange={e => setSelectedSender(e.target.value)} style={selStyle}>
            <option value="">— choose sender —</option>
            {senders.map(s => (
              <option key={s.sender_id} value={s.sender_id}>
                {s.email} · {s.health_state}{s.is_sendable ? " · ready" : " · not-ready"}
              </option>
            ))}
          </select>
          <button onClick={() => setShowAddSender(x => !x)} style={btnGhostStyle}>
            {showAddSender ? "Cancel" : "+ Add Founder sender"}
          </button>
        </div>
        {chosenSender && <CapacityChip s={chosenSender} />}
        {showAddSender && (
          <div style={{ display: "grid", gap: 6, marginTop: 10, gridTemplateColumns: "1fr 1fr" }}>
            <input placeholder="email address" value={addSenderForm.email} onChange={e => setAddSenderForm(f => ({ ...f, email: e.target.value }))} style={inputStyle} />
            <input placeholder="display name (optional)" value={addSenderForm.display_name} onChange={e => setAddSenderForm(f => ({ ...f, display_name: e.target.value }))} style={inputStyle} />
            <select value={addSenderForm.provider} onChange={e => setAddSenderForm(f => ({ ...f, provider: e.target.value }))} style={selStyle}>
              <option value="resend">resend</option><option value="sendgrid">sendgrid</option>
              <option value="ses">ses</option><option value="mailgun">mailgun</option><option value="postmark">postmark</option>
            </select>
            <input placeholder="capacity source (e.g. resend-dashboard-2026-09-21)" value={addSenderForm.capacity_source} onChange={e => setAddSenderForm(f => ({ ...f, capacity_source: e.target.value }))} style={inputStyle} />
            <input placeholder="daily capacity" value={addSenderForm.daily_capacity} onChange={e => setAddSenderForm(f => ({ ...f, daily_capacity: e.target.value }))} style={inputStyle} />
            <input placeholder="hourly capacity" value={addSenderForm.hourly_capacity} onChange={e => setAddSenderForm(f => ({ ...f, hourly_capacity: e.target.value }))} style={inputStyle} />
            <button onClick={addSender} disabled={busy === "add-sender"} style={{ ...btnPrimaryStyle, gridColumn: "span 2" }}>
              {busy === "add-sender" ? "Adding…" : "Add sender"}
            </button>
            <Muted>Provider limits are hard constraints · never hard-coded.</Muted>
          </div>
        )}
      </SectionCard>

      {/* ─── 3 · EMAIL STORAGE (NEW · directly under sender) ──── */}
      <SectionCard>
        <SectionTitle>Email Storage</SectionTitle>
        <Muted>NEX contacts available for managed marketing outreach. Aggregate view · no addresses displayed.</Muted>
        {!inventory && <Muted>Loading storage…</Muted>}
        {inventory && (
          <>
            {/* Hero row · one big live number + compact metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
              <MetricCard main={inventory.total.toLocaleString()} label="contacts stored" strong />
              <MetricCard main={String(inventory.countries.length)} label="countries" />
              <MetricCard main={String(inventory.categories.length)} label="categories" />
              <MetricCard main={inventory.not_suppressed.toLocaleString()} label="eligible now" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <MetricCard main={inventory.suppressed.total.toLocaleString()} label={`suppressed (${inventory.suppressed.opt_out} opt-out · ${inventory.suppressed.hard_bounced} bounced · ${inventory.suppressed.complaint} complaint)`} muted />
              <MetricCard main={inventory.activity.new_last_7_days === null ? "—" : String(inventory.activity.new_last_7_days)} label="new last 7 days" muted />
            </div>

            {/* Country + Category grid selectors */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 18 }}>
              <div>
                <label style={labelStyle}>Country</label>
                <div style={{ display: "grid", gap: 4, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                  {inventory.countries.map(c => (
                    <button key={c.iso} onClick={() => setSelectedCountry(c.iso)}
                      style={{ ...rowButton, borderColor: selectedCountry === c.iso ? "#166534" : "rgba(0,0,0,0.10)", background: selectedCountry === c.iso ? "#eaf5ee" : "#fff" }}>
                      <span>{c.name}</span>
                      <span style={{ color: "#666", fontVariantNumeric: "tabular-nums" }}>{c.total.toLocaleString()}</span>
                    </button>
                  ))}
                  {inventory.countries.length === 0 && <Muted>No countries in storage.</Muted>}
                </div>
                <Muted>Only countries with real stored contacts appear · never inferred from email domain.</Muted>
              </div>
              <div>
                <label style={labelStyle}>Product / Service Category</label>
                <div style={{ display: "grid", gap: 4, maxHeight: 240, overflowY: "auto", paddingRight: 4 }}>
                  <button onClick={() => setSelectedCategory("")}
                    style={{ ...rowButton, borderColor: selectedCategory === "" ? "#166534" : "rgba(0,0,0,0.10)", background: selectedCategory === "" ? "#eaf5ee" : "#fff" }}>
                    <span>(all categories)</span>
                    <span style={{ color: "#666", fontVariantNumeric: "tabular-nums" }}>{inventory.total.toLocaleString()}</span>
                  </button>
                  {inventory.categories.map(c => (
                    <button key={c.key} onClick={() => setSelectedCategory(c.key)}
                      style={{ ...rowButton, borderColor: selectedCategory === c.key ? "#166534" : "rgba(0,0,0,0.10)", background: selectedCategory === c.key ? "#eaf5ee" : "#fff" }}>
                      <span>{c.label}</span>
                      <span style={{ color: "#666", fontVariantNumeric: "tabular-nums" }}>{c.total.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Selection outcome · live audience */}
            <div style={{ marginTop: 18, padding: 12, background: "#f8faf7", borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4, color: "#555" }}>Selected audience</div>
              <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>
                {chosenCountry?.name ?? "any country"} · {chosenCategory?.label ?? "any category"}
              </div>
              {audienceCount && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                  <MetricCard main={audienceCount.total_discovered.toLocaleString()} label="stored" small />
                  <MetricCard main={audienceCount.eligible.toLocaleString()} label="eligible" small strong />
                  <MetricCard main={((audienceCount.opt_out ?? 0) + (audienceCount.hard_bounced ?? 0) + (audienceCount.complaint ?? 0)).toLocaleString()} label="suppressed" small muted />
                </div>
              )}
              <div style={{ marginTop: 14 }}>
                <label style={labelStyle}>Send count for this campaign</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {SEND_COUNT_OPTIONS.map(n => (
                    <button key={n} onClick={() => setSendChoice(n)}
                      disabled={audienceCount ? audienceCount.eligible < n : false}
                      style={{ ...pillButton, ...(sendChoice === n ? pillActive : {}), opacity: audienceCount && audienceCount.eligible < n ? 0.4 : 1 }}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setSendChoice("AUTO")} style={{ ...pillButton, ...(sendChoice === "AUTO" ? pillActive : {}) }}>
                    AUTO
                  </button>
                </div>
                <Muted>
                  Selected: <strong>{effectiveSendCount.toLocaleString()}</strong> recipient(s).
                  AUTO uses the full eligible audience under current campaign/package/lane rules · not unlimited sending.
                </Muted>
              </div>
            </div>

            {/* Provenance panel · aggregate only · no addresses */}
            <div style={{ marginTop: 16 }}>
              <button onClick={() => setShowSources(x => !x)} style={btnGhostStyle}>
                {showSources ? "Hide" : "Show"} where NEX found them
              </button>
              {showSources && (
                <div style={{ marginTop: 8, padding: 10, background: "#fafafa", borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4, color: "#555", marginBottom: 6 }}>Aggregate source breakdown</div>
                  {inventory.sources.length === 0 && <Muted>No source data available.</Muted>}
                  {inventory.sources.map(s => (
                    <div key={s.source_table} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, padding: "4px 0", fontSize: 13 }}>
                      <span style={{ color: "#333" }}>{s.source_table}</span>
                      <span style={{ color: "#666", fontVariantNumeric: "tabular-nums" }}>{s.n.toLocaleString()}</span>
                    </div>
                  ))}
                  <Muted>Aggregate counts only · no addresses displayed · no export path.</Muted>
                </div>
              )}
            </div>

            {/* Contact proof · honest 'not available' per §10 */}
            <div style={{ marginTop: 12 }}>
              <button onClick={() => flashErr("Contact proof unavailable — backend capability not yet implemented (§10 · discovery activation record 2026-09-21).")}
                style={btnGhostStyle}>
                View Contact Proof
              </button>
              <Muted>
                Aggregate proof only in this wave · no raw addresses · no CSV · no download.
              </Muted>
            </div>

            {/* Activity strip */}
            <div style={{ marginTop: 14, fontSize: 12, color: "#666", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>Last ingestion: <strong>{inventory.activity.last_ingestion_at ? new Date(inventory.activity.last_ingestion_at).toLocaleString() : "—"}</strong></div>
              <div>Sources active: <strong>{inventory.sources.length}</strong></div>
            </div>
          </>
        )}
      </SectionCard>

      {/* ─── 3.5 · NEX DISCOVERY MONITOR ──────────────────────── */}
      <SectionCard>
        <SectionTitle>NEX Discovery</SectionTitle>
        <Muted>Live 5-minute cycles · what NEX is searching for and what it observed. Discovery ≠ send.</Muted>

        {/* Cycle status strip */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", marginTop: 12, padding: 10, background: discoveryStatus?.running_cycle_id ? "#e6f7ec" : "#f8faf7", borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "4px 10px", background: discoveryStatus?.running_cycle_id ? "#166534" : "#333", color: "#fff", borderRadius: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
            {discoveryStatus?.running_cycle_id ? "RUNNING" : "IDLE"}
          </div>
          <div style={{ fontSize: 12, color: "#333" }}>
            {discoveryStatus?.last_completed_cycle
              ? <>Last cycle #{discoveryStatus.last_completed_cycle.cycle_seq} · started {new Date(discoveryStatus.last_completed_cycle.started_at).toLocaleTimeString()} · outcome <strong>{discoveryStatus.last_completed_cycle.outcome}</strong> · duration {discoveryStatus.last_completed_cycle.duration_ms ?? 0}ms</>
              : <>No completed cycles yet.</>}
            <br />
            <span style={{ color: "#666" }}>
              Next expected: {discoveryStatus?.next_expected_at ? new Date(discoveryStatus.next_expected_at).toLocaleTimeString() : "—"} · cadence {discoveryStatus?.cadence_seconds ?? 300}s
            </span>
          </div>
          <button onClick={triggerCycle} disabled={tickBusy} style={btnGhostStyle}>
            {tickBusy ? "Running…" : "Run cycle now"}
          </button>
        </div>

        {/* Latest cycle metric grid */}
        {discoveryStatus?.last_completed_cycle && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginTop: 12 }}>
            <MetricCard main={String(discoveryStatus.last_completed_cycle.searches_attempted)} label="searches" small />
            <MetricCard main={String(discoveryStatus.last_completed_cycle.sources_attempted.length)} label="sources" small />
            <MetricCard main={String(discoveryStatus.last_completed_cycle.businesses_discovered)} label="businesses" small strong={discoveryStatus.last_completed_cycle.businesses_discovered > 0} />
            <MetricCard main={String(discoveryStatus.last_completed_cycle.new_emails)} label="new emails" small />
            <MetricCard main={String(discoveryStatus.last_completed_cycle.existing_matched)} label="existing" small muted />
            <MetricCard main={String(discoveryStatus.last_completed_cycle.rejected_emails)} label="rejected" small muted />
          </div>
        )}

        {/* Search vocabulary tree */}
        {vocabulary && (
          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>Search vocabulary</label>
            <Muted>Seeds are founder-authored · candidates emerge from evidence · only founder-approved terms move to validated.</Muted>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, marginTop: 8, fontSize: 12 }}>
              <div style={{ color: "#166534", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Seeds ({vocabulary.seeds.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {vocabulary.seeds.map(s => <TermChip key={s.term} term={s.term} status="seed" evidence={s.evidence_count} />)}
              </div>
              <div style={{ color: "#166534", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Validated ({vocabulary.validated.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {vocabulary.validated.map(s => <TermChip key={s.term} term={s.term} status="validated" evidence={s.evidence_count} />)}
              </div>
              <div style={{ color: "#8a5a00", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>Candidates ({vocabulary.candidates.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {vocabulary.candidates.length === 0
                  ? <Muted>None observed yet · candidates are recorded when evidence is seen · never silently promoted to validated.</Muted>
                  : vocabulary.candidates.map(s => <TermChip key={s.term} term={s.term} status="candidate" evidence={s.evidence_count} />)}
              </div>
            </div>
          </div>
        )}

        {/* Related-term relationships */}
        {relationships.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>Observed relationships (evidence-backed)</label>
            <div style={{ display: "grid", gap: 4 }}>
              {relationships.slice(0, 20).map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 8, padding: "6px 8px", background: "#fafafa", borderRadius: 4, fontSize: 12 }}>
                  <span><strong>{r.parent_term}</strong> → {r.child_term}</span>
                  <span style={{ color: "#666" }}>{r.relationship_kind}</span>
                  <span style={{ color: "#666" }}>evidence {r.evidence_count}</span>
                  <span style={{ color: "#666" }}>conf {r.confidence.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5-minute rolling history */}
        <div style={{ marginTop: 18 }}>
          <label style={labelStyle}>Recent cycles (5-minute rolling · last {discoveryCycles.length})</label>
          {discoveryCycles.length === 0 && <Muted>No cycles yet.</Muted>}
          {discoveryCycles.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                    <th style={thStyle}>#</th>
                    <th style={thStyle}>Started</th>
                    <th style={thStyle}>Outcome</th>
                    <th style={thStyle}>Searches</th>
                    <th style={thStyle}>Sources</th>
                    <th style={thStyle}>Businesses</th>
                    <th style={thStyle}>New emails</th>
                    <th style={thStyle}>Existing</th>
                    <th style={thStyle}>Rejected</th>
                    <th style={thStyle}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {discoveryCycles.map(c => (
                    <tr key={c.cycle_id} style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                      <td style={tdStyle}>{c.cycle_seq}</td>
                      <td style={tdStyle}>{new Date(c.started_at).toLocaleTimeString()}</td>
                      <td style={{ ...tdStyle, color: c.outcome === "complete" ? "#166534" : c.outcome === "source_unavailable" ? "#7a1723" : "#8a5a00" }}>{c.outcome}</td>
                      <td style={tdStyle}>{c.searches_attempted}</td>
                      <td style={tdStyle}>{c.sources_attempted.length}</td>
                      <td style={tdStyle}>{c.businesses_discovered}</td>
                      <td style={tdStyle}>{c.new_emails}</td>
                      <td style={tdStyle}>{c.existing_matched}</td>
                      <td style={tdStyle}>{c.rejected_emails}</td>
                      <td style={tdStyle}>{c.duration_ms ?? "—"}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Muted>SOURCE UNAVAILABLE is a distinct state from ZERO_RESULTS · a source that failed is never reported as "0 businesses."</Muted>
        </div>

        <div style={{ marginTop: 12, padding: 8, background: "#f8faf7", borderRadius: 4, fontSize: 11, color: "#333" }}>
          <strong>Discipline:</strong> Cycles never trigger send · never expose addresses · never silently promote candidates. Governance canaries enforced at DB level (sends_triggered=0 · addresses_exposed=0 CHECK constraints).
        </div>
      </SectionCard>

      {/* ─── 4 · COMPOSER ─────────────────────────────────────── */}
      <SectionCard>
        <SectionTitle>Compose</SectionTitle>
        <Muted>Audience: <strong>{chosenCountry?.name ?? "any country"} · {chosenCategory?.label ?? "any category"} · {effectiveSendCount.toLocaleString()} recipient(s)</strong>. Change the selection above to update.</Muted>
        <label style={labelStyle}>Subject line</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="What owners will see in the inbox" style={inputStyle} />
        <label style={labelStyle}>Preheader (optional)</label>
        <input value={preheader} onChange={e => setPreheader(e.target.value)} style={inputStyle} />
        <label style={labelStyle}>Body</label>
        <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} placeholder="Write your message. Plain text renders as paragraphs." style={{ ...inputStyle, minHeight: 180, fontFamily: "inherit" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <div>
            <label style={labelStyle}>Banner image URL</label>
            <input value={bannerUrl} onChange={e => setBannerUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Attachment URL</label>
            <input value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} placeholder="https://…" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>CTA URL</label>
            <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="https://thenetworkers.app/…" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>CTA label</label>
            <input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="Open Trade Centre" style={inputStyle} />
          </div>
        </div>
        <label style={labelStyle}>Footer / sign-off</label>
        <textarea value={footer} onChange={e => setFooter(e.target.value)} style={{ ...inputStyle, minHeight: 60, fontFamily: "inherit" }} />
        <Muted>Global unsubscribe enforced at send time · List-Unsubscribe one-click always included.</Muted>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={saveDraft} disabled={busy === "saving"} style={btnPrimaryStyle}>
            {busy === "saving" ? "Saving…" : (currentCampaign ? "Save as new draft" : "Save draft")}
          </button>
          <button onClick={() => currentCampaign && loadPreview(currentCampaign.campaign_id)} disabled={!currentCampaign} style={btnGhostStyle}>
            Refresh preview
          </button>
        </div>
      </SectionCard>

      {/* ─── 5 · PREVIEW ──────────────────────────────────────── */}
      <SectionCard>
        <SectionTitle>Preview</SectionTitle>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button onClick={() => setPreviewMode("desktop")} style={previewMode === "desktop" ? btnSmallActive : btnSmall}>Desktop · 640px</button>
          <button onClick={() => setPreviewMode("mobile")} style={previewMode === "mobile" ? btnSmallActive : btnSmall}>Mobile · 375px</button>
        </div>
        <div style={{ background: "#f3f4f6", padding: 12, borderRadius: 6, display: "flex", justifyContent: "center" }}>
          <iframe title="preview" srcDoc={previewHtml || "<p style='color:#999;font-family:system-ui;padding:20px'>Save a draft to see the compiled preview.</p>"}
            style={{ width: previewMode === "desktop" ? 640 : 375, height: 520, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 4, background: "#fff" }} />
        </div>
      </SectionCard>

      {/* ─── 6 · TEST / REVIEW / SEND ─────────────────────────── */}
      <SectionCard>
        <SectionTitle>Test · Review · Send</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Test email</label>
            <input placeholder="test@example.com" value={testRecipient} onChange={e => setTestRecipient(e.target.value)} style={inputStyle} />
            <button onClick={sendTest} disabled={!currentCampaign || busy === "test"} style={btnGhostStyle}>
              {busy === "test" ? "Sending…" : "Send test email"}
            </button>
            <Muted>Actual compiled email · isolated · not counted.</Muted>
          </div>
          <div>
            <label style={labelStyle}>Review</label>
            <button onClick={doReview} disabled={!currentCampaign || busy === "review"} style={btnGhostStyle}>
              {busy === "review" ? "Reviewing…" : "Run review"}
            </button>
            {review && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <div><strong>{review.send_ready ? "READY" : "NOT READY"}</strong></div>
                <div>Recipients: {review.audience_count.eligible}</div>
                <div>Sender: {review.sender.email} · {review.sender.health_state}</div>
                {review.refusal_reasons.length > 0 && (
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "#7a1723" }}>
                    {review.refusal_reasons.map((r, i) => <li key={i}>{r.kind}: {r.detail}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Send</label>
            <button onClick={() => doSend("send_to_selected")} disabled={!review?.send_ready || busy === "send"} style={btnPrimaryStyle}>
              Send to selected
            </button>
            <button onClick={() => doSend("auto_send")} disabled={!review?.send_ready || busy === "send"} style={btnGhostStyle}>
              Enqueue for AUTO lane
            </button>
            <Muted>Both go through the shared executor. Founder sends never consume member packages.</Muted>
          </div>
        </div>
      </SectionCard>

      {/* Recent campaigns · compact footer */}
      <SectionCard>
        <SectionTitle>Recent Founder campaigns</SectionTitle>
        {campaigns.length === 0 && <Muted>No campaigns yet.</Muted>}
        <div style={{ display: "grid", gap: 6 }}>
          {campaigns.slice(0, 8).map(c => (
            <button key={c.campaign_id} onClick={() => { setCurrentCampaign(c); void loadPreview(c.campaign_id); setReview(null); }}
              style={{ ...campaignBox, borderColor: currentCampaign?.campaign_id === c.campaign_id ? "#1E7F51" : "rgba(0,0,0,0.12)" }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{c.display_name}</div>
              <div style={{ fontSize: 11, color: "#666" }}>{c.status} · sent {c.send_count} · target {c.target_count}</div>
            </button>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── UI fragments ─────────────────────────────────────────────
function SectionCard({ children }: { children: React.ReactNode }) {
  return <section style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, padding: 16 }}>{children}</section>;
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: "0 0 6px", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.5, color: "#333" }}>{children}</h3>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{children}</div>;
}
function MetricCard({ main, label, strong = false, muted = false, small = false }: { main: string; label: string; strong?: boolean; muted?: boolean; small?: boolean }) {
  return (
    <div style={{ background: strong ? "#166534" : muted ? "#f3f4f6" : "#f8faf7", color: strong ? "#fff" : "#111", padding: small ? 8 : 12, borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: small ? 18 : 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{main}</div>
      <div style={{ fontSize: 11, color: strong ? "rgba(255,255,255,0.85)" : "#666", marginTop: 2 }}>{label}</div>
    </div>
  );
}
function StatusStrip({ status }: { status: SystemStatus | null }) {
  if (!status) return <div style={{ padding: 8, color: "#666", fontSize: 13 }}>Loading system status…</div>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Founder Control Centre</div>
        <div style={{ fontSize: 12, color: "#333", marginTop: 2 }}>
          System <strong>{status.ready ? "READY" : "not ready"}</strong> · Provider {status.primary_provider} · Senders {status.active_senders}/{status.total_founder_senders} · Queue {status.pending_queue}
        </div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
          Compliance: {status.compliance_ok ? "OK" : "attention"} · AUTO: {status.auto_state} · Backend: {status.backend_available ? "up" : "down"}
        </div>
      </div>
      <div style={{ padding: "4px 10px", background: status.ready ? "#e6f7ec" : "#fff7d1", color: status.ready ? "#155724" : "#7a1723", borderRadius: 4, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {status.ready ? "READY" : "not ready"}
      </div>
    </div>
  );
}
function CapacityChip({ s }: { s: Sender }) {
  const eff = s.capacity.effective_remaining;
  return (
    <div style={{ fontSize: 11, color: "#333", marginTop: 8, padding: 6, background: "#f3f4f6", borderRadius: 4 }}>
      Hourly: {s.capacity.hourly_used}/{s.capacity.hourly_limit ?? "∞"} · Daily: {s.capacity.daily_used}/{s.capacity.daily_limit ?? "∞"}
      {eff !== null && <> · Remaining: {eff}</>}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 6, fontSize: 14, boxSizing: "border-box", minHeight: 44 };
const selStyle: React.CSSProperties = { ...inputStyle };
const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 8, marginBottom: 2 };
const btnPrimaryStyle: React.CSSProperties = { padding: "12px 16px", background: "#166534", color: "#fff", border: 0, borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer", minHeight: 48, marginTop: 6 };
const btnGhostStyle: React.CSSProperties = { padding: "10px 14px", background: "#fff", color: "#166534", border: "1px solid #166534", borderRadius: 6, fontSize: 13, cursor: "pointer", minHeight: 44, marginTop: 6 };
const btnSmall: React.CSSProperties = { padding: "6px 12px", background: "#fff", color: "#333", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 6, fontSize: 12, cursor: "pointer", minHeight: 32 };
const btnSmallActive: React.CSSProperties = { ...btnSmall, background: "#166534", color: "#fff", border: "1px solid #166534" };
const rowButton: React.CSSProperties = { textAlign: "left", background: "#fff", border: "1px solid rgba(0,0,0,0.10)", borderRadius: 6, padding: "10px 12px", cursor: "pointer", display: "grid", gridTemplateColumns: "1fr auto", gap: 8, minHeight: 44, fontSize: 13 };
const campaignBox: React.CSSProperties = { textAlign: "left", background: "#fff", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 6, padding: 10, cursor: "pointer", minHeight: 48 };
const pillButton: React.CSSProperties = { padding: "8px 14px", background: "#fff", color: "#333", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 999, fontSize: 13, cursor: "pointer", minHeight: 40, minWidth: 56, fontWeight: 600 };
const pillActive: React.CSSProperties = { background: "#166534", color: "#fff", borderColor: "#166534" };
const thStyle: React.CSSProperties = { padding: "6px 8px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "#555", fontWeight: 700, whiteSpace: "nowrap" };
const tdStyle: React.CSSProperties = { padding: "6px 8px", fontSize: 12, color: "#333", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

function TermChip({ term, status, evidence }: { term: string; status: "seed" | "validated" | "candidate" | "rejected"; evidence: number }) {
  const styles: Record<string, React.CSSProperties> = {
    seed:       { background: "#166534", color: "#fff",    border: "1px solid #166534" },
    validated:  { background: "#eaf5ee", color: "#166534", border: "1px solid #166534" },
    candidate:  { background: "#fff7d1", color: "#8a5a00", border: "1px solid #b98d3c" },
    rejected:   { background: "#fdecea", color: "#7a1723", border: "1px solid #7a1723" },
  };
  return (
    <span style={{ ...styles[status], padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, display: "inline-flex", gap: 6 }}>
      <span>{term}</span>
      {evidence > 0 && <span style={{ opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>· {evidence}</span>}
    </span>
  );
}
