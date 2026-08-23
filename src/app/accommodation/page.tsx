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
import { NexDirectoryFeed } from "@/components/nex-directory/NexDirectoryFeed";
import { getCategory } from "@/lib/nex/category-registry";
import { normalizeDirectoryCountry } from "@/lib/nex/directoryCountry";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Accommodation · Yogyakarta" };

const OSM_ATTRIBUTION = "Data © OpenStreetMap contributors, ODbL 1.0 · https://openstreetmap.org/copyright";

// Country Foundation Step 5 (2026-08-22) · `?country=XX` filters visible inventory to that market.
export default async function AccommodationPage({ searchParams }: { searchParams?: Promise<{ country?: string }> }) {
  const sp = (await searchParams) ?? {};
  const country = normalizeDirectoryCountry(sp.country);
  const [listings, counts] = await Promise.all([
    loadAccommodationListings({ city: "Yogyakarta", country }),   // no category filter · broad
    countAccommodationDiscovered({ city: "Yogyakarta", country }),
  ]);
  const meta = getCategory("accommodation");

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
      }))}
      emptyState={{
        totalDiscovered: counts.discovered,
        totalUniverse:   counts.total,
        ctaHref:         "/food/register",
        ctaLabel:        "Add your business",
      }}
      attribution={OSM_ATTRIBUTION}
    />
  );
}
