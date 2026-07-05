// calc-delivery — public entry point.

import { CALC_DELIVERY_APP_MANIFEST } from "./manifest";
import type { CalcDeliveryAppSize } from "./manifest";
import { DeliveryCalcLandscape } from "./DeliveryCalcLandscape";
import { DeliveryCalcPortrait } from "./DeliveryCalcPortrait";
import { DeliveryCalcSquare } from "./DeliveryCalcSquare";

export type DeliveryCalcAppProps = {
  size: CalcDeliveryAppSize;
  initialLat?: number;
  initialLng?: number;
  initialLabel?: string;
};

export function DeliveryCalcApp({
  size,
  initialLat,
  initialLng,
  initialLabel
}: DeliveryCalcAppProps) {
  switch (size) {
    case "landscape":
      return (
        <DeliveryCalcLandscape
          initialLat={initialLat}
          initialLng={initialLng}
          initialLabel={initialLabel}
        />
      );
    case "square":
      return (
        <DeliveryCalcSquare
          initialLat={initialLat}
          initialLng={initialLng}
          initialLabel={initialLabel}
        />
      );
    case "portrait":
      return (
        <DeliveryCalcPortrait
          initialLat={initialLat}
          initialLng={initialLng}
          initialLabel={initialLabel}
        />
      );
  }
}

export { CALC_DELIVERY_APP_MANIFEST } from "./manifest";
export type { CalcDeliveryAppSize } from "./manifest";
export { DeliveryCalcLandscape } from "./DeliveryCalcLandscape";
export { DeliveryCalcPortrait } from "./DeliveryCalcPortrait";
export { DeliveryCalcSquare } from "./DeliveryCalcSquare";
