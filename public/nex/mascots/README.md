# NEX Mascot Assets · drop zone

Place mascot artwork files in this folder (or a subfolder e.g. `pink-teddy/`,
`bunny/`, `robot/`). Then register each mascot in
`/data/nex-mascot-manifest.json` — the UI reads from that manifest at build
time. No code changes needed to add mascots.

## Manifest row shape

```json
{
  "id": "pink-teddy-01",
  "name": "Pink Teddy",
  "asset": "/nex/mascots/pink-teddy/01.png",
  "thumb": "/nex/mascots/pink-teddy/01.thumb.png",
  "category": "teddy",
  "tags": ["pink", "cute", "teddy", "love", "soft", "girl-theme"],
  "recommendedThemes": ["pink-metal"],
  "recommendedTagsMatch": ["pink", "cute"],
  "featured": true
}
```

## Field reference

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `id` | string | yes | Stable unique id · used for persistence. Never rename after ship. |
| `name` | string | yes | Display name in card hover / accessibility label. |
| `asset` | string | yes | Public path to full-res image. `.png` (with alpha), `.webp` or `.svg`. |
| `thumb` | string | no | Optional smaller image used in the grid. Falls back to `asset`. |
| `category` | string | yes | One of: `teddy`, `bunny`, `cat`, `dog`, `animal`, `person`, `fantasy`, `robot`, `creature`, `love`, `gaming`, `cute`, `funny`, `seasonal`. New categories require a code registration in `src/lib/nex-mascots/types.ts`. |
| `tags` | string[] | yes | Free-form searchable descriptors (`pink`, `soft`, `dark`, `festive`, `boy-theme`, etc.). Search + theme recommendation match against these. |
| `recommendedThemes` | string[] | no | Explicit theme IDs where this mascot appears first (e.g. `["pink-metal", "gold"]`). |
| `recommendedTagsMatch` | string[] | no | Subset of `tags` that should be given extra weight when scoring against a theme's tag set. |
| `featured` | boolean | no | Elevated to the top of the Recommended row regardless of theme when true. |

## Discovery order

1. `featured: true` mascots (once, no duplicates)
2. Mascots whose `recommendedThemes` includes the current theme id
3. Mascots whose `tags` overlap with the current theme's `mascot.recommendedTags`
4. Remainder (browse-all)

Every mascot is always available in Browse All · theme influences ordering,
never availability (spec section 5).

## Adding your first mascot

1. Drop `pink-teddy-01.png` (and optional thumb) into
   `public/nex/mascots/pink-teddy/`.
2. Append a row to `data/nex-mascot-manifest.json`.
3. Reload NEX · the mascot appears in the drawer automatically.
