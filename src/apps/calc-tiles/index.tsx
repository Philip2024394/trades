// calc-tiles — public entry point.

import { CALC_TILES_APP_MANIFEST } from "./manifest";
import type { CalcTilesAppSize } from "./manifest";
import { TilesCalcLandscape } from "./TilesCalcLandscape";
import { TilesCalcPortrait } from "./TilesCalcPortrait";
import { TilesCalcSquare } from "./TilesCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type TilesCalcAppProps = {
  size: CalcTilesAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function TilesCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: TilesCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <TilesCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <TilesCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <TilesCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_TILES_APP_MANIFEST } from "./manifest";
export type { CalcTilesAppSize } from "./manifest";
export { TilesCalcLandscape } from "./TilesCalcLandscape";
export { TilesCalcPortrait } from "./TilesCalcPortrait";
export { TilesCalcSquare } from "./TilesCalcSquare";
