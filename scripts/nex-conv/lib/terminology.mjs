// Canonical staircase-terminology definitions.
// Injected into the packet on ask_definition intents so Qwen 3B cannot wobble
// on the load-bearing terms (T15-type "base rail is vertical" mistake).
// One-liners are paraphrasable but the fact-content is non-negotiable.
// All definitions traceable to layer-2-drafts/staircase-string-types-and-construction-2026-08-15.md.

export const CANONICAL_DEFINITIONS = {
  // The four load-bearing string / riser terms · Philip's original knowledge doc.
  base_rail: {
    aliases: ['base rail', 'base-rail', 'shoe rail', 'sub rail', 'sub-rail'],
    definition: 'A base rail is a HORIZONTAL timber member that sits on TOP of a closed-string flight, into which the balusters land. It is present on closed-string flights and NOT on cut-string flights (on cut string the balusters land into the treads directly).',
    common_wrong: 'It is NOT a vertical board and it is NOT at the bottom of each tread.',
  },
  closed_string: {
    aliases: ['closed string', 'housed string', 'closed stringer', 'housed stringer'],
    definition: 'A closed string is a solid diagonal plank with a STRAIGHT top edge. Treads and risers slot into ROUTED HOUSINGS on the inner face and their ends are HIDDEN. A base rail sits on top of the string and the balusters land into the base rail.',
    common_wrong: 'The tread ends are NOT visible. It does NOT have a stepped top edge (that would be a cut string).',
  },
  cut_string: {
    aliases: ['cut string', 'open string', 'cut stringer', 'open stringer', 'cutstring', 'openstring'],
    definition: 'A cut string (also called an open string) is a diagonal plank whose top edge is CUT to a stepped / sawtooth profile that follows each tread and riser. Tread ends sit ON TOP and are VISIBLE (usually finished with a return moulding). Balusters land DIRECTLY into the treads · no base rail on the flight.',
    common_wrong: 'The tread ends are NOT hidden. This is DIFFERENT from open riser (which is about the vertical board between treads).',
  },
  open_riser: {
    aliases: ['open riser', 'open risers', 'riserless', 'no risers'],
    definition: 'Open riser means the vertical RISER BOARD between two treads has been OMITTED — you can see through between the treads. This is a separate concept from the string type: a staircase can have open risers with either a closed string or a cut string.',
    common_wrong: 'This is NOT the same as open string or cut string (those refer to the STRING\'s top edge).',
  },
  handrail_height: {
    aliases: ['handrail height', 'handrail height rule'],
    definition: 'UK Approved Document K (domestic) sets handrail height at 900mm–1000mm measured vertically above the pitch line of the flight (i.e. the line touching the nosings of the treads).',
    common_wrong: 'Not measured from the ground. Not measured from the tread surface. Not 800mm and not 1100mm.',
  },
  bullnose: {
    aliases: ['bullnose', 'bull nose', 'bullnose starting step', 'rounded bottom step'],
    definition: 'A bullnose is a starting step with a fully-rounded (half-round) outer profile that wraps around the newel post at the base of the flight. Common on traditional/Victorian oak staircases.',
    common_wrong: 'Not a nosing profile on every tread — bullnose refers specifically to the starting-step shape.',
  },
  nosing: {
    aliases: ['nosing', 'nose', 'tread nose', 'front edge'],
    definition: 'The nosing is the front edge of a tread that projects past the face of the riser below. UK Approved Doc K typically requires 15-25mm projection for domestic stairs.',
    common_wrong: 'Different from bullnose (which is a starting-step style, not a general edge profile).',
  },
  going: {
    aliases: ['going', 'tread depth', 'tread run'],
    definition: 'The going is the horizontal depth of a tread — measured from the front of one step to the front of the next. UK domestic minimum is 220mm (Approved Doc K), typical 230-260mm.',
    common_wrong: 'Not the height (that\'s the rise).',
  },
  rise: {
    aliases: ['rise', 'riser height'],
    definition: 'The rise is the vertical height between two consecutive treads. UK domestic max is 220mm (Approved Doc K), typical 180-200mm.',
    common_wrong: 'Not the tread depth (that\'s the going).',
  },
  tread_return: {
    aliases: ['tread return', 'return moulding', 'returned nose'],
    definition: 'A tread return is a small piece of matching timber glued and pinned to the exposed side of a cut-string tread — hides the end-grain with a mitered 45° corner. Only exists on cut-string builds (closed strings hide the tread end inside the string).',
    common_wrong: 'Not present on closed-string builds.',
  },
};

/** Given a customer message and the extracted entities, find any locked
 *  terms the customer is asking about definition-wise. Returns matching
 *  {slug, definition, common_wrong} entries in message order. */
export function findLockedTerms(customerMessage) {
  const text = (customerMessage || '').toLowerCase();
  const hits = [];
  for (const [slug, entry] of Object.entries(CANONICAL_DEFINITIONS)) {
    for (const alias of entry.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
        hits.push({ slug, alias_matched: alias, ...entry });
        break;
      }
    }
  }
  return hits;
}
