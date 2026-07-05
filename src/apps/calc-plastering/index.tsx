// calc-plastering — public entry point.

import { CALC_PLASTERING_APP_MANIFEST } from "./manifest";
import type { CalcPlasteringAppSize } from "./manifest";
import { PlasteringCalcLandscape } from "./PlasteringCalcLandscape";
import { PlasteringCalcPortrait } from "./PlasteringCalcPortrait";
import { PlasteringCalcSquare } from "./PlasteringCalcSquare";
import type { CalculatorProductRef } from "./logic";

export type PlasteringCalcAppProps = {
  size: CalcPlasteringAppSize;
  product?: CalculatorProductRef;
  whatsappNumber?: string;
  onShare?: () => void;
};

export function PlasteringCalcApp({
  size,
  product,
  whatsappNumber,
  onShare
}: PlasteringCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <PlasteringCalcLandscape
          product={product}
          whatsappNumber={whatsappNumber}
          onShare={onShare}
        />
      );
    case "square":
      return (
        <PlasteringCalcSquare
          product={product}
          whatsappNumber={whatsappNumber}
        />
      );
    case "portrait":
      return (
        <PlasteringCalcPortrait
          product={product}
          whatsappNumber={whatsappNumber}
          onShare={onShare}
        />
      );
  }
}

export { CALC_PLASTERING_APP_MANIFEST } from "./manifest";
export type { CalcPlasteringAppSize } from "./manifest";
export { PlasteringCalcLandscape } from "./PlasteringCalcLandscape";
export { PlasteringCalcPortrait } from "./PlasteringCalcPortrait";
export { PlasteringCalcSquare } from "./PlasteringCalcSquare";
