"use client";

// KnowledgeInboxShell — the client surface for /nex-app/knowledge-inbox.
//
// Composes:
//   · Hero + subtitle
//   · Seven statistic cards (Items Waiting · Processing · Needs Review ·
//     Completed Today · Records Created · Records Updated · FAQs Generated)
//   · Knowledge Source picker (eight tiers · determines processing pipeline)
//   · Five capture surfaces (Drag & Drop · Quick Dump · URL Import ·
//     Voice Notes · Image Analysis) — one inbox, many mouths
//   · Inbox Queue with per-item status chip + source chip + row actions
//   · Large "Process Inbox" CTA
//   · Processing Report overlay
//
// Knowledge Source doctrine (Philip 2026-08-06):
//   The source of a fact determines HOW hard NEX has to work on it.
//   ChatGPT Approved and Claude Generated content is trusted-curated —
//   import, link, index, done. Raw Research needs full extraction. Internet
//   Articles are treated cautiously. Government / Standards become
//   high-authority references. Customer Q&A drives FAQ generation and
//   gap analysis. Personal Ideas are kept separate from industry knowledge.
//   Each source has its own PROCESSING WORKFLOW encoded in SOURCE_META.
//
// PERSISTENCE (Philip 2026-08-06): the mailbox is now connected to the
// filing cabinet. Every capture surface calls a real API endpoint that
// writes to disk under data/knowledge-inbox/. React state is a display
// cache only — GET /list is the source of truth. Each dump gets a
// unique id, ISO timestamp, source, status, and sha256 hash (for dedup).
// Storage layer: src/lib/nex/knowledge-inbox/storage.ts.
// API endpoints:
//   POST /api/nex/knowledge-inbox/dump      text dumps
//   POST /api/nex/knowledge-inbox/upload    file/voice/image uploads
//   POST /api/nex/knowledge-inbox/urls      url import
//   POST /api/nex/knowledge-inbox/process   run the pipeline
//   GET  /api/nex/knowledge-inbox/list      full snapshot + stats
//   GET/PATCH/DELETE /api/nex/knowledge-inbox/[id]
//
// The Process Inbox function reads from the persisted store; the
// Processing Report reflects real deltas rolled forward in stats.json.
//
// AUTO-PROCESSING (Philip 2026-08-06): after every successful save
// (text dump / file upload / URL import) the client fires a background
// POST /api/nex/brain/run-once. The user never has to click Dispatch or
// Run Cycle — dumps process themselves the moment they land. The Process
// Inbox button remains available for manual re-processing.
//
// Future connectors (Email · WhatsApp · OneDrive · Google Drive · Dropbox
// · GitHub · Website crawler · YouTube transcripts · Research feeds ·
// Government publications · Standards organisations · PDF libraries)
// call the same four capture endpoints — one pipeline, many mouths.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  BookOpen,
  BrainCircuit,
  Bot,
  CheckCircle2,
  ChevronRight,
  Cloud,
  FileText,
  Flame,
  Globe,
  HelpCircle,
  History,
  Image as ImageIcon,
  Inbox,
  Landmark,
  Lightbulb,
  Link as LinkIcon,
  Loader2,
  Mic,
  RefreshCcw,
  ShieldAlert,
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

// Knowledge Source — determines how NEX processes the item.
// Not every upload requires the same amount of work: the source
// picks the workflow. Philip 2026-08-06.
type KnowledgeSource =
  | "chatgpt-approved"    // 🟢 trusted-curated, do NOT rewrite
  | "claude-generated"    // 🔵 already golden-rule, just link
  | "raw-research"        // 🟡 extract + build + FAQ + cross-ref
  | "internet-article"    // 🟠 cautious, verify before promoting
  | "needs-verification"  // 🔴 hold for human review
  | "gov-standards"       // ⚫ high-authority reference; update affected records
  | "customer-qa"         // 🟣 drives FAQ generation + gap analysis
  | "personal-ideas";     // 🟤 keep separate from industry knowledge

