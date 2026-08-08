// NEX Comms Centre · Social · UTM auto-append.
//
// Charter §S-XI (hardened): Social Engine auto-appends UTM parameters
// to every outbound link in a post (utm_source=social ·
// utm_medium=<platform> · utm_campaign=<post_id> · utm_content=<variant>).
// Merchant-supplied UTMs are preserved · we only add missing keys.
//
// URL detection uses a conservative regex (http/https · no whitespace).
// Anchor text / hashtag URLs are ignored.

const URL_RE = /\bhttps?:\/\/[^\s<>"]+/g;

export interface AppendUtmInput {
  caption:    string;
  platform:   string;
  post_id:    string;
  variant?:   string;
  campaign_override?: string;
}

export interface AppendUtmResult {
  caption: string;
  applied: Array<{ original: string; rewritten: string }>;
}

// Append UTM params to a single URL · non-destructive (existing keys
// are preserved).
export function appendUtmToUrl(url: string, params: Record<string, string>): string {
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  for (const [k, v] of Object.entries(params)) {
    if (!u.searchParams.has(k)) u.searchParams.set(k, v);
  }
  return u.toString();
}

export function appendUtmsToCaption(input: AppendUtmInput): AppendUtmResult {
  const params: Record<string, string> = {
    utm_source:   "social",
    utm_medium:   input.platform,
    utm_campaign: input.campaign_override ?? input.post_id,
  };
  if (input.variant) params.utm_content = input.variant;

  const applied: AppendUtmResult["applied"] = [];
  const caption = input.caption.replace(URL_RE, (raw) => {
    const rewritten = appendUtmToUrl(raw, params);
    if (rewritten !== raw) applied.push({ original: raw, rewritten });
    return rewritten;
  });
  return { caption, applied };
}
