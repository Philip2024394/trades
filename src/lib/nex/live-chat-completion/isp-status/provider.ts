// src/lib/nex/live-chat-completion/isp-status/provider.ts
//
// Founder ISP-1 · ISP outage awareness worker.
//
// Fetches ISP-outage-style signals from public feeds so NEX can tell
// a user "your provider is degraded right now — try switching to Wi-Fi."
//
// Data sources this phase (all public · no AI):
//   · Downdetector RSS feed (per-country per-provider status pages)
//   · Public ISP status pages (when a static status.json exists)
//
// This is a WORKER not a WebProvider — it doesn't feed the Research
// Brain evidence bundle. Instead it caches per-region status in-memory
// (5-minute TTL) so the chat route can annotate replies when relevant.
//
// Doctrine anchors:
//   #1 · status text is descriptive (not a factual claim about NEX's
//        domain) so no Gate v2 alignment concern
//   #3 · web-fetched status text capped at evidence_provisional if it
//        ever crosses into an EvidenceItem (currently doesn't)
//   #4 · doesn't touch memory
//
// Non-fatal at every layer · offline resilience preserved.

export interface IspStatusEntry {
  provider: string;              // "telkomsel" · "indihome" · "biznet" · etc.
  country: string;               // ISO-3166 (e.g. "ID")
  region?: string;               // subregion name if the feed exposes it
  status: "operational" | "degraded" | "outage" | "unknown";
  severity: "info" | "warning" | "critical";
  source_url?: string;
  reported_at?: string;          // ISO
  fetched_at: string;            // ISO
}

const _CACHE_TTL_MS = 5 * 60_000;
const _cache = new Map<string, { at: number; entries: IspStatusEntry[] }>();

function isEnabled(): boolean {
  const v = process.env.NEX_ISP_STATUS;
  return v === "1" || v === "true" || v === "on";
}

/**
 * Get ISP status for a country. Returns cached entries when fresh,
 * fetches otherwise. Never throws · always returns an array (possibly
 * empty).
 */
export async function getIspStatus(country: string): Promise<IspStatusEntry[]> {
  if (!isEnabled()) return [];
  const key = country.toUpperCase();
  const cached = _cache.get(key);
  const now = Date.now();
  if (cached && now - cached.at < _CACHE_TTL_MS) return cached.entries;

  // Best-effort fetch. Any failure returns [] and updates cache with
  // a stale-but-shipped entry so we don't hammer the feed on error.
  let entries: IspStatusEntry[] = [];
  try {
    entries = await fetchStatusForCountry(key);
  } catch { /* swallow */ }
  _cache.set(key, { at: now, entries });
  return entries;
}

async function fetchStatusForCountry(country: string): Promise<IspStatusEntry[]> {
  const results: IspStatusEntry[] = [];
  // Downdetector uses per-country domains and per-provider slugs.
  // For this phase we probe a curated set of well-known providers by
  // country. Adding a new provider = one line in COUNTRY_PROVIDERS.
  const providers = COUNTRY_PROVIDERS[country] ?? [];
  const now = new Date().toISOString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("isp_status_timeout", "AbortError")), 3_000);
  try {
    // Downdetector doesn't publish a free API · we probe the RSS feed of
    // the status page when available. If any feed fetch fails, we mark
    // status as "unknown" for that provider so callers see the honest gap.
    await Promise.all(providers.map(async (p) => {
      let status: IspStatusEntry["status"] = "unknown";
      let severity: IspStatusEntry["severity"] = "info";
      try {
        const res = await fetch(p.rss_url, {
          headers: { "User-Agent": "NEX-ISP-Status/1 (+https://thenetworkers.app)" },
          signal: controller.signal,
        });
        if (res.ok) {
          const body = await res.text();
          // Very light parse · if the feed contains an <item> pubDate in
          // the last hour, we call it "degraded" · else "operational".
          const hasRecent = /pubDate>\s*(.+?)\s*<\/pubDate>/.exec(body);
          if (hasRecent) {
            try {
              const at = new Date(hasRecent[1]);
              const ageMin = (Date.now() - at.getTime()) / 60_000;
              if (ageMin < 60) { status = "degraded"; severity = "warning"; }
              else if (ageMin < 240) { status = "degraded"; severity = "info"; }
              else { status = "operational"; severity = "info"; }
            } catch { /* keep unknown */ }
          } else {
            status = "operational";
          }
        }
      } catch { /* provider probe failed · leave unknown */ }
      results.push({
        provider: p.name,
        country,
        status,
        severity,
        source_url: p.status_page_url,
        fetched_at: now,
      });
    }));
  } finally {
    clearTimeout(timer);
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════
// Curated per-country provider registry
// ═══════════════════════════════════════════════════════════════════

interface ProviderEntry {
  name: string;
  rss_url: string;
  status_page_url: string;
}

const COUNTRY_PROVIDERS: Record<string, ProviderEntry[]> = {
  ID: [
    { name: "telkomsel", rss_url: "https://downdetector.co.id/status/telkomsel/rss/", status_page_url: "https://downdetector.co.id/status/telkomsel/" },
    { name: "indihome", rss_url: "https://downdetector.co.id/status/indihome/rss/", status_page_url: "https://downdetector.co.id/status/indihome/" },
    { name: "biznet", rss_url: "https://downdetector.co.id/status/biznet/rss/", status_page_url: "https://downdetector.co.id/status/biznet/" },
    { name: "xl-axiata", rss_url: "https://downdetector.co.id/status/xl-axiata/rss/", status_page_url: "https://downdetector.co.id/status/xl-axiata/" },
  ],
  GB: [
    { name: "bt", rss_url: "https://downdetector.co.uk/status/bt/rss/", status_page_url: "https://downdetector.co.uk/status/bt/" },
    { name: "sky", rss_url: "https://downdetector.co.uk/status/sky/rss/", status_page_url: "https://downdetector.co.uk/status/sky/" },
    { name: "virgin-media", rss_url: "https://downdetector.co.uk/status/virgin-media/rss/", status_page_url: "https://downdetector.co.uk/status/virgin-media/" },
    { name: "vodafone", rss_url: "https://downdetector.co.uk/status/vodafone/rss/", status_page_url: "https://downdetector.co.uk/status/vodafone/" },
  ],
  US: [
    { name: "comcast", rss_url: "https://downdetector.com/status/comcast-xfinity/rss/", status_page_url: "https://downdetector.com/status/comcast-xfinity/" },
    { name: "att", rss_url: "https://downdetector.com/status/att/rss/", status_page_url: "https://downdetector.com/status/att/" },
    { name: "verizon", rss_url: "https://downdetector.com/status/verizon/rss/", status_page_url: "https://downdetector.com/status/verizon/" },
    { name: "spectrum", rss_url: "https://downdetector.com/status/charter-spectrum/rss/", status_page_url: "https://downdetector.com/status/charter-spectrum/" },
  ],
};