type InboxItem = {
  id: string;
  title: string;
  kind: InboxKind;
  status: InboxStatus;
  source: KnowledgeSource;
  createdAt: number;
  createdAtIso?: string;
  hash?: string;
  meta?: string;         // e.g. filename, url, byte size, duration
  previewText?: string;  // first 200 chars for the preview drawer
  // Storage back-refs (paths relative to data/knowledge-inbox/)
  contentPath?: string;
  filePath?: string;
  originalFilename?: string;
  byteSize?: number;
  mimeType?: string;
  url?: string;
  processedAt?: number;
  processedNotes?: string;
};

// Persistent stats returned by GET /list — server rolls these
// forward on every processing run.
type ServerStats = {
  recordsCreated: number;
  recordsUpdated: number;
  faqsGenerated: number;
  edgesCreated: number;
  duplicatesMerged: number;
  imagesAnalysed: number;
  voiceNotesTranscribed: number;
  completedToday: number;
  completedTodayDate: string;
  lastProcessedAt?: number;
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

// ── Knowledge Source palette + workflow metadata (Philip 2026-08-06) ─
//
// dot        — the coloured indicator in the picker + queue chip
// tint       — the soft background tint when the source is selected
// pipeline   — the exact processing recipe fired by the classifier
// examples   — surfaces on the picker tile so intent is obvious
// scrutiny   — how much verification the pipeline applies

type SourceMeta = {
  label: string;
  dot: string;
  tint: string;
  fg: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  pipeline: string;
  examples: string;
  scrutiny: "trusted" | "curated" | "extract" | "cautious" | "hold" | "authoritative" | "gap-driven" | "sandbox";
};

const SOURCE_META: Record<KnowledgeSource, SourceMeta> = {
  "chatgpt-approved": {
    label: "ChatGPT Approved",
    dot: "#10B981",
    tint: "#D1FAE5",
    fg: "#065F46",
    icon: Bot,
    pipeline: "Import → Classify → Link → Index → Done. Never rewrite.",
    examples: "Q&A collections · material guides · buying guides",
    scrutiny: "trusted",
  },
  "claude-generated": {
    label: "Claude Generated",
    dot: "#3B82F6",
    tint: "#DBEAFE",
    fg: "#1D4ED8",
    icon: BrainCircuit,
    pipeline: "Already Golden-Rule. Import + link, no reprocessing.",
    examples: "Records I authored in a Claude session",
    scrutiny: "curated",
  },
  "raw-research": {
    label: "Raw Research",
    dot: "#F59E0B",
    tint: "#FEF3C7",
    fg: "#92400E",
    icon: BookOpen,
    pipeline: "Read → Analyse → Verify → Build Records → FAQ → Link.",
    examples: "Books · PDFs · trade manuals · manufacturer docs",
    scrutiny: "extract",
  },
  "internet-article": {
    label: "Internet Article",
    dot: "#F97316",
    tint: "#FFE7CE",
    fg: "#9A3412",
    icon: Globe,
    pipeline: "Extract with caution. Verify claims before promoting.",
    examples: "Blogs · industry posts · news stories",
    scrutiny: "cautious",
  },
  "needs-verification": {
    label: "Needs Verification",
    dot: "#EF4444",
    tint: "#FEE2E2",
    fg: "#991B1B",
    icon: ShieldAlert,
    pipeline: "Hold. No promotion until human review approves.",
    examples: "Anything I flagged as suspicious",
    scrutiny: "hold",
  },
  "gov-standards": {
    label: "Government / Standards",
    dot: "#1F2937",
    tint: "#E5E7EB",
    fg: "#111827",
    icon: Landmark,
    pipeline: "Verify → Update affected records → Notify downstream.",
    examples: "Approved Doc K · BS · TRADA · FSC · PEFC · CITES",
    scrutiny: "authoritative",
  },
  "customer-qa": {
    label: "Customer Q&A",
    dot: "#A855F7",
    tint: "#F3E8FF",
    fg: "#6B21A8",
    icon: HelpCircle,
    pipeline: "Generate FAQs · surface gaps in the knowledge base.",
    examples: "Support emails · forum questions · call notes",
    scrutiny: "gap-driven",
  },
  "personal-ideas": {
    label: "Personal Ideas",
    dot: "#78350F",
    tint: "#FDE68A",
    fg: "#78350F",
    icon: Lightbulb,
    pipeline: "Store separately. Never mix with industry records.",
    examples: "Business · feature · NEX concept · architecture",
    scrutiny: "sandbox",
  },
};

const SOURCE_ORDER: KnowledgeSource[] = [
  "chatgpt-approved",
  "claude-generated",
  "raw-research",
  "internet-article",
  "needs-verification",
  "gov-standards",
  "customer-qa",
  "personal-ideas",
];

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

// The inbox loads its state from GET /api/nex/knowledge-inbox/list on
// mount. Persistence lives on disk; nothing is seeded client-side.

// ── Utility helpers ──────────────────────────────────────────────────

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

// Small toast state — used to surface duplicate-detection results and
// other lightweight feedback from the API calls.
type Toast = { kind: "info" | "error"; message: string } | null;

// ── Root component ───────────────────────────────────────────────────

export function KnowledgeInboxShell() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [activeSource, setActiveSource] = useState<KnowledgeSource>("chatgpt-approved");
  const [quickDump, setQuickDump] = useState("");
  const [urlBuffer, setUrlBuffer] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingReport, setProcessingReport] = useState<ProcessingReport | null>(null);
  const [preview, setPreview] = useState<InboxItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);

  const fileInputRef  = useRef<HTMLInputElement | null>(null);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // ── Snapshot loader — disk is the source of truth ─────────────────

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/nex/knowledge-inbox/list", { cache: "no-store" });
      if (!res.ok) throw new Error(`list_failed_${res.status}`);
      const json = (await res.json()) as {
        ok: boolean;
        items: InboxItem[];
        stats: ServerStats;
      };
      if (!json.ok) throw new Error("list_not_ok");
      setItems(json.items);
      setStats(json.stats);
    } catch (err) {
      console.error("[knowledge-inbox] refresh failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showToast = useCallback((next: NonNullable<Toast>) => {
    setToast(next);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  // Auto-processing kick — fires the brain pipeline in the background
  // after every save. No wait, no block. If it errors, we log quietly;
  // the user can still hit "Process Inbox" manually.
  const kickBrainPipeline = useCallback(() => {
    void (async () => {
      try {
        await fetch("/api/nex/brain/run-once", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        });
        // Refresh the inbox so the user sees the item's status flip
        // to processed after the background pipeline completes.
        setTimeout(() => refresh(), 800);
      } catch (err) {
        console.warn("[knowledge-inbox] background brain kick failed:", err);
      }
    })();
  }, [refresh]);

  // ── Item mutation helpers ──────────────────────────────────────────

  const removeItem = useCallback(
    async (id: string) => {
      // Optimistic remove so the UI feels immediate.
      setItems((prev) => prev.filter((i) => i.id !== id));
      try {
        const res = await fetch(`/api/nex/knowledge-inbox/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`delete_failed_${res.status}`);
      } catch (err) {
        console.error("[knowledge-inbox] delete failed:", err);
        showToast({ kind: "error", message: "Delete failed — retrying refresh." });
      } finally {
        refresh();
      }
    },
    [refresh, showToast]
  );

  const reprocessItem = useCallback(
    async (id: string) => {
      // Optimistic flip to waiting so the CTA count updates instantly.
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "waiting" as InboxStatus } : i))
      );
      try {
        const res = await fetch(`/api/nex/knowledge-inbox/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "waiting" }),
        });
        if (!res.ok) throw new Error(`reprocess_failed_${res.status}`);
      } catch (err) {
        console.error("[knowledge-inbox] reprocess failed:", err);
      } finally {
        refresh();
      }
    },
    [refresh]
  );

  // ── Capture surface handlers ───────────────────────────────────────

  const captureFiles = useCallback(
    async (fileList: FileList | null, forcedKind?: InboxKind) => {
      if (!fileList) return;
      const arr = Array.from(fileList);
      if (!arr.length) return;
      const form = new FormData();
      form.set("source", activeSource);
      if (forcedKind) form.set("forcedKind", forcedKind);
      for (const f of arr) form.append("files", f);
      try {
        const res = await fetch("/api/nex/knowledge-inbox/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error(`upload_failed_${res.status}`);
        const json = (await res.json()) as {
          ok: boolean;
          created: InboxItem[];
          duplicates: InboxItem[];
        };
        if (json.duplicates?.length) {
          showToast({
            kind: "info",
            message: `${json.duplicates.length} duplicate${json.duplicates.length === 1 ? "" : "s"} already in the inbox.`,
          });
        }
        // Auto-process the new upload through the NEX Brain pipeline.
        if ((json.created?.length ?? 0) > 0) {
          showToast({ kind: "info", message: "NEX is processing your upload…" });
          kickBrainPipeline();
        }
      } catch (err) {
        console.error("[knowledge-inbox] upload failed:", err);
        showToast({ kind: "error", message: "Upload failed. Try again." });
      } finally {
        refresh();
      }
    },
    [activeSource, refresh, showToast, kickBrainPipeline]
  );

  const handleQuickDumpSave = useCallback(
    async (_thenProcess: boolean) => {
      const text = quickDump.trim();
      if (!text) return;
      try {
        const res = await fetch("/api/nex/knowledge-inbox/dump", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ source: activeSource, content: text }),
        });
        if (!res.ok) throw new Error(`dump_failed_${res.status}`);
        const json = (await res.json()) as {
          ok: boolean;
          item: InboxItem;
          deduplicated: boolean;
        };
        if (json.deduplicated) {
          showToast({
            kind: "info",
            message: "Duplicate detected — already in the inbox.",
          });
        } else {
          // Auto-process every fresh dump through the NEX Brain pipeline.
          showToast({ kind: "info", message: "NEX is processing your dump…" });
          kickBrainPipeline();
        }
        setQuickDump("");
        await refresh();
      } catch (err) {
        console.error("[knowledge-inbox] dump failed:", err);
        showToast({ kind: "error", message: "Save failed. Try again." });
      }
    },
    [quickDump, activeSource, refresh, showToast, kickBrainPipeline]
  );

  const handleUrlImport = useCallback(async () => {
    const raw = urlBuffer.trim();
    if (!raw) return;
    try {
      const res = await fetch("/api/nex/knowledge-inbox/urls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source: activeSource, urls: raw }),
      });
      if (!res.ok) throw new Error(`urls_failed_${res.status}`);
      const json = (await res.json()) as {
        ok: boolean;
        created: InboxItem[];
        duplicates: InboxItem[];
      };
      if (json.duplicates?.length) {
        showToast({
          kind: "info",
          message: `${json.duplicates.length} URL${json.duplicates.length === 1 ? "" : "s"} already in the inbox.`,
        });
      }
      if ((json.created?.length ?? 0) > 0) {
        showToast({ kind: "info", message: "NEX is processing your URLs…" });
        kickBrainPipeline();
      }
      setUrlBuffer("");
    } catch (err) {
      console.error("[knowledge-inbox] urls failed:", err);
      showToast({ kind: "error", message: "URL import failed." });
    } finally {
      refresh();
    }
  }, [urlBuffer, activeSource, refresh, showToast, kickBrainPipeline]);

  // ── Drag & drop plumbing ───────────────────────────────────────────

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      void captureFiles(e.dataTransfer?.files ?? null);
    },
    [captureFiles]
  );

  // ── The core action: Process Inbox — hits the real pipeline ───────

  const runProcessInbox = useCallback(async () => {
    setIsProcessing(true);
    // Optimistic: flip every waiting item to processing so the banner
    // and stat strip update instantly. The server response then
    // overwrites this with the true post-processing state.
    setItems((prev) =>
      prev.map((i) => (i.status === "waiting" ? { ...i, status: "processing" } : i))
    );
    try {
      const res = await fetch("/api/nex/knowledge-inbox/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`process_failed_${res.status}`);
      const json = (await res.json()) as {
        ok: boolean;
        report: ProcessingReport;
        items: InboxItem[];
        stats: ServerStats;
      };
      setItems(json.items);
      setStats(json.stats);
      if (json.report.itemsProcessed > 0) {
        setProcessingReport(json.report);
      }
    } catch (err) {
      console.error("[knowledge-inbox] process failed:", err);
      showToast({ kind: "error", message: "Processing failed. State refreshed from disk." });
      refresh();
    } finally {
      setIsProcessing(false);
    }
  }, [refresh, showToast]);

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
          completedToday={stats?.completedToday ?? 0}
          totalsRecordsCreated={stats?.recordsCreated ?? 0}
          totalsRecordsUpdated={stats?.recordsUpdated ?? 0}
          totalsFaqsGenerated={stats?.faqsGenerated ?? 0}
          loading={loading}
        />

        {/* ── Knowledge Source picker ──────────────────────────────── */}
        <SourcePicker active={activeSource} onSelect={setActiveSource} />

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
          onRefresh={refresh}
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

      <AnimatePresence>
        {toast ? <ToastBanner toast={toast} /> : null}
      </AnimatePresence>
    </div>
  );
}

