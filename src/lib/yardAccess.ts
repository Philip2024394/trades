// The Yard access rules. Centralised so the API + future composer page
// + dashboard nudges all agree on the same predicate.
//
// Builder-grade trades — main contractors and merchants — get free
// Yard access regardless of paid status. The marketplace-side argument:
// they are the BUYERS (hiring sub-contractors, sourcing materials),
// so abundant supply of them in the feed makes the marketplace dense
// faster, which in turn makes paid membership more valuable for trades
// who pay.

export const BUILDER_GRADE_TRADES: ReadonlySet<string> = new Set([
  "general-builder",
  "building-merchant",
  "builders-supplies"
]);

export function isBuilderGradeTrade(
  slug: string | null | undefined
): boolean {
  if (!slug) return false;
  return BUILDER_GRADE_TRADES.has(slug);
}
