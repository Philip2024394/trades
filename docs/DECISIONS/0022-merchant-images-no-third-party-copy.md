# ADR-0022: Merchant images — no third-party copy on import

Status: Accepted
Date: 2026-07-27

## Context

As NEX imports UK business listings at scale (free tier seeded from public directories, then upgraded when merchants claim their profile), there is technical capacity to auto-pull imagery from Google Business Profile, Facebook, Instagram and other third-party sources. That would give every free listing an instant hero photo, product gallery and logo — visually filling the platform on day one.

The problem is threefold:

1. **Legal.** Photos on Google Business, Facebook, Instagram etc. are copyrighted works. The platform hosting them (Google, Meta) has a licence from the uploader, but that licence does not transfer to us. Copying and rehosting is infringement even when the underlying image is publicly visible. The scale multiplies the risk — thousands of merchants × dozens of images each = tens of thousands of infringement counts if challenged.

2. **Maintenance.** Third-party imagery goes stale (business rebrands, image is deleted, URL rots). If NEX rehosts, we own that staleness forever. If we hotlink, we break the moment the source pulls the file. Either way we're maintaining someone else's inventory.

3. **Merchant incentive.** If NEX pre-fills a listing with the merchant's own imagery, the merchant loses a reason to claim their profile. Empty gallery = motivating gap. Full gallery = "why bother, it's already good enough." Claiming rate is a growth-critical metric — everything downstream (Verified upgrade, subscription, product uploads, membership) starts with a claim.

## Decision

**Free listing (unclaimed):** import only publicly-available business text data. Never copy images.

Allowed to import:
- Business name
- Address
- Phone
- Website URL
- Category
- Service area
- Opening hours (optional)
- Map location (lat/lng)

Not allowed to import:
- Logo
- Cover photo
- Gallery photos
- Product photos
- Video
- Any user-uploaded media from any third-party platform

**Claimed listing:** only merchant-provided or merchant-authorised media is displayed. The merchant can:
- Upload their own logo
- Upload their own gallery
- Upload project photos
- Upload products
- Upload videos
- Use NEX to generate banners and marketing images

**Linking is fine.** NEX may link to a merchant's official website or Google Business Profile from a listing card. Linking is not copying — the third-party content stays hosted at the source and the user's browser fetches it there.

**No exceptions.** No "scrape and cache", no "we'll only show it as an avatar so it's small", no "public URL therefore fair game". Every image on a NEX listing must be either (a) merchant-uploaded, (b) merchant-explicitly-authorised, or (c) a NEX-owned placeholder / generated asset.

## Consequences

**Positive:**
- Legally cleaner across UK/IE/AU/US copyright regimes — no infringement surface.
- Zero maintenance cost on third-party rot (dead Facebook pages, deleted Google photos, rebranded logos).
- Free listings look intentionally sparse — a strong "claim to complete" call to action for the merchant.
- Claim rate rises because the claim adds visible value (their listing goes from text-only to visual overnight).
- No takedown queue — nothing to take down.
- Reputation intact when the platform inevitably gets legal attention as it scales.

**Negative:**
- Free-tier listings look plain compared to competitors who scrape. We defend that as a claim incentive.
- Category browse experience for unclaimed listings is visually thinner. Mitigated by category-level placeholder art (NEX-owned) and by prioritising claimed listings in ranking.
- Marketing screenshots taken from the free-tier grid are less impressive. Use claimed-tier grids for marketing.

**Neutral:**
- Some merchants will ask "why is my listing so plain?" That's the exact moment we want — the answer is "claim it and add your photos." Convert the question into a signup.

## Enforcement

- The importer (Google Places, OS AddressBase, Companies House feeds, any future third-party feed) MUST NOT read or store image URLs from the source, even into a `deferred_images` staging table.
- Any future integration proposal that involves copying imagery from a platform we don't own must cite this ADR and be rejected at review.
- CI check: the importer contract in `src/lib/importers/**` must not import from any HTTP client that fetches image binaries during the free-tier hydration path.
- Merchant claim flow must display an upload prompt as the first action after claim confirmation — not buried in a settings tab.

## Alternatives considered

- **Scrape and cache to Supabase Storage** — rejected on legal grounds. The cached copy is the infringement.
- **Hotlink at render time** — rejected. Same copyright issue plus the link rot maintenance burden falls on us in support tickets.
- **Copy only "public business" photos, not user-uploaded ones** — rejected. There is no clean way to distinguish these programmatically, and the underlying copyright question is the same regardless.
- **Copy under a "we'll take down on request" policy** — rejected. Notice-and-takedown protects certain hosting patterns but does not authorise proactive copying at scale, and the ops overhead of running a takedown queue is real.
- **Ask the source platform for an API licence** — deferred. If Google Places or Meta ever offer a redistribution licence in a form we're willing to accept, we revisit. Until then, this ADR holds.

## Related

- ADR-0007 (No editorial image rules) — governs images the merchant DOES upload. Complementary, not conflicting.
- ADR-0021 (Intelligence domain separation) — images imported from third parties would sit in a domain we don't own; this ADR keeps that domain out of NEX entirely.
