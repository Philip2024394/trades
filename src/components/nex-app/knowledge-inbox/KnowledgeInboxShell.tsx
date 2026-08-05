"use client";

// KnowledgeInboxShell — the client surface for /nex-app/knowledge-inbox.
//
// Composes:
//   · Hero + subtitle
//   · Seven statistic cards (Items Waiting · Processing · Needs Review ·
//     Completed Today · Records Created · Records Updated · FAQs Generated)
//   · Five capture surfaces (Drag & Drop · Quick Dump · URL Import ·
//     Voice Notes · Image Analysis) — one inbox, many mouths
//   · Inbox Queue with per-item status chip + row actions
//   · Large "Process Inbox" CTA
//   · Processing Report overlay
//
// v1 is UI-first: capture surfaces write to an in-memory queue and the
// Process Inbox button runs a simulated pipeline. Every seam that would
// call an API in v2 is marked with a `// TODO(api):` comment so the
// backend can attach without rewriting the shell.
//
// Future connectors (Email · WhatsApp · OneDrive · Google Drive · Dropbox
// · GitHub · Website crawler · YouTube transcripts · Research feeds ·
// Government publications · Standards organisations · PDF libraries)
// all feed the SAME `addItems(...)` reducer — one pipeline, many mouths.

import { useCallback, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  FileText,
  Flame,
  History,
  Image as ImageIcon,
  Inbox,
  Link as LinkIcon,
  Loader2,
  Mic,
  RefreshCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────

type InboxKind =
  | "text"       // paste / typed note
  | "file"       // any uploaded file
  | "url"        // pasted url
  | "voice"      // audio recording
  | "image";     // photo / diagram

type InboxStatus =
  | "waiting"    // grey  — awaiting classification
  | "processing" // blue  — in flight
  | "review"    // orange — flagged for human review
  | "processed"; // green  — merged into a record

type InboxItem = {
  id: string;
  title: string;
  kind: InboxKind;
  status: InboxStatus;
  createdAt: number;
  meta?: string;         // e.g. filename, url, byte size, duration
  previewText?: string;  // first 200 chars for the preview drawer
};

type ProcessingReport = {
  itemsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  faqsGenerated: number;
  edgesCreated: number;
  duplicatesMerged: number;
  imagesAnalysed: number;
  voiceNotesTranscribed: number;
  needsReview: number;
};

// ── Design tokens (mirror --nex-* CSS custom properties) ─────────────

const TOKEN = {
  bg:           "var(--nex-cream)",
  surface:      "var(--nex-cream-elev)",
  card:         "var(--nex-neutral-0)",
  border:       "var(--nex-neutral-200)",
  divider:      "var(--nex-neutral-100)",
  text:         "var(--nex-neutral-900)",
  textSoft:     "var(--nex-neutral-500)",
  textMid:      "var(--nex-neutral-700)",
  accent:       "var(--nex-accent-500)",
  accentDark:   "var(--nex-accent-600)",
  accentSoft:   "var(--nex-accent-50)",
  accentPeach:  "var(--nex-accent-100)",
  success:      "var(--nex-success-500)",
  warning:      "var(--nex-warning-500)",
  info:         "var(--nex-info-500)",
  shadowSm:     "var(--nex-shadow-sm)",
  shadowMd:     "var(--nex-shadow-md)",
  shadowLg:     "var(--nex-shadow-lg)",
};

// ── Status colour palette (Philip's spec verbatim) ───────────────────

const STATUS_STYLE: Record<InboxStatus, { label: string; bg: string; fg: string; dot: string }> = {
  waiting:    { label: "Waiting",     bg: "#EDECEA", fg: "#3D3D38", dot: "#A3A39C" },
  processing: { label: "Processing",  bg: "#DBEAFE", fg: "#1D4ED8", dot: "#3B82F6" },
  review:     { label: "Needs review", bg: "#FED7AA", fg: "#9A3412", dot: "#F97316" },
  processed:  { label: "Processed",   bg: "#D1FAE5", fg: "#065F46", dot: "#10B981" },
};

// ── Accepted file extensions (per Philip's spec) ─────────────────────

const ACCEPT_ATTR = [
  ".txt", ".md",
  ".pdf", ".docx",
  ".csv", ".xlsx",
  ".jpg", ".jpeg", ".png", ".webp",
  ".mp3", ".wav",
  ".mp4",
  ".zip",
].join(",");

// ── Seed items — realistic v1 fixtures so the queue is never empty on
// first visit. Delete or dismiss freely. ─────────────────────────────

const SEED_ITEMS: InboxItem[] = [
  {
    id: "seed-1",
    title: "Q&A batch · walnut vs oak decision points",
    kind: "text",
    status: "waiting",
    createdAt: Date.now() - 1000 * 60 * 42,
    meta: "18 questions",
    previewText:
      "Q: Which is harder — walnut or oak? A: American White Oak is measurably harder…",
  },
  {
    id: "seed-2",
    title: "Approved Doc K — 2013 edition (with 2020 amendments).pdf",
    kind: "file",
    status: "review",
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    meta: "PDF · 2.1 MB",
    previewText:
      "Requirement K1 — Stairs, ladders and ramps. Design and construction should…",
  },
  {
    id: "seed-3",
    title: "gov.uk · Ash Dieback update — DEFRA guidance",
    kind: "url",
    status: "processed",
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    meta: "gov.uk · fetched",
    previewText:
      "Ash Dieback (Hymenoscyphus fraxineus) continues to affect ash trees across…",
  },
  {
    id: "seed-4",
    title: "Voice note — Signature tier newel discussion",
    kind: "voice",
    status: "processing",
    createdAt: Date.now() - 1000 * 60 * 12,
    meta: "audio · 4m 22s",
    previewText: "Transcribing…",
  },
  {
    id: "seed-5",
    title: "Photograph — turned oak baluster reference",
    kind: "image",
    status: "waiting",
    createdAt: Date.now() - 1000 * 60 * 5,
    meta: "JPG · 1.4 MB",
    previewText: "Awaiting image analysis…",
  },
];

// ── Utility helpers ──────────────────────────────────────────────────

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function humanTime(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function kindIcon(kind: InboxKind) {
  switch (kind) {
    case "text":  return FileText;
    case "file":  return Upload;
    case "url":   return LinkIcon;
    case "voice": return Mic;
    case "image": return ImageIcon;
  }
}

function kindLabel(kind: InboxKind) {
  switch (kind) {
    case "text":  return "Note";
    case "file":  return "File";
    case "url":   return "URL";
    case "voice": return "Voice";
    case "image": return "Image";
  }
}

// Rough classifier for the simulated pipeline — good enough for the
// v1 report; v2 replaces this with the Reasoning Layer + Master
// Aggregator behind the /api/nex/knowledge-inbox/process endpoint.
function simulateProcessing(items: InboxItem[]): ProcessingReport {
  const itemsProcessed = items.length;
  const imagesAnalysed = items.filter((i) => i.kind === "image").length;
  const voiceNotesTranscribed = items.filter((i) => i.kind === "voice").length;
  // Rough heuristics that feel plausible without pretending to be real.
  const recordsCreated  = Math.max(0, Math.floor(itemsProcessed * 0.14));
  const recordsUpdated  = Math.max(0, Math.floor(itemsProcessed * 0.42));
  const faqsGenerated   = Math.max(0, Math.floor(itemsProcessed * 4.6));
  const edgesCreated    = Math.max(0, Math.floor(itemsProcessed * 1.7));
  const duplicatesMerged = Math.max(0, Math.floor(itemsProcessed * 0.31));
  const needsReview     = Math.max(0, Math.floor(itemsProcessed * 0.04));
  return {
    itemsProcessed,
    recordsCreated,
    recordsUpdated,
    faqsGenerated,
    edgesCreated,
    duplicatesMerged,
    imagesAnalysed,
    voiceNotesTranscribed,
    needsReview,
  };
}

// ── Root component ───────────────────────────────────────────────────

export function KnowledgeInboxShell() {
  const [items, setItems] = useState<InboxItem[]>(SEED_ITEMS);
  const [quickDump, setQuickDump] = useState("");
  const [urlBuffer, setUrlBuffer] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingReport, setProcessingReport] = useState<ProcessingReport | null>(null);
  const [preview, setPreview] = useState<InboxItem | null>(null);
  const [completedToday, setCompletedToday] = useState(0);
  const [totalsRecordsCreated, setTotalsRecordsCreated] = useState(19);
  const [totalsRecordsUpdated, setTotalsRecordsUpdated] = useState(52);
  const [totalsFaqsGenerated, setTotalsFaqsGenerated] = useState(380);

  const fileInputRef  = useRef<HTMLInputElement | null>(null);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // ── Reducer-style helpers ──────────────────────────────────────────

  const addItems = useCallback((incoming: InboxItem[]) => {
    if (!incoming.length) return;
    setItems((prev) => [...incoming, ...prev]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const reprocessItem = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "waiting" as InboxStatus } : i))
    );
  }, []);

  // ── Capture surface handlers ───────────────────────────────────────

  const captureFiles = useCallback(
    (fileList: FileList | null, forcedKind?: InboxKind) => {
      if (!fileList) return;
      const arr = Array.from(fileList);
      if (!arr.length) return;
      // TODO(api): POST each file to /api/nex/knowledge-inbox/upload
      // and use the server-assigned id; v1 stores locally.
      const created: InboxItem[] = arr.map((f) => {
        const kind =
          forcedKind ??
          (f.type.startsWith("image/")
            ? ("image" as InboxKind)
            : f.type.startsWith("audio/")
              ? ("voice" as InboxKind)
              : ("file" as InboxKind));
        const kb = f.size / 1024;
        const meta =
          kb > 1024
            ? `${f.type || "file"} · ${(kb / 1024).toFixed(1)} MB`
            : `${f.type || "file"} · ${kb.toFixed(0)} KB`;
        return {
          id: makeId(kind),
          title: f.name,
          kind,
          status: "waiting",
          createdAt: Date.now(),
          meta,
          previewText:
            kind === "image"
              ? "Awaiting image analysis…"
              : kind === "voice"
                ? "Awaiting transcription…"
                : `${f.name} · ${(f.size / 1024).toFixed(0)} KB uploaded`,
        };
      });
      addItems(created);
    },
    [addItems]
  );

  const handleQuickDumpSave = useCallback(
    (thenProcess: boolean) => {
      const text = quickDump.trim();
      if (!text) return;
      const first = text.split("\n")[0]?.slice(0, 90) ?? "Note";
      const item: InboxItem = {
        id: makeId("text"),
        title: first || "Note",
        kind: "text",
        status: "waiting",
        createdAt: Date.now(),
        meta: `${text.length.toLocaleString()} chars`,
        previewText: text.slice(0, 220),
      };
      addItems([item]);
      setQuickDump("");
      if (thenProcess) {
        // Fire-and-forget: kick the processor once the item is committed.
        setTimeout(() => runProcessInbox(), 100);
      }
    },
    [addItems, quickDump]
  );

  const handleUrlImport = useCallback(() => {
    const raw = urlBuffer.trim();
    if (!raw) return;
    // Accept multiple URLs, comma / newline / space separated.
    const urls = raw
      .split(/[\s,]+/)
      .map((u) => u.trim())
      .filter((u) => u.length > 0);
    if (!urls.length) return;
    // TODO(api): POST { urls } to /api/nex/knowledge-inbox/urls
    // so the crawler can fetch, store, and hash for dedupe.
    const created: InboxItem[] = urls.map((u) => ({
      id: makeId("url"),
      title: u.replace(/^https?:\/\//, "").slice(0, 80),
      kind: "url",
      status: "waiting",
      createdAt: Date.now(),
      meta: "URL · queued for fetch",
      previewText: u,
    }));
    addItems(created);
    setUrlBuffer("");
  }, [addItems, urlBuffer]);

  // ── Drag & drop plumbing ───────────────────────────────────────────

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      captureFiles(e.dataTransfer?.files ?? null);
    },
    [captureFiles]
  );

  // ── The core action: Process Inbox ─────────────────────────────────

  const runProcessInbox = useCallback(() => {
    // TODO(api): POST /api/nex/knowledge-inbox/process — server-side
    // pipeline runs classify → dedupe → extract → update/create →
    // FAQ → graph edges → confidence → flag → archive. The response
    // shape mirrors ProcessingReport.
    const waiting = items.filter((i) => i.status === "waiting");
    if (!waiting.length) return;

    setIsProcessing(true);

    // Phase 1: flip everything waiting to processing.
    setItems((prev) =>
      prev.map((i) => (i.status === "waiting" ? { ...i, status: "processing" } : i))
    );

    // Phase 2: after a brief simulated run, flip processing items to
    // processed (except ~4% flagged for review) and compose a report.
    window.setTimeout(() => {
      setItems((prev) => {
        const outcome = prev.map((i, idx) => {
          if (i.status !== "processing") return i;
          const flag = idx % 25 === 0; // roughly 4% flagged
          return { ...i, status: flag ? ("review" as InboxStatus) : ("processed" as InboxStatus) };
        });
        return outcome;
      });
      const report = simulateProcessing(waiting);
      setProcessingReport(report);
      setCompletedToday((c) => c + report.itemsProcessed - report.needsReview);
      setTotalsRecordsCreated((c) => c + report.recordsCreated);
      setTotalsRecordsUpdated((c) => c + report.recordsUpdated);
      setTotalsFaqsGenerated((c) => c + report.faqsGenerated);
      setIsProcessing(false);
    }, 1600);
  }, [items]);

  // ── Derived counters for the stat strip ────────────────────────────

  const counters = useMemo(() => {
    const c = { waiting: 0, processing: 0, review: 0 };
    for (const i of items) {
      if (i.status === "waiting") c.waiting += 1;
      else if (i.status === "processing") c.processing += 1;
      else if (i.status === "review") c.review += 1;
    }
    return c;
  }, [items]);

  // ────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative min-h-screen"
      style={{ background: TOKEN.bg, color: TOKEN.text }}
    >
      <div className="mx-auto max-w-[1120px] px-5 pb-24 pt-8 md:px-8 md:pt-12">
        {/* ── Hero ────────────────────────────────────────────────── */}
        <Hero />

        {/* ── Stat strip ──────────────────────────────────────────── */}
        <StatStrip
          items={items}
          counters={counters}
          completedToday={completedToday}
          totalsRecordsCreated={totalsRecordsCreated}
          totalsRecordsUpdated={totalsRecordsUpdated}
          totalsFaqsGenerated={totalsFaqsGenerated}
        />

        {/* ── Capture surfaces ─────────────────────────────────────── */}
        <section className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DragDropCard
            active={dragActive}
            onEnter={() => setDragActive(true)}
            onLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          />
          <QuickDumpCard
            value={quickDump}
            onChange={setQuickDump}
            onSave={() => handleQuickDumpSave(false)}
            onSaveAndProcess={() => handleQuickDumpSave(true)}
          />
          <URLImportCard
            value={urlBuffer}
            onChange={setUrlBuffer}
            onImport={handleUrlImport}
          />
          <VoiceNotesCard onPick={() => voiceInputRef.current?.click()} />
          <ImageAnalysisCard onPick={() => imageInputRef.current?.click()} />
          <FutureConnectorsCard />
        </section>

        {/* ── Hidden file inputs ──────────────────────────────────── */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            captureFiles(e.target.files);
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={voiceInputRef}
          type="file"
          multiple
          accept=".mp3,.wav,audio/*"
          className="hidden"
          onChange={(e) => {
            captureFiles(e.target.files, "voice");
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,image/*"
          className="hidden"
          onChange={(e) => {
            captureFiles(e.target.files, "image");
            e.currentTarget.value = "";
          }}
        />

        {/* ── Process Inbox CTA ───────────────────────────────────── */}
        <ProcessInboxButton
          waitingCount={counters.waiting}
          isProcessing={isProcessing}
          onClick={runProcessInbox}
        />

        {/* ── Inbox Queue ──────────────────────────────────────────── */}
        <InboxQueue
          items={items}
          onPreview={setPreview}
          onReprocess={reprocessItem}
          onDelete={removeItem}
        />

        {/* ── Philosophy strip ────────────────────────────────────── */}
        <PhilosophyStrip />
      </div>

      {/* ── Overlays ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {preview ? (
          <PreviewDrawer item={preview} onClose={() => setPreview(null)} />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {processingReport ? (
          <ReportOverlay
            report={processingReport}
            onClose={() => setProcessingReport(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isProcessing ? <ProcessingBanner /> : null}
      </AnimatePresence>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────

function Hero() {
  return (
    <header className="flex flex-col items-start">
      <div className="flex items-center gap-2">
        <span
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em]"
          style={{
            background: TOKEN.accentSoft,
            borderColor: TOKEN.accentPeach,
            color: TOKEN.accentDark,
          }}
        >
          <Inbox size={12} strokeWidth={2.4} />
          NEX · Knowledge Factory
        </span>
      </div>
      <h1
        className="mt-4 text-[36px] font-black leading-[1.05] tracking-tight md:text-[46px]"
        style={{ color: TOKEN.text }}
      >
        Knowledge Inbox
      </h1>
      <p
        className="mt-3 max-w-2xl text-[15px] leading-relaxed md:text-base"
        style={{ color: TOKEN.textMid }}
      >
        Capture first. Organise later. Everything entering NEX starts here.
      </p>
    </header>
  );
}

// ── Stat strip ───────────────────────────────────────────────────────

function StatStrip({
  items,
  counters,
  completedToday,
  totalsRecordsCreated,
  totalsRecordsUpdated,
  totalsFaqsGenerated,
}: {
  items: InboxItem[];
  counters: { waiting: number; processing: number; review: number };
  completedToday: number;
  totalsRecordsCreated: number;
  totalsRecordsUpdated: number;
  totalsFaqsGenerated: number;
}) {
  const cards: Array<{ label: string; value: number; tone: "neutral" | "info" | "warning" | "success" | "accent" }> = [
    { label: "Items Waiting",     value: counters.waiting,         tone: "neutral" },
    { label: "Processing",        value: counters.processing,      tone: "info" },
    { label: "Needs Review",      value: counters.review,          tone: "warning" },
    { label: "Completed Today",   value: completedToday,           tone: "success" },
    { label: "Records Created",   value: totalsRecordsCreated,     tone: "accent" },
    { label: "Records Updated",   value: totalsRecordsUpdated,     tone: "accent" },
    { label: "FAQs Generated",    value: totalsFaqsGenerated,      tone: "accent" },
  ];
  // Ensure ESLint's exhaustive-deps is happy by referring to items (surface count).
  const total = items.length;
  return (
    <section
      aria-label="Inbox statistics"
      className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7"
    >
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={c.value} tone={c.tone} />
      ))}
      <span className="sr-only">Total items in inbox: {total}</span>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "info" | "warning" | "success" | "accent";
}) {
  const toneColour = {
    neutral: TOKEN.textMid,
    info: TOKEN.info,
    warning: TOKEN.warning,
    success: TOKEN.success,
    accent: TOKEN.accentDark,
  }[tone];
  return (
    <motion.div
      layout
      className="rounded-2xl border p-4"
      style={{
        background: TOKEN.card,
        borderColor: TOKEN.border,
        boxShadow: TOKEN.shadowSm,
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: TOKEN.textSoft }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[28px] font-black leading-none tracking-tight"
        style={{ color: toneColour }}
      >
        {value.toLocaleString()}
      </div>
    </motion.div>
  );
}

// ── Capture surface: Drag & Drop ─────────────────────────────────────

function DragDropCard({
  active,
  onEnter,
  onLeave,
  onDrop,
  onClick,
}: {
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
}) {
  return (
    <CaptureCard>
      <CaptureHeader
        icon={Upload}
        title="Drop files to NEX"
        subtitle="Documents · images · audio · video · archives"
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          onEnter();
        }}
        onDragLeave={onLeave}
        onDrop={onDrop}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClick();
        }}
        className="mt-3 flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors"
        style={{
          borderColor: active ? TOKEN.accent : TOKEN.border,
          background: active ? TOKEN.accentSoft : TOKEN.divider,
        }}
      >
        <div
          className="grid h-12 w-12 place-items-center rounded-2xl"
          style={{ background: TOKEN.card, color: TOKEN.accent, boxShadow: TOKEN.shadowSm }}
        >
          <Cloud size={24} strokeWidth={1.6} />
        </div>
        <div
          className="mt-3 text-[15px] font-semibold"
          style={{ color: TOKEN.text }}
        >
          Drop files here — or click to browse
        </div>
        <div
          className="mt-1 text-[12px]"
          style={{ color: TOKEN.textSoft }}
        >
          txt · md · pdf · docx · csv · xlsx · jpg · png · webp · mp3 · wav · mp4 · zip
        </div>
        <div
          className="mt-3 text-[11px] uppercase tracking-widest"
          style={{ color: TOKEN.textSoft }}
        >
          Multiple uploads supported · very large files OK
        </div>
      </div>
    </CaptureCard>
  );
}

// ── Capture surface: Quick Dump ──────────────────────────────────────

function QuickDumpCard({
  value,
  onChange,
  onSave,
  onSaveAndProcess,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onSaveAndProcess: () => void;
}) {
  return (
    <CaptureCard>
      <CaptureHeader
        icon={Zap}
        title="Quick Dump"
        subtitle="Q&A · articles · research · ideas · transcripts · notes"
      />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste anything here..."
        className="mt-3 w-full resize-none rounded-2xl border p-4 text-[14px] leading-relaxed outline-none transition-colors focus:border-current"
        style={{
          background: TOKEN.divider,
          borderColor: TOKEN.border,
          color: TOKEN.text,
          minHeight: 172,
        }}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
          {value.trim().length.toLocaleString()} chars
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!value.trim()}
            className="rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-40"
            style={{
              background: TOKEN.card,
              borderColor: TOKEN.border,
              color: TOKEN.text,
            }}
          >
            Save to Inbox
          </button>
          <button
            type="button"
            onClick={onSaveAndProcess}
            disabled={!value.trim()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-40"
            style={{ background: TOKEN.accent }}
          >
            <Sparkles size={13} strokeWidth={2.4} />
            Save &amp; Process
          </button>
        </div>
      </div>
    </CaptureCard>
  );
}

// ── Capture surface: URL Import ──────────────────────────────────────

function URLImportCard({
  value,
  onChange,
  onImport,
}: {
  value: string;
  onChange: (v: string) => void;
  onImport: () => void;
}) {
  return (
    <CaptureCard>
      <CaptureHeader
        icon={LinkIcon}
        title="URL Import"
        subtitle="Paste one or many · NEX fetches and stores for processing"
      />
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://gov.uk/…&#10;https://trada.co.uk/…&#10;https://fsc.org/…"
        className="mt-3 w-full resize-none rounded-2xl border p-4 text-[14px] leading-relaxed outline-none focus:border-current"
        style={{
          background: TOKEN.divider,
          borderColor: TOKEN.border,
          color: TOKEN.text,
          minHeight: 130,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
        }}
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
          Separate with newlines · commas · or spaces
        </span>
        <button
          type="button"
          onClick={onImport}
          disabled={!value.trim()}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-40"
          style={{ background: TOKEN.accent }}
        >
          <LinkIcon size={13} strokeWidth={2.4} />
          Import URLs
        </button>
      </div>
    </CaptureCard>
  );
}

// ── Capture surface: Voice Notes ─────────────────────────────────────

function VoiceNotesCard({ onPick }: { onPick: () => void }) {
  return (
    <CaptureCard>
      <CaptureHeader
        icon={Mic}
        title="Voice Notes"
        subtitle="Upload recordings · NEX transcribes and keeps the original"
      />
      <button
        type="button"
        onClick={onPick}
        className="mt-3 flex min-h-[132px] w-full flex-col items-center justify-center rounded-2xl border p-5 text-left transition-colors hover:border-current"
        style={{
          background: TOKEN.divider,
          borderColor: TOKEN.border,
        }}
      >
        <div
          className="grid h-11 w-11 place-items-center rounded-full"
          style={{ background: TOKEN.card, color: TOKEN.accent, boxShadow: TOKEN.shadowSm }}
        >
          <Mic size={22} strokeWidth={1.7} />
        </div>
        <div className="mt-3 text-[14px] font-semibold" style={{ color: TOKEN.text }}>
          Upload voice recordings
        </div>
        <div className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
          mp3 · wav · common audio formats · multiple files
        </div>
      </button>
    </CaptureCard>
  );
}

// ── Capture surface: Image Analysis ──────────────────────────────────

function ImageAnalysisCard({ onPick }: { onPick: () => void }) {
  return (
    <CaptureCard>
      <CaptureHeader
        icon={ImageIcon}
        title="Image Analysis"
        subtitle="Photograph a staircase, component, or reference — NEX classifies it"
      />
      <button
        type="button"
        onClick={onPick}
        className="mt-3 flex min-h-[132px] w-full flex-col items-center justify-center rounded-2xl border p-5 transition-colors hover:border-current"
        style={{
          background: TOKEN.divider,
          borderColor: TOKEN.border,
        }}
      >
        <div
          className="grid h-11 w-11 place-items-center rounded-2xl"
          style={{ background: TOKEN.card, color: TOKEN.accent, boxShadow: TOKEN.shadowSm }}
        >
          <ImageIcon size={22} strokeWidth={1.7} />
        </div>
        <div className="mt-3 text-[14px] font-semibold" style={{ color: TOKEN.text }}>
          Upload photographs
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[11px]" style={{ color: TOKEN.textSoft }}>
          {[
            "staircase style",
            "materials",
            "components",
            "construction",
            "heritage",
            "manufacturing details",
            "possible record links",
          ].map((t) => (
            <span
              key={t}
              className="rounded-full px-2 py-0.5"
              style={{ background: TOKEN.card, border: `1px solid ${TOKEN.border}` }}
            >
              {t}
            </span>
          ))}
        </div>
      </button>
    </CaptureCard>
  );
}

// ── Capture surface: Future Connectors (roadmap tile) ────────────────

function FutureConnectorsCard() {
  const connectors = [
    "Email",
    "WhatsApp",
    "OneDrive",
    "Google Drive",
    "Dropbox",
    "GitHub",
    "Website crawler",
    "YouTube transcripts",
    "Research feeds",
    "Government publications",
    "Standards organisations",
    "PDF libraries",
  ];
  return (
    <CaptureCard>
      <CaptureHeader
        icon={Cloud}
        title="Future Connectors"
        subtitle="Same inbox · same pipeline · attaches without rework"
      />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {connectors.map((c) => (
          <span
            key={c}
            className="rounded-full border px-2.5 py-1 text-[11px] font-medium"
            style={{
              background: TOKEN.card,
              borderColor: TOKEN.border,
              color: TOKEN.textMid,
            }}
          >
            {c}
          </span>
        ))}
      </div>
      <p className="mt-3 text-[11px]" style={{ color: TOKEN.textSoft }}>
        Every connector feeds the same <code>addItems()</code> pipeline. No manual sorting.
      </p>
    </CaptureCard>
  );
}

// ── Capture card shell + header ──────────────────────────────────────

function CaptureCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-3xl border p-5"
      style={{
        background: TOKEN.card,
        borderColor: TOKEN.border,
        boxShadow: TOKEN.shadowSm,
      }}
    >
      {children}
    </div>
  );
}

function CaptureHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: TOKEN.accentSoft, color: TOKEN.accentDark }}
      >
        <Icon size={17} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold" style={{ color: TOKEN.text }}>
          {title}
        </div>
        <div className="mt-0.5 text-[12px]" style={{ color: TOKEN.textSoft }}>
          {subtitle}
        </div>
      </div>
    </div>
  );
}

// ── Process Inbox CTA ───────────────────────────────────────────────

function ProcessInboxButton({
  waitingCount,
  isProcessing,
  onClick,
}: {
  waitingCount: number;
  isProcessing: boolean;
  onClick: () => void;
}) {
  const disabled = waitingCount === 0 || isProcessing;
  return (
    <div className="mt-10 flex flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="group inline-flex items-center gap-3 rounded-full px-8 py-4 text-[16px] font-bold text-white shadow-xl transition-all disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: disabled
            ? "linear-gradient(135deg, #A3A39C 0%, #6E6E67 100%)"
            : "linear-gradient(135deg, #F97316 0%, #EA580C 100%)",
          boxShadow: disabled ? TOKEN.shadowSm : TOKEN.shadowLg,
        }}
      >
        {isProcessing ? (
          <Loader2 size={18} strokeWidth={2.3} className="animate-spin" />
        ) : (
          <Sparkles size={18} strokeWidth={2.3} />
        )}
        {isProcessing ? "Processing…" : "Process Inbox"}
        {!isProcessing && waitingCount > 0 && (
          <span
            className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-[12px] font-black tracking-wide"
          >
            {waitingCount} waiting
          </span>
        )}
      </button>
      <p className="mt-3 max-w-[560px] text-center text-[12px]" style={{ color: TOKEN.textSoft }}>
        NEX classifies · dedupes · extracts · updates existing records · creates new ones ·
        generates FAQs · builds graph edges · assigns confidence · flags what needs your review.
      </p>
    </div>
  );
}

// ── Inbox Queue ──────────────────────────────────────────────────────

function InboxQueue({
  items,
  onPreview,
  onReprocess,
  onDelete,
}: {
  items: InboxItem[];
  onPreview: (item: InboxItem) => void;
  onReprocess: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[22px] font-black tracking-tight" style={{ color: TOKEN.text }}>
          Inbox Queue
        </h2>
        <span className="text-[13px]" style={{ color: TOKEN.textSoft }}>
          {items.length.toLocaleString()} item{items.length === 1 ? "" : "s"}
        </span>
      </div>

      {items.length === 0 ? (
        <div
          className="rounded-3xl border p-10 text-center"
          style={{ background: TOKEN.card, borderColor: TOKEN.border, boxShadow: TOKEN.shadowSm }}
        >
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl" style={{ background: TOKEN.accentSoft, color: TOKEN.accentDark }}>
            <Inbox size={26} strokeWidth={1.6} />
          </div>
          <div className="mt-4 text-[16px] font-semibold" style={{ color: TOKEN.text }}>
            Nothing waiting to process.
          </div>
          <div className="mt-1 text-[13px]" style={{ color: TOKEN.textSoft }}>
            Drop a file, paste text, or import a URL to feed the brain.
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {items.map((item) => (
              <InboxRow
                key={item.id}
                item={item}
                onPreview={() => onPreview(item)}
                onReprocess={() => onReprocess(item.id)}
                onDelete={() => onDelete(item.id)}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function InboxRow({
  item,
  onPreview,
  onReprocess,
  onDelete,
}: {
  item: InboxItem;
  onPreview: () => void;
  onReprocess: () => void;
  onDelete: () => void;
}) {
  const KindIcon = kindIcon(item.kind);
  const style = STATUS_STYLE[item.status];
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl border p-4 md:p-5"
      style={{
        background: TOKEN.card,
        borderColor: TOKEN.border,
        boxShadow: TOKEN.shadowSm,
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="grid h-10 w-10 flex-none place-items-center rounded-xl"
          style={{ background: TOKEN.accentSoft, color: TOKEN.accentDark }}
        >
          <KindIcon size={17} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
              style={{ background: style.bg, color: style.fg }}
            >
              <span
                className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{ background: style.dot }}
              />
              {style.label}
            </span>
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: TOKEN.textSoft }}
            >
              {kindLabel(item.kind)}
            </span>
            <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
              {humanTime(item.createdAt)}
            </span>
            {item.meta ? (
              <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
                · {item.meta}
              </span>
            ) : null}
          </div>
          <div
            className="mt-1.5 truncate text-[14px] font-semibold"
            style={{ color: TOKEN.text }}
          >
            {item.title}
          </div>
          {item.previewText ? (
            <div
              className="mt-1 line-clamp-2 text-[12px]"
              style={{ color: TOKEN.textSoft }}
            >
              {item.previewText}
            </div>
          ) : null}
        </div>
        <div className="flex flex-none items-center gap-1">
          <RowIcon label="Preview" onClick={onPreview}>
            <ChevronRight size={16} strokeWidth={2} />
          </RowIcon>
          <RowIcon label="Reprocess" onClick={onReprocess}>
            <RefreshCcw size={15} strokeWidth={2} />
          </RowIcon>
          <RowIcon label="History" onClick={onPreview}>
            <History size={15} strokeWidth={2} />
          </RowIcon>
          <RowIcon label="Delete" onClick={onDelete} destructive>
            <Trash2 size={15} strokeWidth={2} />
          </RowIcon>
        </div>
      </div>
    </motion.li>
  );
}

function RowIcon({
  label,
  onClick,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-black/5"
      style={{ color: destructive ? "#B91C1C" : TOKEN.textMid }}
    >
      {children}
    </button>
  );
}

// ── Preview drawer ───────────────────────────────────────────────────

function PreviewDrawer({
  item,
  onClose,
}: {
  item: InboxItem;
  onClose: () => void;
}) {
  const KindIcon = kindIcon(item.kind);
  const style = STATUS_STYLE[item.status];
  return (
    <motion.div
      className="fixed inset-0 z-50 flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        aria-label="Close preview"
        className="absolute inset-0"
        onClick={onClose}
        style={{ background: "rgba(15,17,21,0.35)" }}
      />
      <motion.aside
        className="relative z-10 flex h-full w-full max-w-[520px] flex-col p-6"
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: TOKEN.surface, boxShadow: TOKEN.shadowLg }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{ background: TOKEN.accentSoft, color: TOKEN.accentDark }}
            >
              <KindIcon size={17} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest" style={{ color: TOKEN.textSoft }}>
                {kindLabel(item.kind)}
              </div>
              <div className="text-[16px] font-bold" style={{ color: TOKEN.text }}>
                {item.title}
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close preview"
            className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-black/5"
            onClick={onClose}
            style={{ color: TOKEN.textMid }}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: style.bg, color: style.fg }}
          >
            {style.label}
          </span>
          <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
            {humanTime(item.createdAt)}
          </span>
          {item.meta ? (
            <span className="text-[11px]" style={{ color: TOKEN.textSoft }}>
              · {item.meta}
            </span>
          ) : null}
        </div>

        <div
          className="mt-5 flex-1 overflow-y-auto rounded-2xl border p-4 text-[13px] leading-relaxed"
          style={{
            background: TOKEN.card,
            borderColor: TOKEN.border,
            color: TOKEN.text,
          }}
        >
          {item.previewText || "No preview available."}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border px-4 py-2 text-[13px] font-semibold"
            style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.text }}
          >
            Open in editor
          </button>
          <button
            type="button"
            className="rounded-full border px-4 py-2 text-[13px] font-semibold"
            style={{ background: TOKEN.card, borderColor: TOKEN.border, color: TOKEN.text }}
          >
            View graph edges
          </button>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: TOKEN.accent }}
          >
            <Sparkles size={13} strokeWidth={2.4} />
            Reprocess
          </button>
        </div>
      </motion.aside>
    </motion.div>
  );
}

// ── Processing banner (top of viewport during simulated run) ─────────

function ProcessingBanner() {
  return (
    <motion.div
      initial={{ y: -32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -32, opacity: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-3 z-40 mx-auto flex max-w-[520px] items-center gap-3 rounded-full border px-4 py-2.5 text-[13px] font-semibold"
      style={{
        background: TOKEN.card,
        borderColor: TOKEN.border,
        boxShadow: TOKEN.shadowMd,
        color: TOKEN.text,
      }}
    >
      <Loader2 size={16} strokeWidth={2.3} className="animate-spin" style={{ color: TOKEN.accent }} />
      NEX is classifying · deduping · extracting · updating records…
    </motion.div>
  );
}

// ── Processing Report overlay ────────────────────────────────────────

function ReportOverlay({
  report,
  onClose,
}: {
  report: ProcessingReport;
  onClose: () => void;
}) {
  const rows: Array<{ label: string; value: number; icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; tone: string }> = [
    { label: "Items processed",              value: report.itemsProcessed,        icon: Inbox,        tone: TOKEN.textMid },
    { label: "Knowledge records created",    value: report.recordsCreated,        icon: Sparkles,     tone: TOKEN.accentDark },
    { label: "Knowledge records updated",    value: report.recordsUpdated,        icon: RefreshCcw,   tone: TOKEN.accentDark },
    { label: "FAQs generated",               value: report.faqsGenerated,         icon: Flame,        tone: TOKEN.accent },
    { label: "Graph relationships created",  value: report.edgesCreated,          icon: ChevronRight, tone: TOKEN.info },
    { label: "Duplicate information merged", value: report.duplicatesMerged,      icon: CheckCircle2, tone: TOKEN.success },
    { label: "Images analysed",              value: report.imagesAnalysed,        icon: ImageIcon,    tone: TOKEN.textMid },
    { label: "Voice notes transcribed",      value: report.voiceNotesTranscribed, icon: Mic,          tone: TOKEN.textMid },
    { label: "Needs human review",           value: report.needsReview,           icon: Bell,         tone: TOKEN.warning },
  ];
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        type="button"
        aria-label="Close report"
        className="absolute inset-0"
        onClick={onClose}
        style={{ background: "rgba(15,17,21,0.4)" }}
      />
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 12 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[560px] rounded-3xl border p-6 md:p-7"
        style={{
          background: TOKEN.card,
          borderColor: TOKEN.border,
          boxShadow: TOKEN.shadowLg,
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.28em]"
              style={{ color: TOKEN.accentDark }}
            >
              Inbox Processing Report
            </div>
            <div className="mt-1 text-[22px] font-black tracking-tight" style={{ color: TOKEN.text }}>
              {report.itemsProcessed.toLocaleString()} items processed
            </div>
            <div className="mt-1 text-[12px]" style={{ color: TOKEN.textSoft }}>
              Everything else processed automatically.
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-black/5"
            onClick={onClose}
            style={{ color: TOKEN.textMid }}
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center gap-3 rounded-2xl border p-3"
              style={{
                background: TOKEN.surface,
                borderColor: TOKEN.border,
              }}
            >
              <div
                className="grid h-9 w-9 place-items-center rounded-xl"
                style={{ background: TOKEN.card, color: r.tone, boxShadow: TOKEN.shadowSm }}
              >
                <r.icon size={16} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider" style={{ color: TOKEN.textSoft }}>
                  {r.label}
                </div>
                <div className="text-[18px] font-black" style={{ color: TOKEN.text }}>
                  {r.value.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold text-white"
            style={{ background: TOKEN.accent }}
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Philosophy strip ─────────────────────────────────────────────────

function PhilosophyStrip() {
  return (
    <section
      className="mt-14 rounded-3xl border p-6 md:p-8"
      style={{
        background: TOKEN.surface,
        borderColor: TOKEN.border,
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.28em]"
        style={{ color: TOKEN.accentDark }}
      >
        Philosophy
      </div>
      <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p className="text-[16px] font-bold leading-snug" style={{ color: TOKEN.text }}>
            The inbox is not the knowledge base.
          </p>
          <p className="mt-1 text-[13px]" style={{ color: TOKEN.textMid }}>
            The inbox is raw material. The knowledge records are the brain.
          </p>
        </div>
        <div>
          <p className="text-[16px] font-bold leading-snug" style={{ color: TOKEN.text }}>
            Claude transforms information into governed records.
          </p>
          <p className="mt-1 text-[13px]" style={{ color: TOKEN.textMid }}>
            Philip should never need to manually organise information.
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-1.5">
        <span
          className="text-[11px]"
          style={{ color: TOKEN.textSoft }}
        >
          Governed by:
        </span>
        {[
          "Record Constitution · 8 clauses",
          "Golden Rule template",
          "Knowledge Graph",
          "Reasoning Layer",
          "Master Aggregator",
        ].map((s) => (
          <span
            key={s}
            className="rounded-full border px-2 py-0.5 text-[11px]"
            style={{
              background: TOKEN.card,
              borderColor: TOKEN.border,
              color: TOKEN.textMid,
            }}
          >
            {s}
          </span>
        ))}
      </div>
    </section>
  );
}

// End of file. Every seam is a hook — connectors, API, and the real
// Reasoning + Aggregator pipeline attach here without a rewrite.
