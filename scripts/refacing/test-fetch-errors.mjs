// scripts/refacing/test-fetch-errors.mjs
//
// Prove the new error-cause unwrapping categorises real DNS / connect / SSL
// failures correctly instead of falling to "other". Mirrors the production
// fetcher logic exactly.

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 15_000;

async function fetchOne(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", "accept-language": "en-GB,en;q=0.9" },
      redirect: "follow", signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error_category: "http_error", error_message: `HTTP ${res.status} ${res.statusText}` };
    return { ok: true };
  } catch (err) {
    clearTimeout(timer);
    const chain = [];
    let cur = err;
    while (cur && chain.length < 5) {
      chain.push({ code: cur.code, message: cur.message ?? String(cur) });
      cur = cur.cause;
    }
    const combined = chain.map((c) => `${c.code ?? ""} ${c.message}`).join(" | ");
    const codes    = chain.map((c) => c.code).filter(Boolean);
    const displayMsg = chain.length > 1 && chain[0].message !== chain[chain.length - 1].message
      ? `${chain[0].message} · caused by: ${chain[chain.length - 1].message}`
      : chain[0].message;

    if (/aborted|AbortError/i.test(combined))                                        return { ok: false, error_category: "timeout", error_message: displayMsg };
    if (codes.includes("ECONNREFUSED") || /ECONNREFUSED/i.test(combined))            return { ok: false, error_category: "connection_refused", error_message: displayMsg };
    if (codes.includes("ENOTFOUND") || codes.includes("EAI_AGAIN") ||
        /ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(combined))                            return { ok: false, error_category: "dns_error", error_message: displayMsg };
    if (codes.some((c) => /CERT|TLS|SIGNATURE/.test(c)) ||
        /certificate|SSL|TLS|cert has expired/i.test(combined))                       return { ok: false, error_category: "ssl_error", error_message: displayMsg };
    return { ok: false, error_category: "other", error_message: displayMsg };
  }
}

const testUrls = [
  "https://staircase-refurbishers.co.uk/",
  "https://staircase-refurbisher.co.uk/",
  "https://stairrefurbishers.co.uk/",
  "https://stairrenovators.co.uk/",
  "https://stairconstruction.co.uk/",
  "https://staircaseconstruction.co.uk/",
  "https://this-domain-definitely-does-not-exist-abc123.co.uk/",
  "https://www.google.com/",  // control · should succeed
];

console.log("Testing error-cause unwrapping against previously-failed URLs");
console.log("=".repeat(70));
for (const url of testUrls) {
  const r = await fetchOne(url);
  const cat = r.ok ? "OK" : r.error_category;
  const msg = r.ok ? "" : r.error_message;
  console.log(`  [${cat.padEnd(20)}] ${url}`);
  if (!r.ok) console.log(`      ${msg}`);
}
console.log("=".repeat(70));
