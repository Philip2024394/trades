// Recent-work gallery on a trade profile. object-contain per the global
// image rule (feedback_global_images_contain.md).

import { MapPin, Camera } from "lucide-react";
import type { TradeGalleryImage } from "../data/tradeProfiles";

type Props = {
  gallery: TradeGalleryImage[];
};

export function TradeGallerySection({ gallery }: Props) {
  if (gallery.length === 0) return null;
  return (
    <section
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="flex items-center gap-2">
        <Camera size={14} className="text-neutral-700"/>
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Recent work
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.map((g) => (
          <li
            key={g.id}
            className="overflow-hidden rounded-xl border"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            <div className="aspect-[4/3] w-full overflow-hidden" style={{ backgroundColor: "#F5F0E4" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.imageUrl}
                alt={g.caption ?? g.jobType}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-3">
              <div className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-600">
                {g.jobType}
              </div>
              {g.caption && (
                <div className="mt-1.5 text-[12px] font-black text-neutral-900">
                  {g.caption}
                </div>
              )}
              {g.location && (
                <div className="mt-0.5 flex items-center gap-1 text-[10.5px] text-neutral-500">
                  <MapPin size={9}/> {g.location}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
