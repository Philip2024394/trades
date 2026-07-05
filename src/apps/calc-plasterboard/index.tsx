// calc-plasterboard — public entry point.

import { CALC_PLASTERBOARD_APP_MANIFEST } from "./manifest";
import type { CalcPlasterboardAppSize } from "./manifest";
import { PlasterboardCalcLandscape } from "./PlasterboardCalcLandscape";
import { PlasterboardCalcPortrait } from "./PlasterboardCalcPortrait";
import { PlasterboardCalcSquare } from "./PlasterboardCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type PlasterboardCalcAppProps = {
  size: CalcPlasterboardAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function PlasterboardCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: PlasterboardCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <PlasterboardCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <PlasterboardCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <PlasterboardCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_PLASTERBOARD_APP_MANIFEST } from "./manifest";
export type { CalcPlasterboardAppSize } from "./manifest";
export { PlasterboardCalcLandscape } from "./PlasterboardCalcLandscape";
export { PlasterboardCalcPortrait } from "./PlasterboardCalcPortrait";
export { PlasterboardCalcSquare } from "./PlasterboardCalcSquare";
