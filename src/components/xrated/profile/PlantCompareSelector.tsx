"use client";

// Compare selector — client component. Lets the visitor pick up to 4
// machines from the merchant's fleet; updates the URL so the server can
// render the spec table.

import { useRouter, useSearchParams } from "next/navigation";
import type { PlantCategorySlug } from "@/lib/plantHire";

export function PlantCompareSelector({
  merchantSlug,
  fleet,
  selected
}: {
  merchantSlug: string;
  fleet: { slug: PlantCategorySlug; label: string; image_url: string }[];
  selected: PlantCategorySlug[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function toggle(s: PlantCategorySlug) {
    let next = selected.slice();
    if (next.includes(s)) {
      next = next.filter((x) => x !== s);
    } else if (next.length < 4) {
      next.push(s);
    } else {
      return;
    }
    const q = new URLSearchParams(params.toString());
    q.delete("m");
    for (const x of next) q.append("m", x);
    router.replace(`/${merchantSlug}/plant-hire/compare?${q.toString()}`, { scroll: false });
  }

  return (
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
        Pick 2–4 machines to compare · {selected.length} / 4
      </p>
      <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {fleet.map((f) => {
          const on = selected.includes(f.slug);
          return (
            <li key={f.slug}>
              <button
                type="button"
                onClick={() => toggle(f.slug)}
                className={`flex w-full flex-col items-center gap-1 overflow-hidden rounded-2xl border p-2 text-center transition ${
                  on
                    ? "border-[#FFB300] bg-[#FFB300]/10 ring-2 ring-[#FFB300]"
                    : "border-neutral-200 bg-white hover:border-neutral-400"
                }`}
              >
                <div className="grid aspect-square w-full place-items-center overflow-hidden bg-neutral-50">
                  {f.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.image_url}
                      alt={f.label}
                      loading="lazy"
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-[8px] font-extrabold uppercase text-neutral-400">
                      Photo pending
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-extrabold leading-tight text-neutral-900">
                  {f.label}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
