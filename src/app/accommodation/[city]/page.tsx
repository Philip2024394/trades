// src/app/accommodation/[city]/page.tsx
//
// Dynamic per-city Accommodation directory (2026-08-24).
//
// ONE React page renders every Indonesian city's accommodation experience.
// Adding a new city to `src/lib/nex/city-registry.ts` automatically enables
// `/accommodation/<slug>` without creating another bespoke page.
//
// Doctrine (Philip 2026-08-24):
//   · "Do NOT create 100 separate React pages for 100 cities."
//   · "One reusable city directory template driven by city data."
//   · Genuine per-city experience · never a generic dataset with a changed heading.
//   · Never fake activity · unknown slugs redirect to /accommodation landing.

import { notFound } from "next/navigation";
import { loadAccommodationListings, countAccommodationDiscovered } from "@/lib/nex-accommodation/list-businesses";
import { NexDirectoryFeed } from "@/components/nex-directory/NexDirectoryFeed";
import type { DiscoveryCardData } from "@/components/nex-directory/NexDiscoveryCard";
import { getCategory } from "@/lib/nex/category-registry";
import { normalizeDirectoryCountry } from "@/lib/nex/directoryCountry";
import { cityFromSlug } from "@/lib/nex/city-registry";
import { loadLibraryForCategory, resolveFallbackUrl } from "@/lib/nex-directory/category-fallback";

export const dynamic = "force-dynamic";

// Dynamic metadata · reflects the actual city being shown.
export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  const { city: slug } = await params;
  const entry = cityFromSlug(slug);
  if (!entry) return { title: "NEX Accommodation" };
  return { title: `NEX Accommodation · ${entry.canonical}` };
}

const OSM_ATTRIBUTION = "Data © OpenStreetMap contributors, ODbL 1.0 · https://openstreetmap.org/copyright";

export default async function AccommodationCityPage(
  { params, searchParams }: {
    params: Promise<{ city: string }>;
    searchParams?: Promise<{ country?: string; page?: string }>;
  },
) {
  const { city: slug } = await params;
  const entry = cityFromSlug(slug);
  // Never fake a city · unknown slug → 404. The landing at /accommodation
  // remains the discovery entry for "browse all".
  if (!entry) notFound();

  const sp = (await searchParams) ?? {};
  const country = normalizeDirectoryCountry(sp.country);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * 1500;

  const [listings, counts, libraryRows] = await Promise.all([
    loadAccommodationListings({ city: entry.canonical, country, offset }),
    countAccommodationDiscovered({ city: entry.canonical, country }),
    loadLibraryForCategory("accommodation"),                              // STEP 2 · category fallback library
  ]);
  const meta = getCategory("accommodation");

  // Discovery cards · same shape as Yogyakarta but scoped to this city.
  // For non-Yogyakarta cities, "Discover local food" links to /food (broad)
  // until per-city food directories are wired in a follow-up.
  const discoveryCards: DiscoveryCardData[] = [
    {
      id: "food-nearby",
      emoji: "🍜",
      eyebrow: "Useful around your stay",
      title: `Discover food in ${entry.canonical}`,
      body: `Warungs, cafes and restaurants near ${entry.canonical} accommodations. Every listing has public evidence.`,
      href: "/food",
      cta: "Explore local food →",
      state: "live",
    },
    {
      id: "local-transport",
      emoji: "🏍",
      eyebrow: "Coming soon",
      title: "Local rental & transport",
      body: "Motorbike rental, car hire, airport transfer. NEX is building its local provider network before opening this.",
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
      body: "Order from a local shop, get it on a bike. Requires the Local Delivery Contract (5 allocated providers · each provider sets their own price).",
      state: "future",
    },
  ];

  return (
    <NexDirectoryFeed
      categoryId={meta?.id ?? "accommodation"}
      categoryLabel={meta?.displayName.en ?? "Accommodation"}
      categoryIcon={meta?.icon ?? "🏨"}
      city={entry.canonical}
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
        // STEP 2 · category-fallback resolver kicks in when no real hero
        // image · preferred variant tag = the vertical category (e.g. "hotel",
        // "guesthouse") so Philip's granular variants win when curated.
        fallbackImageUrl: l.heroImageUrl ? null : resolveFallbackUrl({
          categorySlug: "accommodation",
          preferredVariants: [l.category].filter(Boolean),
          libraryRows,
        }),
        rating:           l.rating,
        reviewCount:      l.reviewCount,
        categoryBadges:   l.starRating ? [{ label: `${l.starRating}★`, tone: "orange" }] : undefined,
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
    />
  );
}
