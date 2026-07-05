// calc-turf — public entry point.

import { CALC_TURF_APP_MANIFEST } from "./manifest";
import type { CalcTurfAppSize } from "./manifest";
import { TurfCalcLandscape } from "./TurfCalcLandscape";
import { TurfCalcPortrait } from "./TurfCalcPortrait";
import { TurfCalcSquare } from "./TurfCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type TurfCalcAppProps = {
  size: CalcTurfAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function TurfCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: TurfCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <TurfCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <TurfCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <TurfCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_TURF_APP_MANIFEST } from "./manifest";
export type { CalcTurfAppSize } from "./manifest";
export { TurfCalcLandscape } from "./TurfCalcLandscape";
export { TurfCalcPortrait } from "./TurfCalcPortrait";
export { TurfCalcSquare } from "./TurfCalcSquare";