// ── Toast banner (auto-dismisses in 3.2s) ────────────────────────────

function ToastBanner({ toast }: { toast: NonNullable<Toast> }) {
  const isError = toast.kind === "error";
  return (
    <motion.div
      initial={{ y: 32, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 32, opacity: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 bottom-5 z-40 mx-auto flex max-w-[420px] items-center gap-2 rounded-full border px-4 py-2.5 text-[13px] font-semibold"
      style={{
        background: isError ? "#FEE2E2" : TOKEN.card,
        borderColor: isError ? "#EF4444" : TOKEN.border,
        color: isError ? "#991B1B" : TOKEN.text,
        boxShadow: TOKEN.shadowMd,
      }}
    >
      {isError ? (
        <ShieldAlert size={15} strokeWidth={2.3} />
      ) : (
        <CheckCircle2 size={15} strokeWidth={2.3} style={{ color: TOKEN.info }} />
      )}
      {toast.message}
    </motion.div>
  );
}

// ── Knowledge Source picker ──────────────────────────────────────────
//
// Sits above the capture surfaces. Every item created downstream carries
// the currently-selected source. The picker also surfaces the processing
// pipeline for the active source so Philip can see how NEX will handle
// what he's about to drop in. Selection persists until explicitly changed.

function SourcePicker({
  active,
  onSelect,
}: {
  active: KnowledgeSource;
  onSelect: (s: KnowledgeSource) => void;
}) {
  const meta = SOURCE_META[active];
  const ActiveIcon = meta.icon;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="text-[17px] font-black tracking-tight"
          style={{ color: TOKEN.text }}
        >
          Knowledge Source
        </h2>
        <span
          className="text-[11px] uppercase tracking-[0.24em]"
          style={{ color: TOKEN.textSoft }}
        >
          Source determines the workflow
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {SOURCE_ORDER.map((s) => (
          <SourceButton
            key={s}
            source={s}
            active={s === active}
            onClick={() => onSelect(s)}
          />
        ))}
      </div>

      {/* Selected-source pipeline explainer */}
      <motion.div
        key={active}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="mt-3 flex items-start gap-3 rounded-2xl border p-4"
        style={{
          background: meta.tint,
          borderColor: TOKEN.border,
        }}
      >
        <div
          className="grid h-10 w-10 flex-none place-items-center rounded-xl"
          style={{
            background: TOKEN.card,
            color: meta.fg,
            boxShadow: TOKEN.shadowSm,
          }}
        >
          <ActiveIcon size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: meta.fg }}
            >
              {meta.label}
            </span>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
              style={{
                background: TOKEN.card,
                borderColor: TOKEN.border,
                color: TOKEN.textMid,
              }}
            >
              {meta.scrutiny}
            </span>
          </div>
          <div
            className="mt-1 text-[13px] font-semibold"
            style={{ color: TOKEN.text }}
          >
            {meta.pipeline}
          </div>
          <div
            className="mt-1 text-[12px]"
            style={{ color: TOKEN.textMid }}
          >
            Typical: {meta.examples}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function SourceButton({
  source,
  active,
  onClick,
}: {
  source: KnowledgeSource;
  active: boolean;
  onClick: () => void;
}) {
  const meta = SOURCE_META[source];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-all"
      style={{
        background: active ? meta.tint : TOKEN.card,
        borderColor: active ? meta.dot : TOKEN.border,
        boxShadow: active ? TOKEN.shadowMd : TOKEN.shadowSm,
      }}
    >
      <span
        className="grid h-8 w-8 flex-none place-items-center rounded-xl"
        style={{
          background: active ? TOKEN.card : TOKEN.divider,
          color: meta.fg,
        }}
      >
        <Icon size={15} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="flex items-center gap-1.5 text-[12px] font-bold"
          style={{ color: TOKEN.text }}
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: meta.dot }}
          />
          {meta.label}
        </span>
        <span
          className="mt-0.5 block truncate text-[11px]"
          style={{ color: TOKEN.textSoft }}
        >
          {meta.scrutiny}
        </span>
      </span>
    </button>
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
  loading,
}: {
  items: InboxItem[];
  counters: { waiting: number; processing: number; review: number };
  completedToday: number;
  totalsRecordsCreated: number;
  totalsRecordsUpdated: number;
  totalsFaqsGenerated: number;
  loading?: boolean;
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
        <StatCard key={c.label} label={c.label} value={c.value} tone={c.tone} loading={loading} />
      ))}
      <span className="sr-only">Total items in inbox: {total}</span>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
  loading,
}: {
  label: string;
  value: number;
  tone: "neutral" | "info" | "warning" | "success" | "accent";
  loading?: boolean;
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
      {loading ? (
        <div
          className="nex-skeleton mt-2 h-7 w-14 rounded-md"
          aria-hidden
        />
      ) : (
        <div
          className="mt-2 text-[28px] font-black leading-none tracking-tight"
          style={{ color: toneColour }}
        >
          {value.toLocaleString()}
        </div>
      )}
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
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{
              background: "#D1FAE5",
              borderColor: "#6EE7B7",
              color: "#065F46",
            }}
            title="Every dump auto-runs through the NEX Brain pipeline"
          >
            <Sparkles size={9} strokeWidth={2.6} />
            Auto-process
          </span>
          <button
            type="button"
            onClick={onSaveAndProcess}
            disabled={!value.trim()}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-40"
            style={{ background: TOKEN.accent }}
          >
            <Sparkles size={13} strokeWidth={2.4} />
            Save &amp; Send to NEX
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
          One URL per line · image URLs auto-download for analysis
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
  onRefresh,
}: {
  items: InboxItem[];
  onPreview: (item: InboxItem) => void;
  onReprocess: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh?: () => void;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[22px] font-black tracking-tight" style={{ color: TOKEN.text }}>
          Inbox Queue
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[13px]" style={{ color: TOKEN.textSoft }}>
            {items.length.toLocaleString()} item{items.length === 1 ? "" : "s"}
          </span>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors hover:bg-black/5"
              style={{
                background: TOKEN.card,
                borderColor: TOKEN.border,
                color: TOKEN.textMid,
              }}
              aria-label="Refresh queue from disk"
              title="Refresh from disk"
            >
              <RefreshCcw size={12} strokeWidth={2.2} />
              Refresh
            </button>
          ) : null}
        </div>
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
            <SourceChip source={item.source} />
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

// Small source chip used inside the queue row and the preview drawer.
function SourceChip({ source }: { source: KnowledgeSource }) {
  const meta = SOURCE_META[source];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
      style={{ background: meta.tint, color: meta.fg }}
      title={meta.pipeline}
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: meta.dot }}
      />
      {meta.label}
    </span>
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
          <SourceChip source={item.source} />
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
