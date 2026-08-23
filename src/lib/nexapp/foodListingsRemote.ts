// NEX Food · client-side listings loader with graceful fallback.
//
// Fetches from /api/nex-food/listings · falls back to MOCK_FOOD_LISTINGS if
// the API is unreachable or returns an error. Never leaves the UI empty.
//
// Loading strategy:
//   1. Return mocks synchronously (initial render)
//   2. Fetch live rows in useEffect
//   3. Replace mocks with live rows when they land
//   4. If fetch fails, keep mocks + log a warning
//
// This preserves the "UI keeps compiling on 8 GB" invariant · no hard
// dependency on the DB or API being live for the panel to render.

"use client";

import { useEffect, useState } from "react";
import { MOCK_FOOD_LISTINGS, type FoodListing, type FoodCategory } from "./foodListings";

type ApiResponse = {
  listings?: FoodListing[];
  attribution?: string;
  count?: number;
  error?: string;
};

export type UseFoodListingsResult = {
  listings: readonly FoodListing[];
  attribution: string;      // ODbL text or "" · UI surfaces where source requires
  source: "loading-mock" | "live" | "fallback-mock";
  errorMessage: string | null;
};

/**
 * Hook · returns the current listings for the given filter, with graceful
 * fallback to mocks. Safe to call from the FoodDirectoryPanel client component.
 */
export function useFoodListings(filter?: { category?: FoodCategory }): UseFoodListingsResult {
  const [state, setState] = useState<UseFoodListingsResult>({
    listings: MOCK_FOOD_LISTINGS,
    attribution: "",
    source: "loading-mock",
    errorMessage: null,
  });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      const params = new URLSearchParams();
      if (filter?.category) params.set("category", filter.category);
      const url = `/api/nex-food/listings${params.toString() ? "?" + params.toString() : ""}`;

      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as ApiResponse;
        if (cancelled) return;
        if (data.error || !Array.isArray(data.listings)) {
          throw new Error(data.error ?? "malformed response");
        }
        if (data.listings.length === 0) {
          // Live DB returned no rows · keep mocks so UI is not empty during
          // early development. Once the DB has enough approved listings this
          // path becomes uncommon.
          setState({
            listings: MOCK_FOOD_LISTINGS,
            attribution: data.attribution ?? "",
            source: "fallback-mock",
            errorMessage: null,
          });
          return;
        }
        setState({
          listings: data.listings,
          attribution: data.attribution ?? "",
          source: "live",
          errorMessage: null,
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        // Fallback to mocks · never leave the panel empty.
        setState({
          listings: MOCK_FOOD_LISTINGS,
          attribution: "",
          source: "fallback-mock",
          errorMessage: message,
        });
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filter?.category]);

  return state;
}
