// calc-mortar — public entry point.

import { CALC_MORTAR_APP_MANIFEST } from "./manifest";
import type { CalcMortarAppSize } from "./manifest";
import { MortarCalcLandscape } from "./MortarCalcLandscape";
import { MortarCalcPortrait } from "./MortarCalcPortrait";
import { MortarCalcSquare } from "./MortarCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type MortarCalcAppProps = {
  size: CalcMortarAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function MortarCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: MortarCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <MortarCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <MortarCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <MortarCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_MORTAR_APP_MANIFEST } from "./manifest";
export type { CalcMortarAppSize } from "./manifest";
export { MortarCalcLandscape } from "./MortarCalcLandscape";
export { MortarCalcPortrait } from "./MortarCalcPortrait";
export { MortarCalcSquare } from "./MortarCalcSquare";
