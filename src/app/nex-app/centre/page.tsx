// NEX Trade Centre — live customer-facing marketplace surface.
//
// Phase 7 · Increment 4C: replaces the demo Pinterest feed with the
// live-data NexCentreLiveFeed, which consumes GET /api/nex/centre/feed
// (real published products) with skeleton loading, infinite scroll,
// search, filters and a friendly empty-state fallback.
//
// SSR country resolution (Philip 2026-08-17 · "world-class fix"):
// This is a Server Component. It reads the same `nex_selected_country`
// cookie that the client writes via countryStore.setSelectedCountry, and
// the ?country=<code> URL param, and passes the resolved value down as
// `initialCountry`. The client component uses that as its `useState`
// seed — so SSR HTML and first client render agree exactly on which
// country/flag appears in the CountryPicker. No hydration mismatch, no
// post-mount flicker, no wasted initial fetch for country="all".
//
// Priority chain: URL ?country=<code> > cookie > "GB" fallback.

import { cookies } from "next/headers";
import { NexCentreLiveFeed } from "@/components/nex-app/centre/NexCentreLiveFeed";
import { findCountryByCode } from "@/lib/nex/geography/countries";
import type { SelectedCountry } from "@/lib/nex/geography/countryStore";

export const dynamic = "force-dynamic";

const COUNTRY_COOKIE = "nex_selected_country";

function resolveInitialCountry(
  urlCountry: string | undefined,
  cookieCountry: string | undefined,
): SelectedCountry {
  const candidates = [urlCountry, cookieCountry];
  for (const raw of candidates) {
    const v = raw?.trim();
    if (!v) continue;
    if (v === "all") return "all";
    const found = findCountryByCode(v);
    if (found) return found.code;
  }
  // Final fallback: never "all" — that filter path scans the full
  // multi-country dataset and is a memory bomb.
  return "GB";
}

export default async function NexCentrePage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const [{ country: urlCountry }, cookieStore] = await Promise.all([
    searchParams,
    cookies(),
  ]);
  const cookieCountry = cookieStore.get(COUNTRY_COOKIE)?.value;
  const initialCountry = resolveInitialCountry(urlCountry, cookieCountry);

  return <NexCentreLiveFeed initialCountry={initialCountry} />;
}
