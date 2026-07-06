// /admin/hero-library — server component listing every hero image with
// search, filter, and row actions (Edit / Delete). Data comes from
// the Supabase hero_library table via supabaseAdmin (service role).
//
// The New / Edit / Delete flows POST to /api/admin/hero-library/*
// which round-trip through the same admin session cookie.

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { AdminHeroSearchBar } from "./AdminHeroSearchBar";
import { AdminHeroRowActions } from "./AdminHeroRowActions";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  sibling?: string;
  sort?: string;
};

async function loadImages(params: SearchParams) {
  let query = supabaseAdmin
    .from("hero_library")
    .select("*")
    .order("updated_at", { ascending: false });

  if (params.q) {
    // Case-insensitive contains match across subject + vibe + id + hero_use_case
    query = query.or(
      `id.ilike.%${params.q}%,subject.ilike.%${params.q}%,vibe.ilike.%${params.q}%,hero_use_case.ilike.%${params.q}%`
    );
  }
  if (params.sibling) {
    query = query.eq("sibling_group_id", params.sibling);
  }

  const { data, error } = await query.limit(500);
  if (error) {
    console.error("[admin/hero-library] load failed:", error);
    return { images: [], error: error.message };
  }
  return { images: data ?? [], error: null };
}

async function loadSiblingGroups() {
  const { data, error } = await supabaseAdmin
    .from("hero_library")
    .select("sibling_group_id")
    .not("sibling_group_id", "is", null);
  if (error || !data) return [];
  return [...new Set(data.map((r) => r.sibling_group_id as string))].sort();
}

async function loadStats() {
  const { count: total } = await supabaseAdmin
    .from("hero_library")
    .select("id", { count: "exact", head: true });
  const { count: withText } = await supabaseAdmin
    .from("hero_library")
    .select("id", { count: "exact", head: true })
    .eq("burned_in_text", true);
  const { count: withWorker } = await supabaseAdmin
    .from("hero_library")
    .select("id", { count: "exact", head: true })
    .eq("worker_visible", true);
  return { total: total ?? 0, withText: withText ?? 0, withWorker: withWorker ?? 0 };
}

type PageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function HeroLibraryAdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [{ images, error }, siblingGroups, stats] = await Promise.all([
    loadImages(params),
    loadSiblingGroups(),
    loadStats()
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-neutral-900">
            Hero Library
          </h1>
          <p className="mt-1 text-[13px] text-neutral-600">
            {stats.total} images · {stats.withWorker} with worker visible ·{" "}
            {stats.withText} with burned-in text
          </p>
        </div>
        <Link
          href="/admin/hero-library/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-800"
        >
          + Add image
        </Link>
      </div>

      <AdminHeroSearchBar
        siblingGroups={siblingGroups}
        currentQ={params.q ?? ""}
        currentSibling={params.sibling ?? ""}
      />

      {error ? (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-800">
          Load failed: {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-[12px]">
          <thead className="bg-neutral-50 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold text-neutral-700">Image</th>
              <th className="px-3 py-2 font-semibold text-neutral-700">ID · Vibe</th>
              <th className="px-3 py-2 font-semibold text-neutral-700">Keywords</th>
              <th className="px-3 py-2 font-semibold text-neutral-700">Sibling</th>
              <th className="px-3 py-2 font-semibold text-neutral-700">Use</th>
              <th className="px-3 py-2 text-right font-semibold text-neutral-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {images.map((img: Record<string, unknown>) => {
              const id = img.id as string;
              const url = img.image_url as string;
              const vibe = img.vibe as string;
              const keywords = (img.keywords_strict as string[]) ?? [];
              const siblingGroupId = img.sibling_group_id as string | null;
              const recommendedUse = img.recommended_use as string;
              return (
                <tr
                  key={id}
                  className="border-t border-neutral-100 hover:bg-neutral-50"
                >
                  <td className="px-3 py-2">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt=""
                        className="h-10 w-16 rounded object-cover"
                        loading="lazy"
                      />
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="font-mono text-[11px] font-medium text-neutral-900">
                      {id}
                    </div>
                    <div className="mt-0.5 text-[11px] text-neutral-500">
                      {vibe}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-1">
                      {keywords.slice(0, 3).map((k: string) => (
                        <span
                          key={k}
                          className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-700"
                        >
                          {k}
                        </span>
                      ))}
                      {keywords.length > 3 ? (
                        <span className="text-[10px] text-neutral-500">
                          +{keywords.length - 3}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {siblingGroupId ? (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-800">
                        {siblingGroupId}
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-700">
                      {recommendedUse}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <AdminHeroRowActions id={id} />
                  </td>
                </tr>
              );
            })}
            {images.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                  {params.q || params.sibling
                    ? "No images match your filters."
                    : "Library is empty. Run the seed script to populate."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
