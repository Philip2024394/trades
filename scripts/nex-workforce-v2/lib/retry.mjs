// NEX Workforce v2 · Slice 1c · Retry Policy
// ─────────────────────────────────────────────────────────────────────────────
// Bounded exponential backoff with optional jitter. Each policy is declared
// per step; the agent runs the retry loop generically.

export const DEFAULT_POLICY = Object.freeze({
  maxAttempts: 5,
  initialMs:   250,
  maxMs:       8000,
  jitter:      0.25,      // ±25% jitter on each delay
  factor:      2,         // exponential base
});

/**
 * Retry `fn` up to `policy.maxAttempts` times.
 * `shouldRetry(err, attemptNumber, ctx)` decides whether to keep trying.
 * Between attempts, sleep for (initialMs * factor^attempt), capped at maxMs,
 * plus jitter.
 *
 * On final failure, throws the last error (caller classifies it).
 *
 * `onBackoff({ attempt, delayMs, err })` optional hook for logging.
 * `signal` optional AbortSignal to cancel between attempts.
 */
export async function runWithRetry(fn, policy = DEFAULT_POLICY, opts = {}) {
  const { shouldRetry = defaultShouldRetry, onBackoff, signal } = opts;
  let lastErr;
  for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error("retry aborted");
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (!shouldRetry(err, attempt, { policy })) throw err;
      if (attempt === policy.maxAttempts - 1) throw err; // last attempt failed
      const delayMs = computeBackoff(policy, attempt);
      if (onBackoff) onBackoff({ attempt, delayMs, err });
      await sleep(delayMs, signal);
    }
  }
  throw lastErr;
}

function defaultShouldRetry(err) {
  // Default: retry unless the error explicitly marks itself non-retryable
  return !err?.__nonRetryable;
}

export function computeBackoff(policy, attempt) {
  const base = Math.min(policy.initialMs * Math.pow(policy.factor, attempt), policy.maxMs);
  const j    = policy.jitter ?? 0;
  const jitterMs = (Math.random() * 2 - 1) * base * j; // ± j*100% of base
  return Math.max(0, Math.round(base + jitterMs));
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(), ms);
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new Error("retry sleep aborted"));
      }, { once: true });
    }
  });
}
