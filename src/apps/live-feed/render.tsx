// Live Feed App renderer. Separated from manifest.ts because JSX
// forces a .tsx file.

import type { StudioAppRenderProps } from "@/platform/studio/manifest";
import { LiveFeedBlock } from "@/components/feed/LiveFeedBlock";

export function LiveFeedAppRender({
  merchantId,
  content
}: StudioAppRenderProps) {
  const limit = typeof content.limit === "number" ? content.limit : 6;
  const heading =
    typeof content.heading === "string" ? content.heading : "Recent work";
  const subhead =
    typeof content.subhead === "string"
      ? content.subhead
      : "Fresh jobs, straight from the site.";
  return (
    <LiveFeedBlock
      merchantId={merchantId}
      limit={limit}
      heading={heading}
      subhead={subhead}
      showFacetChips={content.showFacetChips !== false}
    />
  );
}
