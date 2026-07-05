// calc-flooring — public entry point.

import { CALC_FLOORING_APP_MANIFEST } from "./manifest";
import type { CalcFlooringAppSize } from "./manifest";
import { FlooringCalcLandscape } from "./FlooringCalcLandscape";
import { FlooringCalcPortrait } from "./FlooringCalcPortrait";
import { FlooringCalcSquare } from "./FlooringCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type FlooringCalcAppProps = {
  size: CalcFlooringAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function FlooringCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: FlooringCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <FlooringCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <FlooringCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <FlooringCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_FLOORING_APP_MANIFEST } from "./manifest";
export type { CalcFlooringAppSize } from "./manifest";
export { FlooringCalcLandscape } from "./FlooringCalcLandscape";
export { FlooringCalcPortrait } from "./FlooringCalcPortrait";
export { FlooringCalcSquare } from "./FlooringCalcSquare";
