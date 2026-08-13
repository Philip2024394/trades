// /nex-app/kitchen-library · Philip 2026-08-04.
//
// Kitchen sibling to /nex-app/staircase-library. Same swipe shell · same
// floating Nex chat · different image source (kitchen domain from
// data/nex-image-manifest.json).

import { StaircaseLibraryShell } from "@/components/nex-app/library/StaircaseLibraryShell";
import { listKitchenLibraryDesigns } from "@/lib/nex/images/kitchen-library";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kitchen Library · Nex", robots: { index: false } };

export default function KitchenLibraryPage() {
  const designs = listKitchenLibraryDesigns().map((d) => ({
    design_id: d.design_id,
    title: d.title,
    url: d.url,
    additional_views: d.additional_views,
    staircase_type: d.staircase_type,
    design_style: d.design_style,
    design_family: d.design_family,
    materials: d.materials,
    customer_description: d.customer_description,
    image_state: d.image_state,
    width: d.width,
    height: d.height,
  }));

  return (
    <StaircaseLibraryShell
      designs={designs}
      config={{
        title: "Kitchen Library",
        chatEndpoint: "/api/nex/kitchen-chat",
        emptyMessage: "No confirmed kitchens in the library yet.",
        storageKey: "nex-library-chat-kitchen",
      }}
    />
  );
}
