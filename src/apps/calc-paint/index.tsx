// calc-paint — public entry point.
//
// Picks the correct size variant based on the `size` prop. Consumers
// embed as:
//
//   <PaintCalcApp size="landscape" product={merchantProduct} />
//   <PaintCalcApp size="square" />
//   <PaintCalcApp size="portrait" whatsappNumber="+353..." />

import { CALC_PAINT_APP_MANIFEST } from "./manifest";
import type { CalcPaintAppSize } from "./manifest";
import { PaintCalcLandscape } from "./PaintCalcLandscape";
import { PaintCalcPortrait } from "./PaintCalcPortrait";
import { PaintCalcSquare } from "./PaintCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type PaintCalcAppProps = {
  size: CalcPaintAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function PaintCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: PaintCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <PaintCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <PaintCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <PaintCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

// ─── Re-exports ────────────────────────────────────────────────
export { CALC_PAINT_APP_MANIFEST } from "./manifest";
export type { CalcPaintAppSize } from "./manifest";
export { PaintCalcLandscape } from "./PaintCalcLandscape";
export { PaintCalcPortrait } from "./PaintCalcPortrait";
export { PaintCalcSquare } from "./PaintCalcSquare";
