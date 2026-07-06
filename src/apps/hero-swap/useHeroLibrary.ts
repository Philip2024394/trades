// useHeroLibrary — React hook that fetches the merchant's matched
// hero images from /api/hero-library. Falls back to the static JSON
// if the fetch fails (offline / API down).
//
// This is the opt-in Supabase-first loader. The default useHeroSwap
// path still uses the static import for zero-config demos. Merchants
// with a real Supabase-backed platform switch by passing
// loaderMode="api" to HeroSwapSlot.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { matchImagesForMerchant } from "@/lib/hero-swap/library";
import type { HeroImage } from "@/lib/hero-swap/types";

export type HeroLibraryState = {
  images: HeroImage[];
  loading: boolean;
  error: string | null;
  source: "api" | "static-fallback" | "idle";
};

export type UseHeroLibraryOptions = {
  /** Merchant trade keywords — passed as ?keywords=a,b,c query. */
  merchantTradeKeywords: string[];
  /** Base URL. Defaults to same-origin /api/hero-library. */
  apiUrl?: string;
};

export function useHeroLibrary(
  options: UseHeroLibraryOptions
): HeroLibraryState {
  const [state, setState] = useState<HeroLibraryState>({
    images: [],
    loading: true,
    error: null,
    source: "idle"
  });

  // Stable keyword string for the dependency array (arrays would
  // trigger unnecessary re-fetches on each render otherwise)
  const keywordsKey = useMemo(
    () =>
      [...options.merchantTradeKeywords]
        .map((k) => k.toLowerCase().trim())
        .sort()
        .join("|"),
    [options.merchantTradeKeywords]
  );

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!keywordsKey) {
      setState({ images: [], loading: false, error: null, source: "idle" });
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const baseUrl = options.apiUrl ?? "/api/hero-library";
    const url = `${baseUrl}?keywords=${encodeURIComponent(keywordsKey.replaceAll("|", ","))}`;

    setState((s) => ({ ...s, loading: true, error: null }));

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`API responded ${res.status}`);
        const json = (await res.json()) as { images: HeroImage[] };
        if (controller.signal.aborted) return;
        setState({
          images: json.images,
          loading: false,
          error: null,
          source: "api"
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // Fall back to static JSON so the merchant sees something
        // useful even when the API is unreachable
        const fallback = matchImagesForMerchant(
          options.merchantTradeKeywords
        );
        setState({
          images: fallback,
          loading: false,
          error: err instanceof Error ? err.message : "Fetch failed",
          source: "static-fallback"
        });
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywordsKey, options.apiUrl]);

  return state;
}
