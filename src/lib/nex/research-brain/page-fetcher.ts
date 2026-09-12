// src/lib/nex/research-brain/page-fetcher.ts
//
// Founder Path A · Phase RB-2 · bounded page fetcher.
//
// Turns a hit URL into cleaned paragraph-level text spans. Zero paid
// API. Uses built-in fetch. Bounded by per-URL budget + total-per-plan
// budget so a slow page can never stall the Research Brain.
//
// Doctrine anchors:
//   #1 Every extracted paragraph becomes an EvidenceSpan · Gate v2
//      alignment scores each claim against the actual span text.
//   #3 Fetched evidence stays capped at evidence_provisional in
//      reportToEvidenceItems (no promotion path).
//
// Politeness:
//   · Respects a small User-Agent identifying NEX
//   · AbortSignal wired to caller timeout
//   · Follows redirects (browser default)
//   · Content-type must start with "text/" (guards against big binaries)
//   · Max response bytes hard-capped

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_BYTES = 500_000;                 // 500 KB per page
const MIN_CHUNK_CHARS = 40;
const MAX_CHUNK_CHARS = 800;
const MAX_CHUNKS_PER_PAGE = 8;
const USER_AGENT = "NEX-Research-Brain/1 (+https://thenetworkers.app)";

export interface PageFetchInput {
  url: string;
  budget_ms?: number;
  signal?: AbortSignal;
}

export interface PageFetchOutput {
  url: string;
  ok: boolean;
  status?: number;
  mime_type?: string;
  fetched_bytes: number;
  chunks: readonly string[];            // paragraph-level text · deduped · length-bounded
  request_ms: number;
  error?: string;
}

/** Fetch + parse a single URL into deduped paragraph chunks. Never throws. */
export async function fetchPage(input: PageFetchInput): Promise<PageFetchOutput> {
  const t0 = performance.now();
  const budget = Math.min(Math.max(input.budget_ms ?? DEFAULT_TIMEOUT_MS, 500), 30_000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("fetch_timeout", "AbortError")), budget);
  if (input.signal) {
    if (input.signal.aborted) controller.abort(new DOMException("caller_aborted", "AbortError"));
    else input.signal.addEventListener("abort", () => controller.abort(input.signal!.reason), { once: true });
  }
  try {
    const res = await fetch(input.url, {
      method: "GET",
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html, text/plain; q=0.9, */*; q=0.1" },
      redirect: "follow",
      signal: controller.signal,
    });
    const mime = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!res.ok) {
      return honestFail(input.url, t0, `http_${res.status}`, res.status, mime, 0);
    }
    if (!mime.startsWith("text/")) {
      return honestFail(input.url, t0, `non_text_mime:${mime}`, res.status, mime, 0);
    }
    // Bounded body read.
    const body = await readBounded(res, MAX_BYTES, controller.signal);
    const chunks = mime.includes("html")
      ? extractHtmlChunks(body)
      : extractPlainChunks(body);
    return {
      url: input.url,
      ok: true,
      status: res.status,
      mime_type: mime,
      fetched_bytes: body.length,
      chunks,
      request_ms: Math.round(performance.now() - t0),
    };
  } catch (e) {
    const reason = (e as { name?: string })?.name === "AbortError" ? "aborted" :
      e instanceof Error ? e.message.slice(0, 100) : "fetch_error";
    return honestFail(input.url, t0, reason);
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Body read (bounded)
// ═══════════════════════════════════════════════════════════════════

async function readBounded(res: Response, maxBytes: number, _signal: AbortSignal): Promise<string> {
  // Prefer stream so we can hard-cap. Fall back to text() if reader missing.
  if (!res.body) return (await res.text()).slice(0, maxBytes);
  const reader = res.body.getReader();
  const dec = new TextDecoder("utf-8", { fatal: false });
  let out = "";
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      out += dec.decode(value, { stream: true });
      if (total >= maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        break;
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* ignore */ }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// HTML → paragraph chunks (lightweight regex extractor · no deps)
// ═══════════════════════════════════════════════════════════════════

const _SCRIPT_STYLE_RE = /<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi;
const _TAG_RE = /<[^>]+>/g;
const _ENTITY_RE = /&(nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g;

function decodeEntities(text: string): string {
  return text.replace(_ENTITY_RE, (m, g) => {
    if (g === "nbsp") return " ";
    if (g === "amp") return "&";
    if (g === "lt") return "<";
    if (g === "gt") return ">";
    if (g === "quot") return '"';
    if (g === "apos") return "'";
    if (typeof g === "string" && g.startsWith("#x")) return String.fromCodePoint(parseInt(g.slice(2), 16));
    if (typeof g === "string" && g.startsWith("#")) return String.fromCodePoint(parseInt(g.slice(1), 10));
    return m;
  });
}

function extractHtmlChunks(html: string): string[] {
  const stripped = html.replace(_SCRIPT_STYLE_RE, " ");
  // Split by paragraph-like block tags · then strip remaining tags.
  const rawBlocks = stripped.split(/<\/?(?:p|div|section|article|li|h[1-6]|br)[^>]*>/i);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of rawBlocks) {
    const text = decodeEntities(raw.replace(_TAG_RE, " "))
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_CHUNK_CHARS);
    if (text.length < MIN_CHUNK_CHARS) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_CHUNKS_PER_PAGE) break;
  }
  return out;
}

function extractPlainChunks(body: string): string[] {
  const paras = body.split(/\n{2,}/).map((p) => p.replace(/\s+/g, " ").trim());
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of paras) {
    const text = raw.slice(0, MAX_CHUNK_CHARS);
    if (text.length < MIN_CHUNK_CHARS) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_CHUNKS_PER_PAGE) break;
  }
  return out;
}

function honestFail(url: string, t0: number, error: string, status?: number, mime?: string, bytes = 0): PageFetchOutput {
  return {
    url,
    ok: false,
    status,
    mime_type: mime,
    fetched_bytes: bytes,
    chunks: [],
    request_ms: Math.round(performance.now() - t0),
    error,
  };
}
