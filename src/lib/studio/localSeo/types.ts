// Local SEO Pack — shared types.

export type LocalSeoBlock = {
  id: string;
  label: string;
  hint?: string;
  /** Text to copy — plain text unless format = "html". */
  content: string;
  format: "text" | "html" | "url";
  /** Character limit for the target channel (GMB 750 for description,
   *  1500 for posts, etc.). When set the UI shows a live counter. */
  charLimit?: number;
};

export type LocalSeoSection =
  | "description"
  | "services"
  | "posts"
  | "reviews";

export type LocalSeoPack = {
  section: LocalSeoSection;
  blocks: LocalSeoBlock[];
};
