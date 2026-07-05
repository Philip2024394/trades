// calc-paving — public entry point.

import { CALC_PAVING_APP_MANIFEST } from "./manifest";
import type { CalcPavingAppSize } from "./manifest";
import { PavingCalcLandscape } from "./PavingCalcLandscape";
import { PavingCalcPortrait } from "./PavingCalcPortrait";
import { PavingCalcSquare } from "./PavingCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type PavingCalcAppProps = {
  size: CalcPavingAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function PavingCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: PavingCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <PavingCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <PavingCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <PavingCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_PAVING_APP_MANIFEST } from "./manifest";
export type { CalcPavingAppSize } from "./manifest";
export { PavingCalcLandscape } from "./PavingCalcLandscape";
export { PavingCalcPortrait } from "./PavingCalcPortrait";
export { PavingCalcSquare } from "./PavingCalcSquare";
