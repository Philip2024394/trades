"use client";

// Coverage context — the state a public page keeps about the visitor's
// postcode + whether it's inside the merchant's radius.
//
// Sections read this via useCoverage() and either hide or grey when
// status='outside'. When status='unknown' (no postcode entered yet)
// everything renders as normal.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState
} from "react";
import { lookupPostcode } from "@/lib/studio/coverage/postcodesIo";
import { haversineMiles } from "@/lib/studio/coverage/haversine";

export type CoverageStatus = "unknown" | "in-radius" | "outside" | "error";

export type CoverageState = {
  status: CoverageStatus;
  visitorPostcode: string | null;
  distanceMi: number | null;
  errorMessage: string | null;
};

type CoverageContextValue = CoverageState & {
  merchantPostcode: string | null;
  radiusMi: number | null;
  isNational: boolean;
  submitPostcode: (raw: string) => Promise<void>;
  clear: () => void;
};

const CoverageContext = createContext<CoverageContextValue | null>(null);

export function CoverageProvider({
  merchantPostcode,
  merchantCenter,
  radiusMi,
  isNational,
  children
}: {
  merchantPostcode: string | null;
  merchantCenter: { lat: number; lng: number } | null;
  radiusMi: number | null;
  isNational: boolean;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<CoverageState>({
    status: "unknown",
    visitorPostcode: null,
    distanceMi: null,
    errorMessage: null
  });

  const submitPostcode = useCallback(
    async (raw: string) => {
      if (isNational) {
        setState({
          status: "in-radius",
          visitorPostcode: raw,
          distanceMi: 0,
          errorMessage: null
        });
        return;
      }
      if (!merchantCenter || !radiusMi) {
        setState({
          status: "error",
          visitorPostcode: raw,
          distanceMi: null,
          errorMessage: "coverage-unconfigured"
        });
        return;
      }
      const point = await lookupPostcode(raw);
      if (!point) {
        setState({
          status: "error",
          visitorPostcode: raw,
          distanceMi: null,
          errorMessage: "postcode-not-found"
        });
        return;
      }
      const distance = haversineMiles(merchantCenter, {
        lat: point.latitude,
        lng: point.longitude
      });
      setState({
        status: distance <= radiusMi ? "in-radius" : "outside",
        visitorPostcode: point.postcode,
        distanceMi: Math.round(distance * 10) / 10,
        errorMessage: null
      });
    },
    [merchantCenter, radiusMi, isNational]
  );

  const clear = useCallback(() => {
    setState({
      status: "unknown",
      visitorPostcode: null,
      distanceMi: null,
      errorMessage: null
    });
  }, []);

  const value = useMemo<CoverageContextValue>(
    () => ({
      ...state,
      merchantPostcode,
      radiusMi,
      isNational,
      submitPostcode,
      clear
    }),
    [state, merchantPostcode, radiusMi, isNational, submitPostcode, clear]
  );

  return (
    <CoverageContext.Provider value={value}>
      {children}
    </CoverageContext.Provider>
  );
}

export function useCoverage(): CoverageContextValue {
  const ctx = useContext(CoverageContext);
  if (!ctx) {
    // Safe fallback for pages that aren't wrapped — sections render
    // as-normal rather than throwing.
    return {
      status: "unknown",
      visitorPostcode: null,
      distanceMi: null,
      errorMessage: null,
      merchantPostcode: null,
      radiusMi: null,
      isNational: true,
      submitPostcode: async () => undefined,
      clear: () => undefined
    };
  }
  return ctx;
}
