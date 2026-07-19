// POST /api/store/lookup — cart hydration.
//
// Client sends an array of image ids; server returns minimal
// metadata (url, alt) for each. Keeps the client cart small (ids
// only in localStorage) but lets the cart page render thumbnails
// without shipping the full library.

import { NextResponse } from "next/server";
import { storeImageById } from "@/lib/storeLibrary.server";

export async function POST(req: Request) {
  let body: { ids?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ items: [] }); }

  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0) return NextResponse.json({ items: [] });

  const resolved = await Promise.all(ids.map((id) => storeImageById(id)));
  const items = resolved
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((e) => ({ id: e.id, url: e.url, alt: e.alt }));

  return NextResponse.json({ items });
}
