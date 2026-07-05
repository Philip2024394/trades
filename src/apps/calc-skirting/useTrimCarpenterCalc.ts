// useTrimCarpenterCalc — shared state hook.
//
// Splits state into rates (carpenter's price card) + quantities
// (what the customer needs). Result auto-computes and hides any
// service whose rate is 0 (carpenter doesn't offer it) or whose
// quantity is 0 (customer doesn't need any).

"use client";

import { useCallback, useMemo, useState } from "react";
import {
  computeTrimCarpenter,
  DEFAULT_TRIM_RATES,
  enabledTrimServices,
  ZERO_TRIM_QUANTITIES
} from "./logic";
import type {
  TrimCarpenterInputs,
  TrimQuantities,
  TrimRates,
  TrimService
} from "./logic";

export type UseTrimCarpenterCalcOptions = {
  initialRates?: Partial<TrimRates>;
};

export function useTrimCarpenterCalc(options?: UseTrimCarpenterCalcOptions) {
  const [rates, setRates] = useState<TrimRates>({
    ...DEFAULT_TRIM_RATES,
    ...(options?.initialRates ?? {})
  });
  const [quantities, setQuantities] =
    useState<TrimQuantities>(ZERO_TRIM_QUANTITIES);

  const inputs = useMemo<TrimCarpenterInputs>(
    () => ({ rates, quantities }),
    [rates, quantities]
  );

  const result = useMemo(() => computeTrimCarpenter(inputs), [inputs]);
  const enabledServices = useMemo(() => enabledTrimServices(rates), [rates]);

  const setRate = useCallback((service: TrimService, pence: number) => {
    setRates((prev) => ({ ...prev, [service]: Math.max(0, pence) }));
  }, []);

  const setQuantity = useCallback((service: TrimService, qty: number) => {
    setQuantities((prev) => ({ ...prev, [service]: Math.max(0, qty) }));
  }, []);

  const resetQuantities = useCallback(() => {
    setQuantities(ZERO_TRIM_QUANTITIES);
  }, []);

  return {
    rates,
    quantities,
    inputs,
    result,
    enabledServices,
    setRate,
    setQuantity,
    resetQuantities
  };
}

export type UseTrimCarpenterCalcReturn = ReturnType<
  typeof useTrimCarpenterCalc
>;
