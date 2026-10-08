// src/app/nex-native/directory/_routes.ts
//
// NEX Directory · Phase A · UI route patterns owned by the Directory
// surface itself.
//
// What this is
//   · The one authoritative place for Directory-owned Next.js route
//     patterns. Mirrors the Phase C discipline where NEX_BUSINESS and
//     NEX_USER_PROFILE route patterns live in destination-types.ts.
//   · Keeps the renderable UI files (_directory-card.tsx, page.tsx,
//     etc.) free of hard-coded /nex-native/ URL literals · they
//     import these constants / builders instead.
//
// What this is NOT
//   · Not a destination resolver. The Directory detail route is a
//     Phase A presentation concern · it is NOT a Phase C destination
//     kind (claim_available / place_detail do not carry paths · the
//     UI bridges them to the detail route from canonicalBusinessId).
//   · Not a URL fabricator. The id passed in must be a real
//     canonical_business_id from a Phase B view-model.
//
// Why detail-route-pattern is Phase A, not Phase C
//   · The sealed Phase C destination union says `claim_available` has
//     no path by design (the owner-claim UX does not exist and we
//     refuse to fabricate a URL to a nonexistent surface). The
//     Directory detail page is a Directory-side viewer for any
//     canonical row · it is a Phase A concern. Keeping this URL
//     here means Phase C stays sealed.

/** The verbatim Next.js dynamic route pattern for a Directory listing
 *  detail page. Matches `src/app/nex-native/directory/[id]/page.tsx`.
 *
 *  Pattern token: `{id}` · the canonical_business_id (UUID). */
export const DIRECTORY_DETAIL_ROUTE_PATTERN =
  "/nex-native/directory/{id}" as const;

/** Build the absolute Next.js route for a Directory listing detail page.
 *  Pure deterministic string substitution. The caller is responsible
 *  for passing a real canonical_business_id (UUID string) · this builder
 *  does not validate the shape of the id. */
export function buildDirectoryDetailPath(canonicalBusinessId: string): string {
  return DIRECTORY_DETAIL_ROUTE_PATTERN.replace(
    "{id}",
    canonicalBusinessId,
  );
}
