# NEX Knowledge Inbox — local store

Runtime data for `/nex-app/knowledge-inbox`. Everything here is per-machine
and gitignored; only this README is tracked so the directory exists on
fresh clones.

## Layout

```
data/knowledge-inbox/
  README.md            (this file)
  index.json           metadata for every inbox item (source of truth)
  stats.json           all-time processing totals (rolls forward on Process Inbox)
  content/<id>.txt     full text bodies from Quick Dump / notes
  files/<id>-<name>    uploaded binary files (docs, images, audio)
```

## Item shape

Each entry in `index.json` is:

```jsonc
{
  "id":            "nx_<base36-time>_<8-hex>",   // NEX-generated
  "title":         "…",                          // first-line or filename
  "kind":          "text" | "file" | "url" | "voice" | "image",
  "status":        "waiting" | "processing" | "review" | "processed",
  "source":        "chatgpt-approved" | "claude-generated" | "raw-research"
                 | "internet-article" | "needs-verification"
                 | "gov-standards" | "customer-qa" | "personal-ideas",
  "createdAt":     1785958862672,                 // epoch ms
  "createdAtIso":  "2026-08-05T19:41:02.672Z",
  "hash":          "<sha256 hex>",                // duplicate detection
  "meta":          "119 chars"                    // human-readable
  // + contentPath / filePath / originalFilename / byteSize / mimeType /
  //   url / processedAt / processedNotes as applicable
}
```

## Duplicate detection

`hash` is `sha256(content)` for text dumps, `sha256(file bytes)` for
uploads, `sha256(url)` for URL imports. On save, the storage layer checks
for a matching hash across all non-deleted items; if found, the existing
item is returned and the client shows a "duplicate" toast rather than
creating a second entry.

## Migration path

When this store graduates to Supabase / Postgres, `src/lib/nex/knowledge-inbox/storage.ts`
becomes the shim that reads/writes the DB instead. The API contract on
`/api/nex/knowledge-inbox/*` does not change.
