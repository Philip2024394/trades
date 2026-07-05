// calc-wallpaper — public entry point.

import { CALC_WALLPAPER_APP_MANIFEST } from "./manifest";
import type { CalcWallpaperAppSize } from "./manifest";
import { WallpaperCalcLandscape } from "./WallpaperCalcLandscape";
import { WallpaperCalcPortrait } from "./WallpaperCalcPortrait";
import { WallpaperCalcSquare } from "./WallpaperCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type WallpaperCalcAppProps = {
  size: CalcWallpaperAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function WallpaperCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: WallpaperCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <WallpaperCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <WallpaperCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <WallpaperCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_WALLPAPER_APP_MANIFEST } from "./manifest";
export type { CalcWallpaperAppSize } from "./manifest";
export { WallpaperCalcLandscape } from "./WallpaperCalcLandscape";
export { WallpaperCalcPortrait } from "./WallpaperCalcPortrait";
export { WallpaperCalcSquare } from "./WallpaperCalcSquare";
