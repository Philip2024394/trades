// calc-decking — public entry point.

import { CALC_DECKING_APP_MANIFEST } from "./manifest";
import type { CalcDeckingAppSize } from "./manifest";
import { DeckingCalcLandscape } from "./DeckingCalcLandscape";
import { DeckingCalcPortrait } from "./DeckingCalcPortrait";
import { DeckingCalcSquare } from "./DeckingCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type DeckingCalcAppProps = {
  size: CalcDeckingAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function DeckingCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: DeckingCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <DeckingCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <DeckingCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <DeckingCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_DECKING_APP_MANIFEST } from "./manifest";
export type { CalcDeckingAppSize } from "./manifest";
export { DeckingCalcLandscape } from "./DeckingCalcLandscape";
export { DeckingCalcPortrait } from "./DeckingCalcPortrait";
export { DeckingCalcSquare } from "./DeckingCalcSquare";
