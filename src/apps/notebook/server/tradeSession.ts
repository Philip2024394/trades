// Server-side trade session helper for the Notebook app.
//
// Until the Trade Center trade auth flow lands (separate initiative
// tracked under Wave 3), we run every notebook request under a stable
// demo trade UUID keyed off `currentViewerTrade()`. That lets the DB
// and API operate as real Supabase persistence today, with a clean
// swap-in path once trade sign-in is wired.

import "server-only";
import { cookies } from "next/headers";
import { currentViewerTrade } from "@/apps/identity/data/tradeIdentities";
import { getCurrentTrade } from "@/lib/tradeAuth";

/** UUID v5 namespace for demo trade UUIDs. Deterministic per slug. */
const DEMO_TRADE_NAMESPACE = "b7c9f4e2-8f1c-4b8f-9e2d-5a6b7c8d9e0f";

/** Deterministic demo UUID from a trade slug — same slug → same UUID. */
function demoTradeUuid(slug: string): string {
  // Deterministic 16-byte digest → RFC-4122 v5-shaped UUID string.
  // Uses a tiny hash so we don't take a crypto dep just for demo mode.
  let hash = 0;
  const seed = DEMO_TRADE_NAMESPACE + ":" + slug;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  // Expand to 32 hex chars by chaining the hash
  let hex = "";
  let h = hash;
  for (let i = 0; i < 4; i++) {
    hex += h.toString(16).padStart(8, "0");
    h = ((h ^ 0x9e3779b9) * 2654435761) >>> 0;
  }
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "5" + hex.slice(13, 16),               // version 5
    ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, "0") + hex.slice(18, 20),
    hex.slice(20, 32)
  ].join("-");
}

export type TradeSession = {
  tradeId: string;      // Supabase auth.uid() — demo UUID for now
  tradeSlug: string;
  displayName: string;
};

/**
 * Returns the current trade's session. In fixture-mode, returns a
 * deterministic demo UUID derived from the fixture viewer.
 *
 * TODO(auth): swap to reading `supabase.auth.getUser()` on the server
 * once trade sign-in ships.
 */
export async function getTradeSession(): Promise<TradeSession> {
  // Preferred path: real Supabase auth session.
  const real = await getCurrentTrade();
  if (real) {
    return {
      tradeId: real.id,
      tradeSlug: real.tradeDiscipline ?? real.email ?? real.phoneE164 ?? real.id,
      displayName: real.displayName
    };
  }

  // Fallback: fixture viewer for anonymous / demo previews. The
  // [DEV BUTTON] pass buttons and unauthenticated dev browsing hit
  // this path. Remove or gate off once auth is mandatory in prod.
  const cookieStore = await cookies();
  const override = cookieStore.get("tc-demo-trade-slug")?.value;
  const viewer = currentViewerTrade();
  const slug = override ?? viewer.slug ?? "demo-trade";
  return {
    tradeId: demoTradeUuid(slug),
    tradeSlug: slug,
    displayName: viewer.displayName ?? "Demo Trade"
  };
}
