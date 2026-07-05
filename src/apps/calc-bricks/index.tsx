// calc-bricks — public entry point.

import { CALC_BRICKS_APP_MANIFEST } from "./manifest";
import type { CalcBricksAppSize } from "./manifest";
import { BricksCalcLandscape } from "./BricksCalcLandscape";
import { BricksCalcPortrait } from "./BricksCalcPortrait";
import { BricksCalcSquare } from "./BricksCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type BricksCalcAppProps = {
  size: CalcBricksAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function BricksCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: BricksCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <BricksCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <BricksCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <BricksCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_BRICKS_APP_MANIFEST } from "./manifest";
export type { CalcBricksAppSize } from "./manifest";
export { BricksCalcLandscape } from "./BricksCalcLandscape";
export { BricksCalcPortrait } from "./BricksCalcPortrait";
export { BricksCalcSquare } from "./BricksCalcSquare";
