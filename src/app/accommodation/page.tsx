// /accommodation
//
// Task #89 Phase B (2026-08-22) · broad accommodation landing.
// Shows every category (hotel · guesthouse · kos · hostel · etc.) at once.
// Philip 2026-08-22: "for someone who genuinely says 'Show me accommodation.'"
//
// Route is the destination for genuine broad intent · not a mandatory landing
// (Focused Category Directory doctrine: "Find me a hotel" goes DIRECTLY to
// /hotel, never through /accommodation).

import { loadAccommodationListings, countAccommodationDiscovered } from "@/lib/nex-accommodation/list-businesses";
import { computeSmartDiscoverySignals, pickDemonstrationSet } from "@/lib/nex-accommodation/smart-discovery-signals";
import { NexDirectoryFeed } from "@/components/nex-directory/NexDirectoryFeed";
import type { DiscoveryCardData } from "@/components/nex-directory/NexDiscoveryCard";
import { getCategory } from "@/lib/nex/category-registry";
import { normalizeDirectoryCountry } from "@/lib/nex/directoryCountry";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Accommodation · Yogyakarta" };

const OSM_ATTRIBUTION = "Data © OpenStreetMap contributors, ODbL 1.0 · https://openstreetmap.org/copyright";

// Country Foundation Step 5 (2026-08-22) · `?country=XX` filters visible inventory to that market.
//
// PART A (2026-08-24) · pagination · removes the prior invisible 500-place
// ceiling. Default cap raised to DEFAULT_PUBLIC_LIMIT (1500) so all 881
// Yogyakarta rows fit in one query · offset supported via ?page=N (page-1)*limit.
export default async function AccommodationPage({ searchParams }: { searchParams?: Promise<{ country?: string; page?: string }> }) {
  const sp = (await searchParams) ?? {};
  const country = normalizeDirectoryCountry(sp.country);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * 1500;
  const [listings, counts] = await Promise.all([
    loadAccommodationListings({ city: "Yogyakarta", country, offset }),   // no category filter · broad
    countAccommodationDiscovered({ city: "Yogyakarta", country }),
  ]);
  const meta = getCategory("accommodation");

  // Smart Discovery prototype (2026-08-24) · compute real nearby signals for
  // accommodations with coordinates · pick 3-5 diverse demonstration cards ·
  // wrapped card flips ONCE per session while the rest of the grid is
  // untouched. Every signal is real DB evidence · one motorbike-rental slot
  // is clearly marked isDemo=true.
  const coordAccs = listings.filter((l) => l.coordinatesLat != null && l.coordinatesLng != null);
  const signals = await computeSmartDiscoverySignals(coordAccs.map((l) => ({
    publicListingRef: l.publicListingRef,
    coordinatesLat: l.coordinatesLat as number,
    coordinatesLng: l.coordinatesLng as number,
  })));
  // Include a clearly-marked motorbike-rental demo slot targeting an
  // accommodation that has no other signal (never overrides a real signal).
  const motorbikeTargetRef = coordAccs.find((l) => !signals.has(l.publicListingRef))?.publicListingRef;
  const demoPicks = pickDemonstrationSet(signals, {
    max: 5,
    includeMotorbikeDemo: true,
    motorbikeDemoRef: motorbikeTargetRef,
  });
  const smartDiscovery = Object.fromEntries(demoPicks.map((p) => [p.publicListingRef, p.signal]));

  // PART C (2026-08-24) · Contextual discovery cards. Live = has real NEX
  // data behind it. Future = architecture only, honest "coming soon" state.
  // Food count taken from actual DB query below to avoid fabrication.
  const discoveryCards: DiscoveryCardData[] = [
    {
      id: "food-nearby",
      emoji: "🍜",
      eyebrow: "Useful around your stay",
      title: "Discover local food",
      body: "Warungs, cafes and restaurants near Yogyakarta accommodations. Every listing has public evidence.",
      href: "/food",
      cta: "Explore local food →",
      state: "live",
    },
    {
      id: "local-transport",
      emoji: "🏍",
      eyebrow: "Coming soon",
      title: "Local rental & transport",
      body: "Motorbike rental, car hire, airport transfer. NEX is building its local driver network before opening this.",
      state: "future",
    },
    {
      id: "local-services",
      emoji: "🧺",
      eyebrow: "Coming soon",
      title: "Local services",
      body: "Laundry, cleaning, spa and other services in walking distance. Awaiting NEX service-vertical discovery.",
      state: "future",
    },
    {
      id: "local-delivery",
      emoji: "🛵",
      eyebrow: "Coming soon",
      title: "Local delivery",
      body: "Order from a local shop, get it on a bike. Requires the Local Delivery Contract (5 allocated drivers · NEX-set minimum tariff).",
      state: "future",
    },
  ];

  return (
    <NexDirectoryFeed
      categoryId={meta?.id ?? "accommodation"}
      categoryLabel={meta?.displayName.en ?? "Accommodation"}
      categoryIcon={meta?.icon ?? "🏨"}
      city="Yogyakarta"
      listings={listings.map((l) => ({
        publicListingRef: l.publicListingRef,
        businessName:     l.businessName,
        category:         l.category,
        categories:       l.categories,
        city:             l.city,
        district:         l.district,
        address:          l.address,
        phone:            l.phone,
        whatsappNumber:   l.whatsappNumber,
        website:          l.website,
        heroImageUrl:     l.heroImageUrl,
        rating:           l.rating,
        reviewCount:      l.reviewCount,
        categoryBadges:   l.starRating ? [{ label: `${l.starRating}★`, tone: "orange" }] : undefined,
        // PART B (2026-08-24) · detail payload for the Details slider.
        detail: {
          publicListingRef:  l.publicListingRef,
          businessName:      l.businessName,
          category:          l.category,
          categories:        l.categories,
          city:              l.city,
          district:          l.district,
          address:           l.address,
          coordinatesLat:    l.coordinatesLat,
          coordinatesLng:    l.coordinatesLng,
          phone:             l.phone,
          whatsappNumber:    l.whatsappNumber,
          website:           l.website,
          starRating:        l.starRating,
          roomCount:         l.roomCount,
          amenities:         l.amenities,
          heroImageUrl:      l.heroImageUrl,
          rating:            l.rating,
          reviewCount:       l.reviewCount,
          recoveredEvidence: l.recoveredEvidence,
        },
      }))}
      emptyState={{
        totalDiscovered: counts.discovered,
        totalUniverse:   counts.total,
        ctaHref:         "/food/register",
        ctaLabel:        "Add your business",
      }}
      attribution={OSM_ATTRIBUTION}
      discoveryCards={discoveryCards}
      smartDiscovery={smartDiscovery}
    />
  );
}
