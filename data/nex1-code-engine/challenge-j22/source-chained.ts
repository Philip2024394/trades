// J22 · fixture used for the chained-call adversarial test.
export function getBase(): { compute(): number } {
  return { compute: () => 5 };
}
