// /creator · SSR redirect · Philip 2026-08-30 · Slice 2 · Golden Rule migration.
//
// Creator now lives INSIDE the NEX mobile shell as a Capability Surface
// (7 round-button tiles). This route exists only so external deep-links
// (bookmarks · older links) survive the migration. Server-side redirect
// fires BEFORE render, so users never see a standalone page.
//
// Canonical entry: /nexapp?cap=creator&view=entry
import { redirect } from "next/navigation";

export default function CreatorRedirect(): never {
  redirect("/nexapp?cap=creator&view=entry");
}
