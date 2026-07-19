"use client";

// InspirationImage — client component that renders the main hero
// image on the detail page. Same anti-casual-copy stance as the
// search feed: contextmenu / drag / selection blocked. Renders with
// explicit width/height so browser reserves the aspect-ratio box
// before bytes arrive (zero layout shift).

export function InspirationImage({
  src,
  alt,
  width,
  height
}: {
  src:    string;
  alt:    string;
  width:  number;
  height: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      loading="eager"
      fetchPriority="high"
      decoding="async"
      className="block h-auto w-full select-none"
    />
  );
}
