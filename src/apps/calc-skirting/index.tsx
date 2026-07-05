// calc-skirting — public entry point (Trim Carpenter Calculator).

import { CALC_SKIRTING_APP_MANIFEST } from "./manifest";
import type { CalcSkirtingAppSize } from "./manifest";
import { SkirtingCalcLandscape } from "./SkirtingCalcLandscape";
import { SkirtingCalcPortrait } from "./SkirtingCalcPortrait";
import { SkirtingCalcSquare } from "./SkirtingCalcSquare";

export type SkirtingCalcAppProps = {
  size: CalcSkirtingAppSize;
  whatsappNumber?: string;
  onShare?: () => void;
};

export function SkirtingCalcApp({
  size,
  whatsappNumber,
  onShare
}: SkirtingCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <SkirtingCalcLandscape
          whatsappNumber={whatsappNumber}
          onShare={onShare}
        />
      );
    case "square":
      return <SkirtingCalcSquare whatsappNumber={whatsappNumber} />;
    case "portrait":
      return (
        <SkirtingCalcPortrait
          whatsappNumber={whatsappNumber}
          onShare={onShare}
        />
      );
  }
}

export { CALC_SKIRTING_APP_MANIFEST } from "./manifest";
export type { CalcSkirtingAppSize } from "./manifest";
export { SkirtingCalcLandscape } from "./SkirtingCalcLandscape";
export { SkirtingCalcPortrait } from "./SkirtingCalcPortrait";
export { SkirtingCalcSquare } from "./SkirtingCalcSquare";
