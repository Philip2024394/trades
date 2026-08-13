// Shared failure-categorisation logic for the URL queue.
//
// Single source of truth used by:
//   · scripts/nex-brain/categorise-failed-url-queue.mjs (via a mirror of these
//     patterns — the script stays .mjs so it can be run without a build step;
//     any pattern change here should be mirrored there.)
//   · queueFailureCategories() in urlQueueDb.ts (server-side aggregate)
//   · admin queue page (renders the aggregate for the operator)
//
// Categories (Philip 2026-08-14):
//   dns                  domain does not resolve (dead / fabricated / typo)
//   connection           TCP refused / reset — host reachable but nothing listening
//   timeout              fetch aborted before response
//   ssl                  certificate expired / invalid / hostname mismatch
//   http_403             reachable but bot-blocked / access denied
//   http_404             reachable but page dead / URL wrong
//   http_5xx             reachable but server errored (transient · retryable)
//   http_other           other 4xx (401 · 429 · 410 · …)
//   not_html             PDF / image / redirect-to-app · not extractable
//   extraction           fetch succeeded but no signals · needs review
//   transient_or_blocked domain resolves · bare "fetch failed" — undetermined
//   other                unclassified · needs manual look

export type FailureCategory =
  | "dns"
  | "connection"
  | "timeout"
  | "ssl"
  | "http_403"
  | "http_404"
  | "http_5xx"
  | "http_other"
  | "not_html"
  | "extraction"
  | "transient_or_blocked"
  | "other";

/** Categorise a failed URL-queue row from its `last_error` text plus (optional)
 *  structured linked-error category from nex_collection_fetch_errors.
 *
 *  The linked structured category is preferred where it's specific (dns/timeout
 *  /ssl/not_html/extraction/connection_refused); for "http_error" and "other"
 *  we fall through to text parsing so we can split by HTTP status and split
 *  the noisy "other" bucket further.
 */
export function categoriseFailure(input: {
  last_error?: string | null;
  linked_category?: string | null;
}): { category: FailureCategory; source: string } {
  if (input.linked_category) {
    switch (input.linked_category) {
      case "dns_error":         return { category: "dns",        source: "linked_structured" };
      case "connection_refused":return { category: "connection", source: "linked_structured" };
      case "timeout":           return { category: "timeout",    source: "linked_structured" };
      case "ssl_error":         return { category: "ssl",        source: "linked_structured" };
      case "not_html":          return { category: "not_html",   source: "linked_structured" };
      case "extraction_failed": return { category: "extraction", source: "linked_structured" };
      // http_error and "other" fall through — need more detail from text
      case "http_error":
      case "other":
      default:
        break;
    }
  }

  const err = String(input.last_error ?? "").toLowerCase();
  if (!err) return { category: "other", source: "empty_error" };

  if (/enotfound|eai_again|getaddrinfo|no dns lookup|dns[- _]?fail|dns[- _]?error|host not found/i.test(err))
    return { category: "dns", source: "text_pattern" };
  if (/econnrefused|econnreset|eaddrnotavail|connection refused|connection reset|network is unreachable/i.test(err))
    return { category: "connection", source: "text_pattern" };
  if (/etimedout|aborterror|timeout|signal aborted|the operation was aborted|deadline exceeded|connect timeout error|und_err_connect_timeout|und_err_headers_timeout|und_err_body_timeout/i.test(err))
    return { category: "timeout", source: "text_pattern" };
  if (/cert_has_expired|self[- _]?signed|unable to verify|err_ssl|err_tls|hostname[- _]?mismatch|epki|handshake failed/i.test(err))
    return { category: "ssl", source: "text_pattern" };

  const status = err.match(/\b(?:http[- ]?)?(\d{3})\b/);
  if (status) {
    const code = Number(status[1]);
    if (code === 403) return { category: "http_403", source: "text_pattern" };
    if (code === 404) return { category: "http_404", source: "text_pattern" };
    if (code >= 500 && code < 600) return { category: "http_5xx", source: "text_pattern" };
    if (code >= 400 && code < 500) return { category: "http_other", source: "text_pattern" };
  }
  if (/forbidden|blocked|access denied|cloudflare[- _]?challenge/i.test(err))
    return { category: "http_403", source: "text_pattern" };
  if (/not found|page not found|does not exist/i.test(err))
    return { category: "http_404", source: "text_pattern" };
  if (/not[- _]?html|text\/html|expected html|got application\//i.test(err))
    return { category: "not_html", source: "text_pattern" };
  if (/no signals|extraction failed|no evidence|nothing extracted/i.test(err))
    return { category: "extraction", source: "text_pattern" };

  // Bare "fetch failed" with no cause chain — usually DNS, sometimes transient.
  // Called "transient_or_blocked" (not "other") so the admin knows it's a
  // captured-before-cause-unwrap-was-added case rather than a categoriser gap.
  if (/^(?:other:\s*)?fetch failed\s*$/i.test(err.trim()))
    return { category: "transient_or_blocked", source: "bare_fetch_failed" };

  return { category: "other", source: "unmatched" };
}

/** Deterministic display order for the dashboard categorised breakdown. */
export const FAILURE_CATEGORY_DISPLAY_ORDER: FailureCategory[] = [
  "dns",
  "http_403",
  "http_404",
  "http_5xx",
  "http_other",
  "timeout",
  "connection",
  "ssl",
  "not_html",
  "extraction",
  "transient_or_blocked",
  "other",
];

/** Human-readable label for each category — used in the dashboard pill. */
export const FAILURE_CATEGORY_LABEL: Record<FailureCategory, string> = {
  dns:                  "DNS · dead domain",
  http_403:             "HTTP 403 · bot-blocked",
  http_404:             "HTTP 404 · page dead",
  http_5xx:             "HTTP 5xx · server error",
  http_other:           "HTTP 4xx · other",
  timeout:              "Timeout",
  connection:           "Connection refused",
  ssl:                  "SSL / cert",
  not_html:             "Not HTML",
  extraction:           "Extraction failed",
  transient_or_blocked: "Transient (resolves, no cause)",
  other:                "Other · unclassified",
};

/** Suggested action per category — what the operator should do with rows here.
 *  Read by the admin dashboard as a small hint under each pill. */
export const FAILURE_CATEGORY_ACTION: Record<FailureCategory, string> = {
  dns:                  "discard from active queue · keep audit",
  http_403:             "manual review · real site behind WAF",
  http_404:             "manual review · URL likely wrong",
  http_5xx:             "retry once · likely transient",
  http_other:           "manual review · check status code",
  timeout:              "retry once · slow server",
  connection:           "manual review",
  ssl:                  "manual review · their cert issue",
  not_html:             "discard · wrong content type",
  extraction:           "review · site loaded, no signals",
  transient_or_blocked: "manual review · re-verify DNS",
  other:                "manual look · pattern unknown",
};
