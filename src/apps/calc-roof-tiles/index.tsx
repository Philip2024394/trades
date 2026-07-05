// calc-roof-tiles — public entry point.

import { CALC_ROOF_TILES_APP_MANIFEST } from "./manifest";
import type { CalcRoofTilesAppSize } from "./manifest";
import { RoofTilesCalcLandscape } from "./RoofTilesCalcLandscape";
import { RoofTilesCalcPortrait } from "./RoofTilesCalcPortrait";
import { RoofTilesCalcSquare } from "./RoofTilesCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type RoofTilesCalcAppProps = {
  size: CalcRoofTilesAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function RoofTilesCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: RoofTilesCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <RoofTilesCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <RoofTilesCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <RoofTilesCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_ROOF_TILES_APP_MANIFEST } from "./manifest";
export type { CalcRoofTilesAppSize } from "./manifest";
export { RoofTilesCalcLandscape } from "./RoofTilesCalcLandscape";
export { RoofTilesCalcPortrait } from "./RoofTilesCalcPortrait";
export { RoofTilesCalcSquare } from "./RoofTilesCalcSquare";
