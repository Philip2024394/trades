// /guesthouse · Task #89 Phase B (2026-08-22) · focused guesthouse route.

import { loadAccommodationListings, countAccommodationDiscovered } from "@/lib/nex-accommodation/list-businesses";
import { NexDirectoryFeed } from "@/components/nex-directory/NexDirectoryFeed";
import { getCategory } from "@/lib/nex/category-registry";
import { normalizeDirectoryCountry } from "@/lib/nex/directoryCountry";

export const dynamic = "force-dynamic";
export const metadata = { title: "NEX Guesthouse · Yogyakarta" };

const CAT_ID = "guesthouse";
const OSM_ATTRIBUTION = "Data © OpenStreetMap contributors, ODbL 1.0 · https://openstreetmap.org/copyright";

// Country Foundation Step 5 (2026-08-22) · `?country=XX` filters visible inventory to that market.
export default async function GuesthousePage({ searchParams }: { searchParams?: Promise<{ country?: string }> }) {
  const sp = (await searchParams) ?? {};
  const country = normalizeDirectoryCountry(sp.country);
  const [listings, counts] = await Promise.all([
    loadAccommodationListings({ category: CAT_ID, city: "Yogyakarta", country }),
    countAccommodationDiscovered({ category: CAT_ID, city: "Yogyakarta", country }),
  ]);
  const meta = getCategory(CAT_ID);

  return (
    <NexDirectoryFeed
      categoryId={CAT_ID}
      categoryLabel={meta?.displayName.en ?? "Guesthouse"}
      categoryIcon={meta?.icon ?? "🏠"}
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
      }))}
      emptyState={{
        totalDiscovered: counts.discovered,
        totalUniverse:   counts.total,
        ctaHref:         "/food/register",
        ctaLabel:        "Add your guesthouse",
      }}
      attribution={OSM_ATTRIBUTION}
    />
  );
}
