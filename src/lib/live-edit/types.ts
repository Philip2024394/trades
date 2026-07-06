// Live-edit types — shared across the merchant page-edit surface.
//
// The pattern: any merchant-facing page wraps itself in <LiveEditShell>
// and marks each editable region with <EditableSection>. The shell
// provides an edit-mode toggle in a sticky footer, keeps a live draft
// state in memory, and (when the merchant hits Publish) writes the
// draft to Supabase so visitors see the published version.

export type EditableSectionType =
  | "hero"
  | "text"
  | "image"
  | "gallery"
  | "services"
  | "contact"
  | "custom";

export type EditableSectionMeta = {
  /** Stable slug — used as the key when persisting draft/publish state. */
  id: string;
  /** Section type — drives which editor UI opens when the merchant taps
   *  the section's edit button. Future sections can register new types. */
  type: EditableSectionType;
  /** Human label shown next to the section outline in edit mode. */
  label?: string;
};

/** Draft-vs-published state envelope for one merchant page. Each
 *  section's config is stored under its id. The shape of `config` is
 *  determined by the section type — hero uses HeroSlotState, text
 *  uses { headline, subhead, ctaLabel }, etc. */
export type MerchantPageState = {
  merchantId: string;
  pageSlug: string; // e.g. "landing", "about", "services"
  sections: Record<string, unknown>; // sectionId → config
  updatedAt: string;
  publishedAt: string | null;
};

export type PublishStatus = "clean" | "unsaved" | "publishing" | "published" | "error";
