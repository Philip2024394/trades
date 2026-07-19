"use client";

// EditableHeroImage — client wrapper around the hero <img> that
// listens for sitebook:hero-banner-change events (fired by
// EditBannerButton) and swaps its src instantly.
//
// Rendered inside the hero <section> in place of a plain <img>.

import { useEffect, useState } from "react";

export function EditableHeroImage({
  defaultUrl,
  alt = ""
}: {
  defaultUrl: string;
  alt?:       string;
}) {
  const [url, setUrl] = useState<string>(defaultUrl);

  useEffect(() => {
    function onChange(e: Event) {
      const { detail } = e as CustomEvent<{ url: string; id: string }>;
      if (detail?.url) setUrl(detail.url);
    }
    window.addEventListener("sitebook:hero-banner-change", onChange as EventListener);
    return () => window.removeEventListener("sitebook:hero-banner-change", onChange as EventListener);
  }, []);

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover opacity-75"
    />
  );
}
