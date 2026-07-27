"use client";

// NEX Tag · Staircase Direction — fast single-textbox tagger
//
// Design (Philip 2026-07-27):
// - One staircase image at a time in a rounded container.
// - One textarea — human types direction · materials · balustrade ·
//   context · anything a user might search for.
// - "This is not a staircase" button — human confirms the image is
//   NOT a staircase subject; row is excluded from staircase intelligence.
// - Skip button — leave the row unchanged, move on.
// - Optimistic UI with localStorage queue. Auto-flush at 10 tags or
//   20 seconds. NEX processes the free text server-side into structured
//   knowledge (brain routing · DNA · score · band · classifier fields).

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

const QUEUE_STORAGE_KEY = "nex-tag-direction-queue-v1";
const AUTOFLUSH_TAG_COUNT = 10;
const AUTOFLUSH_INTERVAL_MS = 20_000;

type QueueRow = {
  url: string;
  priority: number;
  primary_brain: string | null;
  score: number | null;
  band: string | null;
  has_description: boolean;
  already_tagged: boolean;
  description_preview: string | null;
};

type StaircaseKind = "full" | "component" | "related";

type PendingTag =
  | { url: string; human_description: string; staircase_kind: StaircaseKind; tagged_by: string }
  | { url: string; not_a_staircase: true; tagged_by: string };

type LivePreview = {
  loading: boolean;
  score: number;
  band_label: string;
  brain: string | null;
  dna_filled: number;
  dna_max: number;
  collections: number;
} | null;

type FlashScore = {
  score: number;
  band: string;
  brain: string | null;
  kind: string;
  url: string;
} | null;

