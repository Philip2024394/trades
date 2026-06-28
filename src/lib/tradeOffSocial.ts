// Trade Off social media helpers — used by the public profile page,
// the signup/edit form, and the create/update APIs.
// Each helper turns whatever the tradie typed (handle, partial URL, full URL)
// into a canonical URL. Empty / invalid input returns null.

export type TradeSocialKey =
  | "instagram"
  | "tiktok"
  | "facebook"
  | "twitter"
  | "snapchat"
  | "reddit"
  | "youtube"
  | "google"
  | "website";

export const TRADE_SOCIAL_FIELDS: Array<{
  key: TradeSocialKey;
  label: string;
  placeholder: string;
  example: string;
  /** Brand colour used as the chip background next to each input on
   *  the signup / edit form. White text on these reads cleanest; for
   *  Snapchat (yellow) we use near-black text via `chipText`. */
  chipColor: string;
  chipText?: string;
}> = [
  { key: "instagram", label: "Instagram", placeholder: "@yourname or instagram.com/yourname", example: "@mikeplastering", chipColor: "#E1306C" },
  { key: "tiktok", label: "TikTok", placeholder: "@yourname or tiktok.com/@yourname", example: "@mikeplastering", chipColor: "#000000" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/yourpage", example: "facebook.com/mikeplastering", chipColor: "#1877F2" },
  { key: "twitter", label: "X (Twitter)", placeholder: "@yourname or x.com/yourname", example: "@mikeplastering", chipColor: "#000000" },
  { key: "snapchat", label: "Snapchat", placeholder: "@yourname or snapchat.com/add/yourname", example: "@mikeplastering", chipColor: "#FFFC00", chipText: "#0A0A0A" },
  { key: "reddit", label: "Reddit", placeholder: "u/yourname or reddit.com/user/yourname", example: "u/mikeplastering", chipColor: "#FF4500" },
  { key: "youtube", label: "YouTube", placeholder: "channel URL or @handle", example: "@mikeplastering", chipColor: "#FF0000" },
  { key: "google", label: "Google Business", placeholder: "Google Business Profile URL", example: "g.co/kgs/yourname", chipColor: "#4285F4" },
  { key: "website", label: "Website", placeholder: "yourwebsite.com", example: "mikeplastering.co.uk", chipColor: "#525252" }
];

function clean(input: string | null | undefined): string {
  return (input ?? "").trim();
}

function ensureHttps(input: string): string {
  if (/^https?:\/\//i.test(input)) return input;
  return `https://${input}`;
}

export function instagramUrl(input: string | null | undefined): string | null {
  const v = clean(input);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/^instagram\.com\//i, "");
  if (!handle) return null;
  return `https://instagram.com/${handle}`;
}

export function facebookUrl(input: string | null | undefined): string | null {
  const v = clean(input);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^facebook\.com\//i.test(v)) return `https://${v}`;
  const handle = v.replace(/^@/, "");
  return `https://facebook.com/${handle}`;
}

export function tiktokUrl(input: string | null | undefined): string | null {
  const v = clean(input);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^tiktok\.com\//i.test(v)) return `https://${v}`;
  const handle = v.replace(/^@/, "");
  if (!handle) return null;
  return `https://tiktok.com/@${handle}`;
}

export function youtubeUrl(input: string | null | undefined): string | null {
  const v = clean(input);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^youtube\.com\//i.test(v) || /^youtu\.be\//i.test(v)) return `https://${v}`;
  if (v.startsWith("@")) return `https://youtube.com/${v}`;
  return `https://youtube.com/@${v}`;
}

export function twitterUrl(input: string | null | undefined): string | null {
  const v = clean(input);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(x\.com|twitter\.com)\//i.test(v)) return `https://${v}`;
  const handle = v.replace(/^@/, "");
  if (!handle) return null;
  return `https://x.com/${handle}`;
}

export function snapchatUrl(input: string | null | undefined): string | null {
  const v = clean(input);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^snapchat\.com\//i.test(v)) return `https://${v}`;
  const handle = v.replace(/^@/, "");
  if (!handle) return null;
  return `https://snapchat.com/add/${handle}`;
}

export function redditUrl(input: string | null | undefined): string | null {
  const v = clean(input);
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^reddit\.com\//i.test(v)) return `https://${v}`;
  const handle = v.replace(/^u\//i, "").replace(/^\//, "");
  if (!handle) return null;
  return `https://reddit.com/user/${handle}`;
}

export function googleUrl(input: string | null | undefined): string | null {
  const v = clean(input);
  if (!v) return null;
  return ensureHttps(v);
}

export function websiteUrl(input: string | null | undefined): string | null {
  const v = clean(input);
  if (!v) return null;
  return ensureHttps(v);
}

export function resolveSocialUrl(key: TradeSocialKey, input: string | null | undefined): string | null {
  switch (key) {
    case "instagram": return instagramUrl(input);
    case "tiktok":    return tiktokUrl(input);
    case "facebook":  return facebookUrl(input);
    case "twitter":   return twitterUrl(input);
    case "snapchat":  return snapchatUrl(input);
    case "reddit":    return redditUrl(input);
    case "youtube":   return youtubeUrl(input);
    case "google":    return googleUrl(input);
    case "website":   return websiteUrl(input);
  }
}
