// shadcn/ui · Drawer — bottom-anchored drawer for mobile flows.
//
// Implemented as a Sheet with side="bottom" so we don't add another
// dep. Full-featured Vaul-based drawer can arrive later; for now
// consumers get the Sheet primitive with a Drawer alias.

"use client";

import {
  Sheet as Root,
  SheetTrigger,
  SheetClose,
  SheetContent as DrawerBottomContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription
} from "./sheet";

const Drawer = Root;
const DrawerTrigger = SheetTrigger;
const DrawerClose = SheetClose;
const DrawerHeader = SheetHeader;
const DrawerFooter = SheetFooter;
const DrawerTitle = SheetTitle;
const DrawerDescription = SheetDescription;

// Force bottom side by default; consumers can override via <SheetContent side="...">
function DrawerContent(props: React.ComponentPropsWithoutRef<typeof DrawerBottomContent>) {
  return <DrawerBottomContent side="bottom" {...props} />;
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription
};
