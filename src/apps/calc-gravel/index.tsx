// calc-gravel — public entry point.

import { CALC_GRAVEL_APP_MANIFEST } from "./manifest";
import type { CalcGravelAppSize } from "./manifest";
import { GravelCalcLandscape } from "./GravelCalcLandscape";
import { GravelCalcPortrait } from "./GravelCalcPortrait";
import { GravelCalcSquare } from "./GravelCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type GravelCalcAppProps = {
  size: CalcGravelAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function GravelCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: GravelCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <GravelCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <GravelCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <GravelCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_GRAVEL_APP_MANIFEST } from "./manifest";
export type { CalcGravelAppSize } from "./manifest";
export { GravelCalcLandscape } from "./GravelCalcLandscape";
export { GravelCalcPortrait } from "./GravelCalcPortrait";
export { GravelCalcSquare } from "./GravelCalcSquare";
