// Favourites — cross-area bookmarks.
//
// Users save products, merchants, trades, and job postings into their
// Favourites. Different from Notebook (working supply list — real
// purchasing intent) and different from Follow (feed subscription).
// Favourites = "I want to remember this."
//
// LocalStorage-backed for the demo; production upgrades to Supabase.

export type FavouriteKind = "product" | "merchant" | "trade" | "job-posting";

export type Favourite = {
  id: string;
  kind: FavouriteKind;
  targetSlug: string;
  addedAtIso: string;
  note?: string;
};

export const FAVOURITES_KEY = "tc.favourites";

export function loadFavourites(): Favourite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVOURITES_KEY);
    return raw ? (JSON.parse(raw) as Favourite[]) : [];
  } catch {
    return [];
  }
}

export function saveFavourites(list: Favourite[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(list));
}

export function isFavourite(kind: FavouriteKind, targetSlug: string): boolean {
  return loadFavourites().some((f) => f.kind === kind && f.targetSlug === targetSlug);
}

export function toggleFavourite(kind: FavouriteKind, targetSlug: string): boolean {
  const list = loadFavourites();
  const exists = list.some((f) => f.kind === kind && f.targetSlug === targetSlug);
  if (exists) {
    saveFavourites(list.filter((f) => !(f.kind === kind && f.targetSlug === targetSlug)));
    return false;
  } else {
    const next: Favourite = {
      id: `f-${Date.now()}`,
      kind,
      targetSlug,
      addedAtIso: new Date().toISOString()
    };
    saveFavourites([...list, next]);
    return true;
  }
}

// ─── Demo seed favourites so the page has content on first visit ────

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

export const DEMO_SEED_FAVOURITES: Favourite[] = [
  { id: "s1", kind: "product",       targetSlug: "marshalltown-finishing-trowel-14", addedAtIso: iso(2) },
  { id: "s2", kind: "product",       targetSlug: "ox-plastering-hawk-13",             addedAtIso: iso(5) },
  { id: "s3", kind: "merchant",      targetSlug: "manchester-tools-direct",           addedAtIso: iso(9), note: "Same-day dispatch — reliable" },
  { id: "s4", kind: "merchant",      targetSlug: "leeds-builders-supplies",           addedAtIso: iso(21), note: "Best bulk pricing for Multi-Finish" },
  { id: "s5", kind: "trade",         targetSlug: "riverside-electrics",               addedAtIso: iso(15) },
  { id: "s6", kind: "job-posting",   targetSlug: "external-render-victorian-terrace-m21", addedAtIso: iso(1) }
];

/**
 * Merge demo seed + user favourites. Returns the union with seeds
 * appearing first (so first-time visitors see something).
 */
export function loadWithSeed(): Favourite[] {
  const user = loadFavourites();
  const userKeys = new Set(user.map((f) => `${f.kind}:${f.targetSlug}`));
  const seeds = DEMO_SEED_FAVOURITES.filter(
    (s) => !userKeys.has(`${s.kind}:${s.targetSlug}`)
  );
  return [...user, ...seeds].sort(
    (a, b) => new Date(b.addedAtIso).getTime() - new Date(a.addedAtIso).getTime()
  );
}