export default function NexTagClient() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [totals, setTotals] = useState<{ total: number; untagged: number }>({ total: 0, untagged: 0 });
  const [cursor, setCursor] = useState(0);
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState<PendingTag[]>([]);
  const [savedThisSession, setSavedThisSession] = useState(0);
  const [flushBanner, setFlushBanner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [livePreview, setLivePreview] = useState<LivePreview>(null);
  const [lastFlash, setLastFlash] = useState<FlashScore>(null);
  const flushInFlight = useRef(false);
  const lastFlushAt = useRef<number>(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previewAbort = useRef<AbortController | null>(null);

  const current = queue[cursor];

  // ---- Initial load ----
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/nex-tag/queue?limit=500");
        const data = await res.json();
        if (!data.ok) throw new Error(data.error ?? "queue_error");
        setQueue(data.images ?? []);
        setTotals({ total: data.total_rows, untagged: data.total_untagged });
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as PendingTag[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPending(parsed);
            setFlushBanner(`Restored ${parsed.length} unsaved tag${parsed.length > 1 ? "s" : ""} from your last session.`);
          }
        } catch { /* corrupt storage, ignore */ }
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(pending));
  }, [pending]);

  // ---- Live score preview (debounced) ----
  useEffect(() => {
    const desc = description.trim();
    if (desc.length === 0) { setLivePreview(null); return; }
    setLivePreview((p) => ({ ...(p ?? { score: 0, band_label: "", brain: null, dna_filled: 0, dna_max: 12, collections: 0 }), loading: true }));
    const handle = setTimeout(async () => {
      previewAbort.current?.abort();
      const ac = new AbortController();
      previewAbort.current = ac;
      try {
        const res = await fetch("/api/admin/nex-tag/score-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: desc, staircase_kind: "full" }),
          signal: ac.signal,
        });
        const data = await res.json();
        if (!ac.signal.aborted && data.ok) {
          setLivePreview({
            loading: false,
            score: data.score,
            band_label: data.band_label,
            brain: data.brain,
            dna_filled: data.dna_filled ?? 0,
            dna_max: data.dna_max ?? 12,
            collections: data.collections ?? 0,
          });
        }
      } catch { /* aborted or network — ignore */ }
    }, 500);
    return () => clearTimeout(handle);
  }, [description]);

  // Focus the textarea when a new image appears (including initial queue load).
  // Depend on the current row's URL so the effect fires once the queue
  // populates AND every time the cursor advances. A tiny setTimeout waits
  // for the layout paint so focus lands reliably.
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => textareaRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [current?.url]);

  // ---- Flush queue to server ----
  const flush = useCallback(async () => {
    if (flushInFlight.current) return;
    if (pending.length === 0) return;
    flushInFlight.current = true;
    const batch = pending.slice();
    try {
      const res = await fetch("/api/admin/nex-tag/batch-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: batch }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "save_error");
      setPending((prev) => prev.filter((p) => !batch.some((b) => b.url === p.url)));
      setSavedThisSession((n) => n + (data.saved ?? 0));
      lastFlushAt.current = Date.now();
      setFlushBanner(
        `✓ Flushed ${data.saved} · described ${data.described ?? 0} · marked-not-a-staircase ${data.excluded ?? 0} · backup created`
      );
      // Flash the most recent per-row score
      if (Array.isArray(data.per_row) && data.per_row.length > 0) {
        const last = data.per_row[data.per_row.length - 1];
        if (last.action === "describe") {
          setLastFlash({
            score: last.score,
            band: last.band,
            brain: last.brain,
            kind: last.staircase_kind,
            url: last.url,
          });
          setTimeout(() => setLastFlash(null), 4000);
        }
      }
      setTimeout(() => setFlushBanner(null), 3500);
    } catch (e) {
      setFlushBanner(`⚠ Flush failed: ${String(e)} · will retry automatically`);
    } finally {
      flushInFlight.current = false;
    }
  }, [pending]);

  // Auto-flush timer
  useEffect(() => {
    const id = setInterval(() => {
      if (pending.length >= AUTOFLUSH_TAG_COUNT) void flush();
      else if (pending.length > 0 && Date.now() - lastFlushAt.current > AUTOFLUSH_INTERVAL_MS) void flush();
    }, 1500);
    return () => clearInterval(id);
  }, [pending, flush]);

  const advance = () => setCursor((c) => Math.min(c + 1, queue.length - 1));

  const saveWithKind = useCallback((kind: StaircaseKind) => {
    if (!current) return;
    const desc = description.trim();
    setPending((prev) => {
      const next = prev.filter((p) => p.url !== current.url);
      next.push({ url: current.url, human_description: desc, staircase_kind: kind, tagged_by: "philip" });
      return next;
    });
    setDescription("");
    advance();
  }, [current, description]);

  const markNotAStaircase = useCallback(() => {
    if (!current) return;
    setPending((prev) => {
      const next = prev.filter((p) => p.url !== current.url);
      next.push({ url: current.url, not_a_staircase: true, tagged_by: "philip" });
      return next;
    });
    setDescription("");
    advance();
  }, [current]);

  const skip = useCallback(() => {
    setDescription("");
    advance();
  }, []);

  const goPrev = useCallback(() => {
    setCursor((c) => Math.max(0, c - 1));
    setDescription("");
  }, []);

  // ---- Keyboard shortcuts (safe when textarea has focus) ----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter → save as full staircase (works even when textarea has focus)
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault(); saveWithKind("full"); return;
      }
      // Ctrl/Cmd + 1/2/3/4 → save with kind (works from textarea)
      if ((e.metaKey || e.ctrlKey) && e.key === "1") { e.preventDefault(); saveWithKind("full"); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "2") { e.preventDefault(); saveWithKind("component"); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "3") { e.preventDefault(); saveWithKind("related"); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "4") { e.preventDefault(); markNotAStaircase(); return; }
      // Cmd+S → flush queue immediately
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); void flush(); return;
      }
      // Escape → skip (works from anywhere)
      if (e.key === "Escape") {
        e.preventDefault(); skip(); return;
      }
      // Arrow keys work only when NOT typing
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") { e.preventDefault(); skip(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveWithKind, markNotAStaircase, skip, goPrev, flush]);

  const progress = useMemo(() => ({
    done: savedThisSession + pending.length,
    remaining: Math.max(0, queue.length - cursor),
    total: queue.length,
  }), [savedThisSession, pending, queue, cursor]);

  if (loading) return <div className="p-8 font-sans text-neutral-700">Loading NEX Tag · Staircase Direction queue…</div>;
  if (error) return <div className="p-8 font-sans text-red-700">Failed to load queue: {error}</div>;
  if (queue.length === 0) {
    return (
      <div className="p-8 font-sans">
        <h1 className="text-2xl font-semibold mb-2">NEX Tag · Staircase Direction</h1>
        <p className="text-neutral-600">No untagged rows in the manifest. Every image has already been human-tagged or marked not-a-staircase.</p>
      </div>
    );
  }
  if (!current) {
    return (
      <div className="p-8 font-sans">
        <h1 className="text-2xl font-semibold mb-2">NEX Tag · Staircase Direction</h1>
        <p className="text-neutral-600">You've reached the end of the queue. {pending.length > 0 && `${pending.length} tags still queued locally.`}</p>
        {pending.length > 0 && (
          <button onClick={() => void flush()} className="mt-4 rounded-lg bg-neutral-900 text-white px-4 py-2">Flush now</button>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 font-sans text-sm text-neutral-900" style={{ color: "#171717" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-3 flex items-center gap-6 text-neutral-900">
        <div className="font-semibold text-neutral-900">NEX Tag · Staircase Direction</div>
        <div className="text-neutral-600">
          Position <span className="font-mono">{cursor + 1}</span> / <span className="font-mono">{queue.length}</span>
          <span className="mx-3 text-neutral-300">·</span>
          Tagged this session <span className="font-mono">{progress.done}</span>
          <span className="mx-3 text-neutral-300">·</span>
          Queued locally <span className="font-mono">{pending.length}</span>
          <span className="mx-3 text-neutral-300">·</span>
          Manifest untagged <span className="font-mono">{totals.untagged}</span>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => void flush()} disabled={pending.length === 0}
            className="rounded-lg bg-neutral-900 text-white px-3 py-1.5 disabled:opacity-40">
            Flush now ({pending.length})
          </button>
          <button onClick={goPrev} className="rounded-lg border border-neutral-300 px-3 py-1.5">← Prev</button>
        </div>
      </div>

      {flushBanner && (
        <div className="bg-blue-50 border-b border-blue-200 text-blue-900 px-6 py-2 text-sm">{flushBanner}</div>
      )}

      <div className="grid grid-cols-[1fr_1fr] gap-6 p-6 max-w-[1400px] mx-auto">
        {/* Left — image + row info */}
        <div>
          <figure className="rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.url}
              alt="staircase reference"
              className="w-full h-auto object-contain bg-neutral-50"
              style={{ maxHeight: "70vh" }}
            />
            <figcaption className="px-4 py-2 text-xs text-neutral-500 border-t border-neutral-100 break-all">
              {current.url}
            </figcaption>
          </figure>
          <div className="mt-4 text-xs text-neutral-600 space-y-1">
            <div><span className="text-neutral-400">Current brain:</span> {current.primary_brain ?? <span className="text-amber-700 font-medium">unclassified</span>}</div>
            <div><span className="text-neutral-400">Current score:</span> {current.score ?? "—"} · <span className="text-neutral-400">Band:</span> {current.band ?? "—"}</div>
            {current.description_preview && (
              <div className="mt-2 p-2 rounded bg-neutral-100 text-neutral-700 leading-snug">
                <span className="text-neutral-400 text-[10px] uppercase tracking-wide">Existing auto-description</span><br />
                {current.description_preview}…
              </div>
            )}
          </div>
        </div>

        {/* Right — the single textbox + 3 buttons */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-neutral-700">
              Describe this staircase
            </label>
            <p className="text-xs text-neutral-500 mb-3 leading-relaxed">
              Direction (straight · quarter turn · dog leg · half turn / U · winder · spiral · helical · floating · cantilever), materials (oak · walnut · mahogany · pine · painted · steel), balustrade (glass · timber · stainless · black metal), context (internal · external / garden · fire escape), and anything users would search for. NEX will process this into structured knowledge · brain routing · DNA · score.
            </p>
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onClick={(e) => e.currentTarget.focus()}
              placeholder="e.g. Half-landing (U-shape) oak staircase with cut string sides, glass balustrade panels, brushed stainless steel handrail, in a contemporary hallway. Extended starting steps into the room. Internal."
              className="w-full h-56 p-3 rounded-lg border border-neutral-300 text-sm font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent bg-white text-neutral-900 placeholder:text-neutral-400"
              style={{ color: "#171717" }}
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-neutral-400">{description.length} chars</span>
              <LiveScoreBadge preview={livePreview} flash={lastFlash} />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2 font-medium">
              What is this image?
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => saveWithKind("full")}
                className="rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-3 font-medium shadow-sm text-left"
              >
                <div className="flex items-baseline justify-between">
                  <span>Full staircase</span>
                  <span className="opacity-70 text-xs">Cmd+1</span>
                </div>
                <div className="text-xs opacity-80 mt-0.5">Complete design or install shot</div>
              </button>
              <button
                onClick={() => saveWithKind("component")}
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 font-medium shadow-sm text-left"
              >
                <div className="flex items-baseline justify-between">
                  <span>Staircase component</span>
                  <span className="opacity-70 text-xs">Cmd+2</span>
                </div>
                <div className="text-xs opacity-80 mt-0.5">Newel · handrail · tread · baluster · wedge · scroll</div>
              </button>
              <button
                onClick={() => saveWithKind("related")}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 font-medium shadow-sm text-left"
              >
                <div className="flex items-baseline justify-between">
                  <span>Staircase related</span>
                  <span className="opacity-70 text-xs">Cmd+3</span>
                </div>
                <div className="text-xs opacity-80 mt-0.5">Joiner picking wood · workshop · install · hallway</div>
              </button>
              <button
                onClick={markNotAStaircase}
                className="rounded-lg bg-red-600 hover:bg-red-700 text-white px-4 py-3 font-medium shadow-sm text-left"
              >
                <div className="flex items-baseline justify-between">
                  <span>Not a staircase</span>
                  <span className="opacity-70 text-xs">Cmd+4</span>
                </div>
                <div className="text-xs opacity-80 mt-0.5">Unrelated — exclude from staircase intelligence</div>
              </button>
            </div>
            <button
              onClick={skip}
              className="mt-2 w-full rounded-lg border border-neutral-300 text-neutral-700 px-4 py-2 font-medium hover:bg-neutral-50"
            >
              Skip · leave row unchanged <span className="opacity-70 text-xs ml-1">Esc</span>
            </button>
          </div>

          <div className="text-xs text-neutral-500 pt-2 border-t border-neutral-200 leading-relaxed">
            <div><kbd>Cmd/Ctrl + 1-4</kbd> save with kind · <kbd>Cmd/Ctrl + Enter</kbd> = Cmd+1 · <kbd>Esc</kbd> skip · <kbd>←</kbd> previous · <kbd>Cmd/Ctrl + S</kbd> flush queue immediately.</div>
            <div className="mt-1">
              Queue auto-flushes every {AUTOFLUSH_TAG_COUNT} tags or {AUTOFLUSH_INTERVAL_MS / 1000}s. All tags survive tab close via localStorage.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 75) return "bg-green-100 text-green-800 border-green-300";
  if (score >= 60) return "bg-blue-100 text-blue-800 border-blue-300";
  if (score >= 40) return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-neutral-100 text-neutral-700 border-neutral-300";
}

function LiveScoreBadge({ preview, flash }: { preview: LivePreview; flash: FlashScore }) {
  if (flash) {
    return (
      <span
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-md border font-medium ${scoreColor(flash.score)}`}
        title={`Saved · ${flash.brain ?? "no brain"} · kind ${flash.kind}`}
      >
        ✓ Saved {flash.score}/100 · {flash.band}
      </span>
    );
  }
  if (!preview) {
    return <span className="text-neutral-400">Live score appears here as you type</span>;
  }
  if (preview.loading) {
    return <span className="text-neutral-400">Scoring…</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-md border font-medium ${scoreColor(preview.score)}`}
      title={`DNA ${preview.dna_filled}/${preview.dna_max} filled · ${preview.collections} collection${preview.collections === 1 ? "" : "s"} · brain ${preview.brain ?? "unclassified"}`}
    >
      Live {preview.score}/100 · {preview.band_label} · {preview.brain ?? "no brain yet"} · DNA {preview.dna_filled}/{preview.dna_max}
    </span>
  );
}
