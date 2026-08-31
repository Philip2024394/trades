// /tools · SSR redirect · Philip 2026-08-30 · Slice 1 · Golden Rule migration
//
// Tools now lives INSIDE the NEX mobile shell as a Capability Surface.
// This route exists only so external deep-links (bookmarks · emails · older
// links) survive the migration. Server-side redirect fires BEFORE render,
// so users never see a standalone /tools page.
//
// Canonical entry: /nexapp?cap=tools&view=entry
import { redirect } from "next/navigation";

export default function ToolsRedirect(): never {
  redirect("/nexapp?cap=tools&view=entry");
}
