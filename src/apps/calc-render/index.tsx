// calc-render — public entry point.

import { CALC_RENDER_APP_MANIFEST } from "./manifest";
import type { CalcRenderAppSize } from "./manifest";
import { RenderCalcLandscape } from "./RenderCalcLandscape";
import { RenderCalcPortrait } from "./RenderCalcPortrait";
import { RenderCalcSquare } from "./RenderCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type RenderCalcAppProps = {
  size: CalcRenderAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onAddToCart?: () => void;
  onShare?: () => void;
  hideAddToCart?: boolean;
  hideShoppingList?: boolean;
};

export function RenderCalcApp({
  size,
  product,
  whatsappNumber,
  onAddToCart,
  onShare,
  hideAddToCart,
  hideShoppingList
}: RenderCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <RenderCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
    case "square":
      return (
        <RenderCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
          hideShoppingList={hideShoppingList}
        />
      );
    case "portrait":
      return (
        <RenderCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onAddToCart={onAddToCart}
          onShare={onShare}
          hideAddToCart={hideAddToCart}
        />
      );
  }
}

export { CALC_RENDER_APP_MANIFEST } from "./manifest";
export type { CalcRenderAppSize } from "./manifest";
export { RenderCalcLandscape } from "./RenderCalcLandscape";
export { RenderCalcPortrait } from "./RenderCalcPortrait";
export { RenderCalcSquare } from "./RenderCalcSquare";
