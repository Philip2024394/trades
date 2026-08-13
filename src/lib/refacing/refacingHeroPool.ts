// Refacing Companies · hero image pool (Philip 2026-08-13).
//
// Pool of 15 free ImageKit hero images assigned to Refacing Company cards
// that have NOT been claimed or that have no owner-uploaded image yet.
//
// Rules (Philip 2026-08-13):
//   1. Assignment is random per page render (rotates on refresh)
//   2. No two visible cards ever show the same image at once (unique assignment)
//   3. When a merchant claims + uploads their own image → their upload wins;
//      pool never overrides a genuine merchant upload
//   4. Extend by adding URLs to the array below · order doesn't matter
//
// Uniqueness guarantee: if we have MORE cards than pool images, the surplus
// falls back to the gradient/Hammer placeholder already in the card component
// (never reuses a pool image on the same page render).

export const REFACING_HERO_POOL: readonly string[] = [
  "https://ik.imagekit.io/5vv5pw26q/Untitledfsdfsdfdsfsdfdf.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2002_40_29%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2002_32_31%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2002_26_01%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2002_20_14%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2002_13_16%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2002_04_49%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2002_04_17%20PM.png",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2011,%202026,%2012_26_29%20AM.png?updatedAt=1786382810507",
  "https://ik.imagekit.io/5vv5pw26q/Untitledsdsdww3.png?updatedAt=1786064796495",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%207,%202026,%2007_53_15%20AM.png?updatedAt=1786064010352",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%207,%202026,%2007_52_50%20AM.png?updatedAt=1786063985650",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%207,%202026,%2007_35_35%20AM.png?updatedAt=1786062953159",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%207,%202026,%2007_32_16%20AM.png?updatedAt=1786062755221",
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%207,%202026,%2007_23_59%20AM.png?updatedAt=1786062259781",
] as const;

/**
 * Assign a UNIQUE random pool image to each item in the input list.
 * · Shuffles the pool on every call (random each render).
 * · No two items get the same image in the same call.
 * · When the input list is longer than the pool, extras get `null` and the
 *   card component falls back to its gradient placeholder.
 * · Only mutates items that pass `shouldUsePool(item)` — merchant uploads
 *   and claimed accounts are preserved verbatim.
 */
export function assignRefacingHeroPool<T extends { hero_image_url?: string | null }>(
  items: T[],
  shouldUsePool: (item: T) => boolean = () => true,
): T[] {
  // Fisher-Yates shuffle a working copy of the pool.
  const shuffled = [...REFACING_HERO_POOL];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let poolIdx = 0;
  return items.map((item) => {
    if (!shouldUsePool(item)) return item;
    if (poolIdx >= shuffled.length) {
      // Pool exhausted · let the card render its gradient placeholder.
      return { ...item, hero_image_url: null };
    }
    return { ...item, hero_image_url: shuffled[poolIdx++] };
  });
}
