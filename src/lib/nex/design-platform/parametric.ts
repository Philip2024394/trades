// Design Platform · Parametric Objects (BIM-style property propagation).
//
// One property change updates everything. Runtime is PURE: propagate() returns
// a new object · never mutates the input.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

export type ParametricProperty = string;

export type PropagationRule<Props extends Record<string, unknown> = Record<string, unknown>> = {
  from: ParametricProperty;
  to: readonly ParametricProperty[];
  compute: (source: unknown, current: Props) => Partial<Props>;
  reason: string;
};

export type ParametricObject<Props extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  kind: string;                          // e.g. "oak_staircase"
  properties: Props;
  rules: readonly PropagationRule<Props>[];
};

export type PropertyDelta<Props extends Record<string, unknown>> = {
  property: keyof Props;
  before: Props[keyof Props];
  after: Props[keyof Props];
};

/** Apply a property change · propagate through matching rules · returns a NEW
 *  ParametricObject with the composed property set + a log of every propagation. */
export function propagate<Props extends Record<string, unknown>>(obj: ParametricObject<Props>, delta: PropertyDelta<Props>): { next: ParametricObject<Props>; log: readonly string[] } {
  const log: string[] = [`primary: ${String(delta.property)} ${String(delta.before)} → ${String(delta.after)}`];
  const nextProps = { ...obj.properties, [delta.property]: delta.after };
  for (const rule of obj.rules) {
    if (rule.from !== delta.property) continue;
    const patch = rule.compute(delta.after, nextProps);
    Object.assign(nextProps, patch);
    for (const t of rule.to) {
      log.push(`propagate: ${String(delta.property)} → ${t} (${rule.reason})`);
    }
  }
  return {
    next: { ...obj, properties: nextProps },
    log,
  };
}

// ─── Example ready-made rules (staircase height → tread count · handrail length · LED length) ─

export const STAIRCASE_HEIGHT_RULES: readonly PropagationRule<{
  height_mm: number;
  going_mm: number;
  tread_count: number;
  handrail_length_mm: number;
  led_length_mm: number;
}>[] = [
  {
    from: "height_mm",
    to: ["tread_count", "handrail_length_mm", "led_length_mm"],
    reason: "riser count derived from total height with target rise 190mm",
    compute: (h) => {
      const height = h as number;
      const treadCount = Math.max(1, Math.round(height / 190));
      // Handrail length ≈ hypot(rise, going) · going = treadCount * 250mm going.
      const goingTotal = treadCount * 250;
      const handrailLength = Math.round(Math.hypot(height, goingTotal));
      const ledLength = handrailLength;
      return { tread_count: treadCount, handrail_length_mm: handrailLength, led_length_mm: ledLength };
    },
  },
];
