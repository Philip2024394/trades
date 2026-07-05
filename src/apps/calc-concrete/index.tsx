// calc-concrete — public entry point.

import { CALC_CONCRETE_APP_MANIFEST } from "./manifest";
import type { CalcConcreteAppSize } from "./manifest";
import { ConcreteCalcLandscape } from "./ConcreteCalcLandscape";
import { ConcreteCalcPortrait } from "./ConcreteCalcPortrait";
import { ConcreteCalcSquare } from "./ConcreteCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type ConcreteCalcAppProps = {
  size: CalcConcreteAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function ConcreteCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: ConcreteCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <ConcreteCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <ConcreteCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <ConcreteCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_CONCRETE_APP_MANIFEST } from "./manifest";
export type { CalcConcreteAppSize } from "./manifest";
export { ConcreteCalcLandscape } from "./ConcreteCalcLandscape";
export { ConcreteCalcPortrait } from "./ConcreteCalcPortrait";
export { ConcreteCalcSquare } from "./ConcreteCalcSquare";
