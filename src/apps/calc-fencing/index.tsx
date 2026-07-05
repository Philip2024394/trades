// calc-fencing — public entry point.

import { CALC_FENCING_APP_MANIFEST } from "./manifest";
import type { CalcFencingAppSize } from "./manifest";
import { FencingCalcLandscape } from "./FencingCalcLandscape";
import { FencingCalcPortrait } from "./FencingCalcPortrait";
import { FencingCalcSquare } from "./FencingCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type FencingCalcAppProps = {
  size: CalcFencingAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function FencingCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: FencingCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <FencingCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <FencingCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <FencingCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_FENCING_APP_MANIFEST } from "./manifest";
export type { CalcFencingAppSize } from "./manifest";
export { FencingCalcLandscape } from "./FencingCalcLandscape";
export { FencingCalcPortrait } from "./FencingCalcPortrait";
export { FencingCalcSquare } from "./FencingCalcSquare";
