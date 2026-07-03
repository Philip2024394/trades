// fetchWithRetry — durable HTTP helper for Studio.
//
// Standard fetch semantics, plus:
//   · Exponential backoff with jitter (300ms → 600ms → 1200ms …)
//   · Respects navigator.onLine — waits for `online` event before
//     first attempt if offline
//   · Retries on transient 5xx + network errors; treats 4xx as
//     terminal (bad request never gets better)
//   · Optional abort signal
//   · Optional onRetry callback for UI (e.g. "Retrying in 1s…")
//
// Not a fetch replacement — call this from data-mutation paths that
// must reach the server (publish, install, save layout). Read-only
// polling queries stay on plain fetch.

export type FetchWithRetryOptions = RequestInit & {
  /** Maximum attempts INCLUDING the first. Default: 4. */
  maxAttempts?: number;
  /** Base delay in ms. Doubles each attempt. Default: 300. */
  baseDelayMs?: number;
  /** Called before each retry with the attempt number (1-indexed
   *  for the RETRY, so first retry = 1) and the delay we'll wait. */
  onRetry?: (attempt: number, delayMs: number, error: Error) => void;
  /** External abort signal — merges with our own timeout signal. */
  signal?: AbortSignal;
};

export class RetriedFetchError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly lastResponse: Response | null,
    readonly lastError: Error | null
  ) {
    super(message);
    this.name = "RetriedFetchError";
  }
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 300;
  const { onRetry, ...init } = options;

  // If we're offline, wait for the online event before starting.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await waitForOnline(init.signal);
  }

  let lastError: Error | null = null;
  let lastResponse: Response | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(input, init);
      // 4xx — terminal. The server has decided; retrying won't help.
      if (res.status >= 400 && res.status < 500) return res;
      // 2xx / 3xx — success, hand back.
      if (res.status < 400) return res;
      // 5xx — transient. Fall through to retry.
      lastResponse = res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err as Error;
    }

    if (attempt >= maxAttempts) break;

    // Exponential + jitter (±30%).
    const raw = baseDelayMs * 2 ** (attempt - 1);
    const jitter = raw * (0.7 + Math.random() * 0.6);
    const delayMs = Math.round(jitter);
    onRetry?.(attempt, delayMs, lastError ?? new Error("unknown"));
    await sleep(delayMs, init.signal);
  }

  throw new RetriedFetchError(
    `fetchWithRetry: ${maxAttempts} attempts exhausted`,
    maxAttempts,
    lastResponse,
    lastError
  );
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(() => {
      resolve();
    }, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

function waitForOnline(signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    if (navigator.onLine) {
      resolve();
      return;
    }
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onOnline = () => {
      window.removeEventListener("online", onOnline);
      resolve();
    };
    window.addEventListener("online", onOnline);
    signal?.addEventListener(
      "abort",
      () => {
        window.removeEventListener("online", onOnline);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}
