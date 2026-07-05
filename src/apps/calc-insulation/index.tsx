// calc-insulation — public entry point.

import { CALC_INSULATION_APP_MANIFEST } from "./manifest";
import type { CalcInsulationAppSize } from "./manifest";
import { InsulationCalcLandscape } from "./InsulationCalcLandscape";
import { InsulationCalcPortrait } from "./InsulationCalcPortrait";
import { InsulationCalcSquare } from "./InsulationCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type InsulationCalcAppProps = {
  size: CalcInsulationAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function InsulationCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: InsulationCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <InsulationCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <InsulationCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <InsulationCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_INSULATION_APP_MANIFEST } from "./manifest";
export type { CalcInsulationAppSize } from "./manifest";
export { InsulationCalcLandscape } from "./InsulationCalcLandscape";
export { InsulationCalcPortrait } from "./InsulationCalcPortrait";
export { InsulationCalcSquare } from "./InsulationCalcSquare";
