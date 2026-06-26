// Trade Off social icons row.
// Renders a horizontal strip of brand icons for each social field the tradie
// has populated. Skips any whose helper returns null (so an unset field never
// shows). Order is fixed: Instagram, Facebook, TikTok, YouTube, Website.
//
// Each icon is a 40x40 chip inside a 44x44 tap target (border padding).
// Hover swaps the border to brand-accent. SVGs are inline single-colour glyphs
// in the Simple-Icons style — no extra dependency, no remote fonts.

import {
  TRADE_SOCIAL_FIELDS,
  resolveSocialUrl,
  type TradeSocialKey
} from "@/lib/tradeOffSocial";
import type { HammerexTradeOffListing } from "@/lib/supabase";

type SocialListing = Pick<
  HammerexTradeOffListing,
  "instagram" | "facebook" | "tiktok" | "youtube" | "twitter" | "snapchat" | "reddit" | "google" | "website"
>;

function iconFor(key: TradeSocialKey) {
  switch (key) {
    case "instagram":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case "facebook":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.93a8.16 8.16 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1.84-.31Z" />
        </svg>
      );
    case "youtube":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6Z" />
        </svg>
      );
    case "twitter":
      // X glyph — Simple-Icons style
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    case "snapchat":
      // Simplified ghost outline
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a5.7 5.7 0 0 0-5.71 5.7c0 .56.03 1.36.06 1.83-.08.03-.24.07-.46.07-.65 0-1.24-.38-1.74-.38-.45 0-.86.2-.86.66 0 .94 1.78 1.06 2.43 2.36.13.27.15.49.04.83-.39 1.17-1.82 2.6-3.52 2.95-.46.1-.6.34-.6.62 0 .82 1.59 1.55 4.15 1.84.06.16.12.4.18.6.07.27.21.38.55.38.42 0 1.07-.18 2.15-.18 1.44 0 1.85.84 4.33.84 2.47 0 2.86-.84 4.32-.84 1.08 0 1.74.18 2.16.18.33 0 .47-.11.54-.38.06-.2.12-.44.18-.6 2.55-.29 4.14-1.02 4.14-1.84 0-.28-.14-.52-.6-.62-1.7-.35-3.13-1.78-3.52-2.95-.11-.34-.09-.56.04-.83.65-1.3 2.43-1.42 2.43-2.36 0-.46-.41-.66-.86-.66-.5 0-1.09.38-1.74.38-.21 0-.38-.04-.46-.07.04-.47.06-1.27.06-1.83A5.7 5.7 0 0 0 12 2Z" />
        </svg>
      );
    case "reddit":
      // Reddit alien glyph (simplified)
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2c.86 0 1.55.66 1.6 1.5l.5 4.07a8.8 8.8 0 0 1 4.34 1.28 2 2 0 1 1 1.95 3.13c.18.55.27 1.13.27 1.72 0 3.69-4 6.67-8.93 6.67S2.8 17.4 2.8 13.7c0-.6.09-1.17.27-1.72a2 2 0 1 1 1.96-3.13 8.8 8.8 0 0 1 4.66-1.32l.6-2.95C10.42 4.06 11.12 3.5 12 3.5a1.7 1.7 0 0 1 1.66 1.34.7.7 0 0 0 .7-.7.7.7 0 0 0 1.4 0c0-1.16-.94-2.1-2.1-2.1Z" />
        </svg>
      );
    case "google":
      // Multi-stroke G (one path — single colour)
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.08 1.18-2.76 2.46-5.71 2.46-4.55 0-8.11-3.66-8.11-8.21S8.32 4.34 12.87 4.34c2.46 0 4.25.97 5.57 2.21l2.3-2.3C18.84 2.55 16.35 1.5 12.87 1.5 6.74 1.5 1.59 6.49 1.59 12.62s5.15 11.12 11.28 11.12c3.31 0 5.81-1.08 7.76-3.11 2.01-2.01 2.64-4.84 2.64-7.13 0-.71-.06-1.36-.16-1.99H12.48z" />
        </svg>
      );
    case "website":
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
        </svg>
      );
  }
}

/** Per-platform brand colour. Mapped to the chip background when the
 *  caller wants coloured chips (used in the premium footer bar). */
function brandColorFor(key: TradeSocialKey): string {
  switch (key) {
    case "instagram": return "#E1306C";
    case "facebook":  return "#1877F2";
    case "tiktok":    return "#0A0A0A";
    case "youtube":   return "#FF0000";
    case "twitter":   return "#0A0A0A";
    case "snapchat":  return "#FFFC00";
    case "reddit":    return "#FF4500";
    case "google":    return "#4285F4";
    case "website":   return "#FFB300";
  }
}

export function TradeSocialIcons({
  listing,
  variant = "outline"
}: {
  listing: SocialListing;
  /** "outline" (default) — bordered chip on neutral surface, used in
   *  legacy contact panels.
   *  "coloured" — round filled chips in brand colours, used in the
   *  premium footer social row. */
  variant?: "outline" | "coloured";
}) {
  const items = TRADE_SOCIAL_FIELDS.map((f) => {
    const raw = (listing as Record<string, string | null | undefined>)[f.key];
    const url = resolveSocialUrl(f.key, raw);
    return url ? { key: f.key, label: f.label, url } : null;
  }).filter((x): x is { key: TradeSocialKey; label: string; url: string } => x !== null);

  if (items.length === 0) return null;

  if (variant === "coloured") {
    return (
      <ul className="flex flex-wrap items-center justify-center gap-2.5" aria-label="Social media">
        {items.map((it) => {
          const isLightChip = it.key === "snapchat";
          const colour = brandColorFor(it.key);
          return (
            <li key={it.key}>
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer me"
                aria-label={it.label}
                title={it.label}
                className="grid h-10 w-10 place-items-center rounded-full shadow-md transition hover:scale-110 active:scale-95 sm:h-11 sm:w-11"
                style={{
                  background: colour,
                  color: isLightChip ? "#0A0A0A" : "#FFFFFF"
                }}
              >
                {iconFor(it.key)}
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Social media">
      {items.map((it) => (
        <li key={it.key}>
          <a
            href={it.url}
            target="_blank"
            rel="noopener noreferrer me"
            aria-label={it.label}
            title={it.label}
            className="grid h-11 w-11 place-items-center rounded-full border border-brand-line bg-brand-surface text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
          >
            {iconFor(it.key)}
          </a>
        </li>
      ))}
    </ul>
  );
}
