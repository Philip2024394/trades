// ChalkHeroDesktop — Template 1's desktop hero.
//
// Currently re-exports CanteenHeader from src/components/xrated/yard/.
// This file exists so Template 1 imports its desktop hero from its
// OWN folder. In a follow-up session the physical CanteenHeader
// content moves in here and the original file is deleted — real
// physical separation instead of symbolic re-export.
//
// Rule for future edits: any Chalk-desktop-hero change lands here.
// If you find yourself editing CanteenHeader.tsx directly, stop and
// move the file into this folder first, then edit.

export { CanteenHeader as ChalkHeroDesktop } from "@/components/xrated/yard/CanteenHeader";
