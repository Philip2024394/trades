"use client";

// src/app/nex-native/cover/layout-switch.tsx
//
// Client-side switch that renders one of the 10 sealed cover
// layouts. Lives in this thin file (instead of the server page)
// because the layouts themselves are "use client" and server
// components can't destructure a "use client" registry object.

import * as React from "react";
import {
  LayoutCafe,
  LayoutCafeLandscape,
  LayoutRestaurant,
  LayoutProduct,
  LayoutProductLandscape,
  LayoutTradesperson,
  LayoutSalon,
  LayoutCreator,
  LayoutFashion,
  LayoutStreetFood,
  LayoutPremiumBusiness,
  LayoutPersonalBrand,
  LayoutPersonalBrandLandscape,
  LayoutPersonalBrandRound,
} from "./layouts";
import type { CoverLayoutId } from "./layout-ids";
import type { MockCoverContent } from "./mock-data";

export function CoverLayoutSwitch({
  layoutId,
  content,
  themeId,
}: {
  layoutId: CoverLayoutId;
  content: MockCoverContent;
  themeId: string;
}): React.JSX.Element | null {
  switch (layoutId) {
    case "cafe":
      return <LayoutCafe content={content} themeId={themeId} />;
    case "restaurant":
      return <LayoutRestaurant content={content} themeId={themeId} />;
    case "product":
      return <LayoutProduct content={content} themeId={themeId} />;
    case "tradesperson":
      return <LayoutTradesperson content={content} themeId={themeId} />;
    case "salon":
      return <LayoutSalon content={content} themeId={themeId} />;
    case "creator":
      return <LayoutCreator content={content} themeId={themeId} />;
    case "fashion":
      return <LayoutFashion content={content} themeId={themeId} />;
    case "street_food":
      return <LayoutStreetFood content={content} themeId={themeId} />;
    case "premium_business":
      return <LayoutPremiumBusiness content={content} themeId={themeId} />;
    case "personal_brand":
      return <LayoutPersonalBrand content={content} themeId={themeId} />;
    case "product_landscape":
      return <LayoutProductLandscape content={content} themeId={themeId} />;
    case "cafe_landscape":
      return <LayoutCafeLandscape content={content} themeId={themeId} />;
    case "personal_brand_landscape":
      return (
        <LayoutPersonalBrandLandscape content={content} themeId={themeId} />
      );
    case "personal_brand_round":
      return <LayoutPersonalBrandRound content={content} themeId={themeId} />;
    default:
      return null;
  }
}
