// NEX ImageKit → Supabase migration · shared pipeline utilities.
// Introduced by Phase 3D-R post-mortem fixes (Philip 2026-09-02).
//
// Exports:
//   selectDealiased  — Fix 1 · one candidate per destination_path
//   uploadWithDetail — Fix 2 · rich Supabase upload error capture
//
// Intended consumers:
//   · 03d-r-fix-and-reconcile.mjs (this cycle, read-only diagnostic)
//   · 03e-migrate-batch-100.mjs   (future · when Philip authorises)
//   · 03f+                        (future batches)
//
// SAFETY:
//   · Both helpers preserve every source ledger entry — nothing is deleted or renamed.
//   · uploadWithDetail never logs credentials/tokens/service keys.
//   · uploadWithDetail always uses upsert:false (no silent overwrite).

// ═══════════════════════════════════════════════════════════════════════
// Fix 1 · De-aliased candidate selection
// ═══════════════════════════════════════════════════════════════════════
//
// Ledger has 174 destination_path collision groups (349 source_urls).
// Aliased source_urls share a destination_path — running both through the
// pipeline in the same batch causes destination collisions.
//
// This selector:
//   · Groups eligible PENDING entries by destination_path
//   · Picks at most ONE candidate per group (first sorted by source_url)
//   · Skips groups where another entry is already VERIFIED at that path
//   · Reports every entry that was NOT selected (as skipped_alias)
//   · Preserves all 2,147 ledger entries untouched
//
// Return shape:
//   {
//     candidates:        Array<LedgerEntry>,
//     skipped_aliases:   Array<{ source_url, destination_path, reason, chosen_source_url? }>,
//     eligible_before:   number,
//     candidate_pool:    number,   // total after de-aliasing, before hard-limit slice
//     groups_skipped_alias_of_selected:      number,
//     groups_skipped_destination_verified:   number,
//   }
export function selectDealiased(ledger, {
  hardLimit,
  provenanceAllowed = new Set(["OWNED_LIKELY_AI_GENERATED", "OWNED_LIKELY_UPLOAD"]),
  accountsAllowed   = new Set(["5vv5pw26q", "9mrgsv2rp", "nepgaxllc"]),
  requireValidationReachable = true,
  distribution      = null,   // { "5vv5pw26q": N, ... } · optional per-account quotas
} = {}) {
  // 1 · Filter eligible PENDING entries
  const eligible = ledger.entries.filter((e) =>
    e.status === "PENDING" &&
    provenanceAllowed.has(e.provenance) &&
    accountsAllowed.has(e.imagekit_account) &&
    (!requireValidationReachable || e.validation_state === "REACHABLE") &&
    e.source_url?.startsWith("https://ik.imagekit.io/") &&
    e.destination_path
  );

  // 2 · Track destination_paths that are already VERIFIED via any source_url
  const destAlreadyVerified = new Set();
  for (const e of ledger.entries) {
    if (e.status === "VERIFIED" && e.destination_path) {
      destAlreadyVerified.add(e.destination_path);
    }
  }

  // 3 · Group eligible entries by destination_path
  const byDest = new Map();
  for (const e of eligible) {
    if (!byDest.has(e.destination_path)) byDest.set(e.destination_path, []);
    byDest.get(e.destination_path).push(e);
  }

  const skippedAliases = [];
  const perAccount     = { "5vv5pw26q": [], "9mrgsv2rp": [], "nepgaxllc": [] };
  let   groupsSkippedAliasOfSelected    = 0;
  let   groupsSkippedDestVerified       = 0;

  // 4 · For each destination_path, pick ONE candidate (or skip if verified via alias)
  const sortedDests = [...byDest.keys()].sort();
  for (const dest of sortedDests) {
    const group = byDest.get(dest);
    if (destAlreadyVerified.has(dest)) {
      groupsSkippedDestVerified++;
      for (const e of group) {
        skippedAliases.push({
          source_url:       e.source_url,
          destination_path: dest,
          reason:           "destination_already_verified_via_alias",
        });
      }
      continue;
    }
    group.sort((a, b) => a.source_url.localeCompare(b.source_url));
    const chosen = group[0];
    const rest   = group.slice(1);
    perAccount[chosen.imagekit_account].push(chosen);
    if (rest.length > 0) groupsSkippedAliasOfSelected++;
    for (const e of rest) {
      skippedAliases.push({
        source_url:        e.source_url,
        destination_path:  dest,
        reason:            "alias_of_selected_candidate",
        chosen_source_url: chosen.source_url,
      });
    }
  }

  const candidatePool = perAccount["5vv5pw26q"].length + perAccount["9mrgsv2rp"].length + perAccount["nepgaxllc"].length;

  // 5 · Apply distribution + hardLimit
  let candidates = [];
  if (distribution) {
    for (const acc of Object.keys(distribution)) {
      const take = Math.min(distribution[acc], perAccount[acc]?.length ?? 0);
      for (let i = 0; i < take; i++) candidates.push(perAccount[acc][i]);
    }
    if (candidates.length < hardLimit) {
      const rem = [];
      for (const acc of Object.keys(perAccount)) {
        rem.push(...perAccount[acc].slice(distribution[acc] || 0));
      }
      rem.sort((a, b) => a.source_url.localeCompare(b.source_url));
      while (candidates.length < hardLimit && rem.length > 0) candidates.push(rem.shift());
    }
  } else {
    for (const acc of Object.keys(perAccount)) candidates.push(...perAccount[acc]);
    candidates.sort((a, b) => a.source_url.localeCompare(b.source_url));
  }
  if (candidates.length > hardLimit) candidates.length = hardLimit;

  return {
    candidates,
    skipped_aliases: skippedAliases,
    eligible_before: eligible.length,
    candidate_pool:  candidatePool,
    groups_skipped_alias_of_selected:    groupsSkippedAliasOfSelected,
    groups_skipped_destination_verified: groupsSkippedDestVerified,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Fix 2 · Upload with detailed error capture (+ optional 429 retry · 3E-R hardening)
// ═══════════════════════════════════════════════════════════════════════
//
// Never log credentials/tokens/service keys. Only extract specific
// diagnostic fields from the error object.
//
// Contract:
//   · Always uses upsert:false (never overridable · asserted below)
//   · Treats "already exists" style errors as { ok: true, uploadOutcome: "existing" }
//     so callers can fall through to retrieve-and-verify
//   · Returns a structured error_detail on any other failure
//   · If retry_policy is supplied AND the error is HTTP 429 (Supabase
//     "Too many connections issued to the database"), the caller-supplied
//     exponential backoff is applied and the upload is retried up to
//     retry_policy.max_attempts times. All other error kinds return immediately.
//   · Non-429 failures NEVER retry (transient network glitches / auth /
//     bad-request must not be silently repeated).
//
// retry_policy = null (default · single attempt, current behavior) OR
//                { max_attempts: N, base_delay_ms: M, factor: F }
//                delay(attempt n) = base_delay_ms · factor^(n-1)
//                e.g. { 4, 5000, 2 } → 5s · 10s · 20s (35s worst-case per image)
//
// Return shape:
//   {
//     ok:              boolean,
//     uploadOutcome:   "uploaded" | "existing" | "failed" | "threw",
//     attempts_made:   number,
//     retry_history:   Array<{ attempt, http_status?, error_summary?, backoff_ms? }>,
//     error_detail:    null | { source_url, destination_path, attempt,
//                               supabase_error_message?, supabase_error_name?,
//                               supabase_error_code?, http_status?,
//                               thrown_error_message?, thrown_error_name?,
//                               raw_error_repr },
//   }
export async function uploadWithDetail(sb, {
  bucket,
  destination_path,
  body,
  content_type,
  source_url,
  cache_control = "3600",
  retry_policy  = null,   // null = single attempt (backward-compat)
}) {
  const maxAttempts   = retry_policy?.max_attempts   ?? 1;
  const baseDelayMs   = retry_policy?.base_delay_ms  ?? 5_000;
  const factor        = retry_policy?.factor         ?? 2;
  const retry_history = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const single = await singleUploadAttempt(sb, {
      bucket, destination_path, body, content_type, source_url, cache_control, attempt,
    });

    // Success · return immediately (no further retries)
    if (single.ok) {
      retry_history.push({ attempt, http_status: 200, outcome: single.uploadOutcome });
      return { ...single, attempts_made: attempt, retry_history };
    }

    // Failure · decide whether to retry
    const is429 = single.error_detail?.http_status === 429
               || single.error_detail?.supabase_error_code === "429"
               || single.error_detail?.supabase_error_code === 429;
    retry_history.push({
      attempt,
      http_status:    single.error_detail?.http_status ?? null,
      error_summary:  single.error_detail?.supabase_error_message
                    ?? single.error_detail?.thrown_error_message
                    ?? null,
      is429,
    });

    // Not a 429 → do not retry · surface immediately
    if (!is429) {
      return { ...single, attempts_made: attempt, retry_history };
    }
    // 429 but retries exhausted → surface with full history
    if (attempt >= maxAttempts) {
      return { ...single, attempts_made: attempt, retry_history };
    }
    // 429 and more attempts remain → backoff then loop
    const backoff = baseDelayMs * Math.pow(factor, attempt - 1);
    retry_history[retry_history.length - 1].backoff_ms = backoff;
    await sleep(backoff);
  }

  // Unreachable · defensive
  return { ok: false, uploadOutcome: "failed", attempts_made: maxAttempts, retry_history, error_detail: { source_url, destination_path, attempt: maxAttempts, note: "retry loop fell through (defensive)" } };
}

async function singleUploadAttempt(sb, {
  bucket, destination_path, body, content_type, source_url, cache_control, attempt,
}) {
  try {
    const { error } = await sb.storage.from(bucket).upload(
      destination_path,
      body,
      { contentType: content_type, upsert: false, cacheControl: cache_control },
    );
    if (error) {
      if (/already exists|duplicate|resource already/i.test(error.message || "")) {
        return { ok: true, uploadOutcome: "existing", error_detail: null };
      }
      return {
        ok: false,
        uploadOutcome: "failed",
        error_detail: {
          source_url, destination_path, attempt,
          supabase_error_message: error.message ?? null,
          supabase_error_name:    error.name    ?? null,
          supabase_error_code:    (error.code ?? error.statusCode ?? null),
          http_status:            (error.status ?? error.statusCode ?? null),
          raw_error_repr:         safeErrRepr(error),
        },
      };
    }
    return { ok: true, uploadOutcome: "uploaded", error_detail: null };
  } catch (e) {
    return {
      ok: false,
      uploadOutcome: "threw",
      error_detail: {
        source_url, destination_path, attempt,
        thrown_error_message: e?.message ?? null,
        thrown_error_name:    e?.name    ?? null,
        raw_error_repr:       safeErrRepr(e),
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Fix 3 · Retrieve with detailed error capture (+ optional 429 retry · 3E-R hardening)
// ═══════════════════════════════════════════════════════════════════════
//
// Public Supabase Storage CDN also throttles under load (observed in
// Phase 3E: 5 of the 12 TRANSIENT failures were on the retrieve step).
//
// Contract:
//   · Single-attempt behavior when retry_policy = null (backward-compat)
//   · Retries HTTP 429 only, up to retry_policy.max_attempts times
//   · Non-429 non-2xx failures return immediately with structured error
//   · Full retry_history preserved regardless of final outcome
//
// Return shape:
//   { ok: true,  http_status, content_length, content_type, body, attempts_made, retry_history }
//   { ok: false, error_detail: { url, http_status?, note?, thrown_error_message? }, attempts_made, retry_history }
export async function retrieveWithDetail(url, { retry_policy = null } = {}) {
  const maxAttempts   = retry_policy?.max_attempts   ?? 1;
  const baseDelayMs   = retry_policy?.base_delay_ms  ?? 5_000;
  const factor        = retry_policy?.factor         ?? 2;
  const retry_history = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await fetch(url);
      const entry = { attempt, http_status: r.status };

      // 429 with retries remaining → backoff and loop
      if (r.status === 429 && attempt < maxAttempts) {
        const backoff = baseDelayMs * Math.pow(factor, attempt - 1);
        entry.backoff_ms = backoff;
        entry.is429 = true;
        retry_history.push(entry);
        await sleep(backoff);
        continue;
      }
      retry_history.push(entry);

      if (!r.ok) {
        return {
          ok: false,
          error_detail: {
            url, http_status: r.status, attempt,
            note: r.status === 429
              ? "Supabase retrieve rate-limited · retries exhausted"
              : `HTTP ${r.status}`,
          },
          attempts_made: attempt,
          retry_history,
        };
      }

      const buf = await r.arrayBuffer();
      return {
        ok: true,
        http_status:    r.status,
        content_length: buf.byteLength,
        content_type:   r.headers.get("content-type"),
        body:           buf,
        attempts_made:  attempt,
        retry_history,
      };
    } catch (e) {
      const entry = { attempt, thrown_error_message: e?.message ?? null };
      retry_history.push(entry);
      if (attempt >= maxAttempts) {
        return {
          ok: false,
          error_detail: {
            url, attempt,
            thrown_error_message: e?.message ?? null,
            thrown_error_name:    e?.name    ?? null,
          },
          attempts_made: attempt,
          retry_history,
        };
      }
      const backoff = baseDelayMs * Math.pow(factor, attempt - 1);
      entry.backoff_ms = backoff;
      await sleep(backoff);
    }
  }

  // Unreachable · defensive
  return { ok: false, error_detail: { url, attempt: maxAttempts, note: "retrieve loop fell through (defensive)" }, attempts_made: maxAttempts, retry_history };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Extract only whitelisted fields · never dump headers / tokens / full body.
function safeErrRepr(err) {
  const allow = ["message", "name", "code", "status", "statusCode", "hint", "details"];
  const out   = {};
  for (const k of allow) if (err && err[k] !== undefined) out[k] = err[k];
  try { return JSON.stringify(out); } catch { return String(out); }
}
