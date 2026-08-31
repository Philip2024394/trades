// src/app/services/[category]/page.tsx
//
// NEX Services · public dynamic directory · Philip 2026-08-27.
//
// ONE React page renders every service category's public directory.
// Adding a new service to data/nex-job-registry.json automatically enables
// /services/<category-slug> without creating another bespoke page.
//
// Uses the SAME NexDirectoryFeed shared component as /accommodation ·
// same landscape card · same visual language. Real hero images win ·
// category fallback resolver fills the hero when a business has no image.
//
// Doctrine (Philip):
//   · "Do NOT create a new card style"
//   · "Use the exact same landscape business card design as accommodation"
//   · Real image if available · fallback image if not
//   · Show actual live nex.service_business rows
//   · No marketing/outreach changes

import { notFound } from "next/navigation";
import { NexDirectoryFeed } from "@/components/nex-directory/NexDirectoryFeed";
import { loadJobs } from "@/lib/nex-hq/workforce-jobs";
import { loadServiceListings, countServiceListings } from "@/lib/nex-service/list-businesses";
import { loadLibraryForCategory, resolveFallbackUrl } from "@/lib/nex-directory/category-fallback";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OSM_ATTRIBUTION = "Data © OpenStreetMap contributors, ODbL 1.0 · https://openstreetmap.org/copyright";

// Only slugs that target nex.service_business are eligible for /services/*.
// Hotel/guesthouse/restaurant/cafe land in accommodation/food tables and will
// get their own routes (existing /accommodation is one; /food is another).
function serviceJobBySlug(slug: string) {
  const jobs = loadJobs();
  return jobs.find(
    (j) => j.category_slug === slug && j.target_table === "nex.service_business",
  );
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const job = serviceJobBySlug(category);
  if (!job) return { title: "NEX Services" };
  return {
    title: `NEX · ${job.emoji} ${job.name} · Indonesia`,
    robots: { index: true },
  };
}

export default async function ServicesCategoryPage(
  { params }: { params: Promise<{ category: string }> },
) {
  const { category } = await params;
  const job = serviceJobBySlug(category);
  if (!job) notFound();

  const [rawListings, counts, libraryRows] = await Promise.all([
    loadServiceListings({ categorySlug: category }),
    countServiceListings(category),
    loadLibraryForCategory(category),
  ]);

  return (
    <NexDirectoryFeed
      categoryId={job.category_slug}
      categoryLabel={job.name}
      categoryIcon={job.emoji}
      city="Indonesia"
      listings={rawListings.map((l) => ({
        publicListingRef: l.publicListingRef,
        businessName:     l.businessName,
        category:         l.categorySlug,
        categories:       l.categories,
        city:             l.city,
        district:         l.district,
        address:          l.address,
        phone:            l.phone,
        whatsappNumber:   l.whatsappNumber,
        website:          l.website,
        heroImageUrl:     l.heroImageUrl,
        // Resolve category fallback when the row has no real hero image.
        // Preferred variant = the row's city so per-city curated variants
        // (e.g. jakarta-gym, bali-salon) can win when Philip adds them.
        fallbackImageUrl: l.heroImageUrl ? null : resolveFallbackUrl({
          categorySlug: category,
          preferredVariants: [l.city?.toLowerCase()].filter(Boolean) as string[],
          libraryRows,
        }),
        // marketing_ready rows get a green badge so Philip can spot them fast.
        categoryBadges: l.commercialStatus === "marketing_ready"
          ? [{ label: "Marketing ready", tone: "green" }]
          : undefined,
      }))}
      emptyState={{
        totalDiscovered: counts.total,
        totalUniverse:   counts.total,
      }}
      attribution={OSM_ATTRIBUTION}
    />
  );
}
