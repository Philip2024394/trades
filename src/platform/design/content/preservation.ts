// Xrated Design System — content preservation on component replacement.
//
// When a merchant swaps a Design System component in Studio (change
// button, change card, change hero), we want to preserve as much as
// possible:
//   • Same category + same shape → props + content survive
//   • Same shape, different category → content survives, props reset
//   • Different shape → best-effort field mapping via CROSS_SHAPE_MAP
//
// The result: a merchant experimenting with different card layouts
// never loses their photo, title, or CTA link. Design changes; content
// stays theirs.

import type {
  ContentShape,
  DesignComponentInstance,
  FrozenDesignComponent
} from "../types";

export type PreservationResult = {
  instance: DesignComponentInstance;
  /** Which content fields survived the swap. Empty means starter
   *  content only. Studio surfaces this to the merchant so they
   *  know what was preserved. */
  preservedFields: string[];
  /** Which content fields from the old instance couldn't be mapped
   *  onto the new component's shape. Studio flags these as "these
   *  fields were dropped — undo to restore". */
  droppedFields: string[];
};

/** Compute the replacement instance when swapping `from` → `to` on an
 *  existing instance. Content preservation follows the rules above. */
export function applyReplacement(
  from: FrozenDesignComponent,
  to: FrozenDesignComponent,
  existing: DesignComponentInstance
): PreservationResult {
  const newDefaults = {
    props: to.defaultProps(),
    content: to.defaultContent()
  };

  // Props: only preserved for same-category swaps. Different categories
  // have different prop semantics — a Button's `size` doesn't map onto
  // a Card's `padding`.
  const preservedProps =
    from.category === to.category
      ? { ...newDefaults.props, ...existing.props }
      : newDefaults.props;

  // Content: preservation depends on shape compatibility.
  const preserved: string[] = [];
  const dropped: string[] = [];
  let preservedContent: Record<string, unknown>;

  if (from.contentShape === to.contentShape) {
    // Perfect match — every field survives, defaults fill in gaps.
    preservedContent = { ...newDefaults.content, ...existing.content };
    for (const key of Object.keys(existing.content)) {
      if (existing.content[key] !== undefined) preserved.push(key);
    }
  } else {
    // Cross-shape swap — apply the mapper.
    const mapped = mapAcrossShapes(
      from.contentShape,
      to.contentShape,
      existing.content
    );
    preservedContent = { ...newDefaults.content, ...mapped.mapped };
    preserved.push(...Object.keys(mapped.mapped));
    dropped.push(...mapped.dropped);
  }

  return {
    instance: {
      id: to.id,
      props: preservedProps,
      content: preservedContent
    },
    preservedFields: preserved,
    droppedFields: dropped
  };
}

// ─── Cross-shape mapping ───────────────────────────────────────
//
// Conservative field mappings when the shapes differ. Nothing here is
// magic — it's declared field-by-field so a reader can see exactly
// what gets carried across.

type FieldMap = Record<string, string>;

const CROSS_SHAPE_MAP: Partial<
  Record<ContentShape, Partial<Record<ContentShape, FieldMap>>>
> = {
  typography: {
    button: { text: "label" },
    card: { text: "title" },
    section: { text: "heading" }
  },
  button: {
    typography: { label: "text" },
    card: { label: "actionLabel", href: "actionHref" }
  },
  card: {
    typography: { title: "text" },
    button: { actionLabel: "label", actionHref: "href" },
    section: {
      title: "heading",
      subtitle: "subheading",
      body: "body"
    },
    media: { image: "url" }
  },
  section: {
    typography: { heading: "text" },
    card: {
      heading: "title",
      subheading: "subtitle",
      body: "body"
    }
  },
  media: {
    card: { url: "image", caption: "body" }
  }
  // form, navigation, container — cross-shape mapping is not meaningful;
  // dropped fields flow through the default path.
};

function mapAcrossShapes(
  fromShape: ContentShape,
  toShape: ContentShape,
  existing: Record<string, unknown>
): { mapped: Record<string, unknown>; dropped: string[] } {
  const map = CROSS_SHAPE_MAP[fromShape]?.[toShape];
  if (!map) {
    return { mapped: {}, dropped: Object.keys(existing) };
  }
  const mapped: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [fromKey, toKey] of Object.entries(map)) {
    if (existing[fromKey] !== undefined) {
      mapped[toKey] = existing[fromKey];
    }
  }
  for (const key of Object.keys(existing)) {
    if (!map[key]) dropped.push(key);
  }
  return { mapped, dropped };
}
