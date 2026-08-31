// /network · SSR redirect · Philip 2026-08-30 · Slice 3 · Golden Rule migration.
//
// Network now lives INSIDE the NEX mobile shell as a Capability Surface
// (round-button tiles). This route exists only so external deep-links
// (bookmarks · older links) survive the migration. Server-side redirect
// fires BEFORE render, so users never see a standalone page.
//
// Canonical entry: /nexapp?cap=network&view=entry
import { redirect } from "next/navigation";

export default function NetworkRedirect(): never {
  redirect("/nexapp?cap=network&view=entry");
}
