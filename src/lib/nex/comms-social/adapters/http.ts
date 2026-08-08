// NEX Comms Centre · Social · shared HTTP helper for real adapters.
//
// Every provider adapter uses this helper. It provides:
//   * A 30-second default request timeout via AbortController.
//   * Rate-limit header parsing (Retry-After · X-Business-Use-Case-Usage etc.).
//   * Normalised error classification (invalid_token · rate_limited · transient · unknown).
//
// The helper never retries — that belongs to the worker's outer loop
// (Phase 4 worker owns retry policy · adapters return a single result).

export interface FetchAdapterOptions {
  method?:  "GET" | "POST" | "PUT" | "DELETE";
  url:      string;
  headers?: Record<string, string>;
  body?:    string | URLSearchParams | Buffer;
  timeout_ms?: number;
}

export type FetchAdapterResult =
  | {
      ok:     true;
      status: number;
      headers: Record<string, string>;
      body_text: string;
      json:   unknown;
    }
  | {
      ok:     false;
      error_class:  "invalid_token" | "rate_limited" | "transient" | "policy" | "content_rejected" | "unknown" | "network" | "timeout";
      status: number;
      headers: Record<string, string>;
      body_text: string;
      json:   unknown;
      provider_code:  string | null;
      retry_after_seconds: number | null;
      message: string;
    };

const DEFAULT_TIMEOUT_MS = 30_000;

// Parses Retry-After header (seconds OR HTTP-date) into seconds.
function parseRetryAfter(v: string | null): number | null {
  if (!v) return null;
  const trimmed = v.trim();
  const asInt = Number.parseInt(trimmed, 10);
  if (!Number.isNaN(asInt)) return asInt;
  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, Math.round((asDate - Date.now()) / 1000));
  }
  return null;
}

// Classify a non-OK response. Providers have wildly different error
// shapes; each adapter passes its own classifier. Fallback if none is
// supplied uses HTTP status alone.
export type ProviderClassifier = (input: {
  status: number;
  headers: Record<string, string>;
  body_text: string;
  json: unknown;
}) => {
  error_class: FetchAdapterResult extends { ok: false } ? FetchAdapterResult["error_class"] : never;
  provider_code: string | null;
  message: string;
};

function defaultClassify(input: { status: number; body_text: string }): {
  error_class: "invalid_token" | "rate_limited" | "transient" | "unknown";
  provider_code: string | null;
  message: string;
} {
  const s = input.status;
  if (s === 401 || s === 403) return { error_class: "invalid_token", provider_code: String(s), message: "provider auth rejected" };
  if (s === 429) return { error_class: "rate_limited", provider_code: String(s), message: "rate limited" };
  if (s >= 500) return { error_class: "transient", provider_code: String(s), message: "provider error" };
  return { error_class: "unknown", provider_code: String(s), message: (input.body_text ?? "").slice(0, 200) };
}

export async function providerFetch(
  opts: FetchAdapterOptions,
  classifier: ProviderClassifier | null = null,
): Promise<FetchAdapterResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout_ms ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(opts.url, {
      method:  opts.method ?? "GET",
      headers: opts.headers,
      body:    opts.body as never,
      signal:  controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const message = e instanceof Error ? e.message : String(e);
    const isAbort = message.includes("aborted") || (e instanceof Error && e.name === "AbortError");
    return {
      ok:            false,
      error_class:   isAbort ? "timeout" : "network",
      status:        0,
      headers:       {},
      body_text:     "",
      json:          null,
      provider_code: null,
      retry_after_seconds: null,
      message:       isAbort ? `timeout after ${opts.timeout_ms ?? DEFAULT_TIMEOUT_MS}ms` : message,
    };
  }
  clearTimeout(timer);

  const headers: Record<string, string> = {};
  response.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  const body_text = await response.text();
  let json: unknown = null;
  try { json = body_text ? JSON.parse(body_text) : null; } catch { /* not JSON */ }

  if (response.status >= 200 && response.status < 300) {
    return { ok: true, status: response.status, headers, body_text, json };
  }

  const classified = classifier
    ? classifier({ status: response.status, headers, body_text, json })
    : defaultClassify({ status: response.status, body_text });
  const retry_after_seconds = parseRetryAfter(headers["retry-after"] ?? null);

  return {
    ok:            false,
    error_class:   classified.error_class as never,
    status:        response.status,
    headers,
    body_text,
    json,
    provider_code: classified.provider_code,
    retry_after_seconds,
    message:       classified.message,
  };
}
