// Shared prop types for the AI Visualiser storefront tiles + flow.

export type AiVisualiserLeaf = {
  slug: string;
  display_name: string;
  synonyms: string[];
};

export type AiVisualiserTilePropsBase = {
  /** Merchant this Visualiser instance belongs to. Every render + lead
   *  captured through this tile is attached to this merchant. */
  merchantId: string;

  /** The catalogue leaves this merchant has ticked. Empty = don't
   *  render (or render an "install" placeholder in preview mode). */
  scope: AiVisualiserLeaf[];

  /** Marketing headline noun to use in the tile copy. Defaults to the
   *  first leaf's display_name (e.g. "kitchen"). */
  headlineNoun?: string;

  /** Preview image shown on the tile. Should be a real photo of a
   *  finished install from this merchant when available. Rendered with
   *  object-cover as it's a hero background (the exception to the
   *  global object-contain rule). */
  previewImageUrl?: string;

  /** Called when the customer taps "Try it — free". Parent opens the
   *  contact-capture → upload → design-tree flow. In preview / demo
   *  mode this may be a no-op. */
  onLaunch?: () => void;

  /** Optional href — if supplied, tile renders as a link and overrides
   *  onLaunch. Useful for gold-path where the CTA is a route push. */
  href?: string;

  /** Preview mode disables the launch action (for Studio editing). */
  preview?: boolean;

  className?: string;
};
