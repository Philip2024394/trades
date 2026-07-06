// Live Edit — public exports.

export { LiveEditShell } from "./LiveEditShell";
export type { LiveEditShellProps } from "./LiveEditShell";

export { EditableSection } from "./EditableSection";
export type { EditableSectionProps } from "./EditableSection";

export { EditableTextSection } from "./EditableTextSection";
export type { EditableTextSectionProps } from "./EditableTextSection";

export { EditableBeforeAfterSection } from "./EditableBeforeAfterSection";
export type { EditableBeforeAfterSectionProps } from "./EditableBeforeAfterSection";

export { EditableServicesSection } from "./EditableServicesSection";
export type {
  EditableServicesSectionProps,
  ServiceItem,
  ServiceIconKey
} from "./EditableServicesSection";

export { EditableGallerySection } from "./EditableGallerySection";
export type {
  EditableGallerySectionProps,
  GalleryImage
} from "./EditableGallerySection";

export { EditableContactSection } from "./EditableContactSection";
export type { EditableContactSectionProps } from "./EditableContactSection";

export {
  EditModeProvider,
  useEditMode,
  useEditModeOptional
} from "./EditModeContext";

export { StickyEditFooter } from "./StickyEditFooter";
