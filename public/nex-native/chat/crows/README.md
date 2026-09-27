# NEX Crow · Living Visual Asset

Photorealistic crow clips consumed by `_ambient-motion.tsx` as the environmental
motion layer over theme wallpapers. See Founder direction 2026-09-27.

## Acceptance standard

The clip must read as "a real crow filmed in the real world" — not a game
sprite, sticker, GIF, or obvious overlay. If it looks like a UI animation,
regenerate the source asset rather than compensating in code.

## Clip production spec

- **Format** · WebM VP9 with alpha channel (primary) · plus MP4 HEVC with
  alpha channel (for Safari iOS 14+ · falls back to WebM on other browsers).
- **Resolution** · 720 × 540 (4:3) or 800 × 600. Crow occupies ~40–70% of
  the frame with clear entry/exit margins for smooth cross-clip cuts.
- **Frame rate** · 60 fps for smooth wing motion. 30 fps acceptable if the
  source render is high quality.
- **Duration** · 3–8 seconds per clip. Not loops · each clip is a single
  self-contained flight segment.
- **Background** · fully transparent. No solid colour matte, no colour-key.
- **Motion blur** · baked into the render at natural intensity (not
  exaggerated).
- **Lighting** · neutral to warm ambient · the runtime blends the crow with
  the theme's ambient colour via CSS filters, so avoid strong colour cast
  in the source.

## Required clip types (fill in as you produce them)

Each type below can have multiple takes (different wing rhythms, minor path
variation). The orchestrator picks randomly. Aim for **at least two takes
per type** so the crow doesn't repeat itself within a session.

- `ltr-straight` · Left → Right cruise, level flight
- `ltr-diagonal-up` · Left → Right, rising
- `ltr-diagonal-down` · Left → Right, descending
- `ltr-banking` · Left → Right with a mid-clip bank/turn
- `rtl-straight` · Right → Left cruise
- `rtl-diagonal-up` · Right → Left, rising
- `rtl-diagonal-down` · Right → Left, descending
- `rtl-banking` · Right → Left with a mid-clip bank/turn
- `glide-short` · Brief glide (wings held) · shows non-flapping motion
- `close-fly-by` · Crow closer to camera · larger apparent size
- `distant-fly-by` · Crow farther from camera · smaller silhouette

## File naming

```
crow-<type>-<take>.webm     · WebM VP9 alpha
crow-<type>-<take>.mp4      · MP4 HEVC alpha (optional Safari fallback)
```

Examples:

```
crow-ltr-straight-01.webm
crow-ltr-straight-01.mp4
crow-ltr-diagonal-up-01.webm
crow-glide-short-02.webm
crow-close-fly-by-01.webm
```

## Registering clips in the manifest

Edit `manifest.json` in this directory. Add a `clips` entry per clip:

```json
{
  "clips": [
    {
      "id": "ltr-straight-01",
      "type": "ltr-straight",
      "src": {
        "webm": "/nex-native/chat/crows/crow-ltr-straight-01.webm",
        "mp4":  "/nex-native/chat/crows/crow-ltr-straight-01.mp4"
      },
      "duration_ms": 5200,
      "aspect_ratio": 1.333,
      "recommended_depth": [0.6, 1.0]
    }
  ]
}
```

Field notes:

- `type` · one of the clip types listed above · the orchestrator uses this
  to bias flight direction / vertical drift when composing an appearance.
- `duration_ms` · length of the source clip. The runtime doesn't loop
  individual clips within a single appearance · when a clip ends, the
  crow disappears. Longer clips = longer sightings.
- `recommended_depth` · `[min, max]` in 0–1 (0 = far, 1 = close). Optional.
  If provided, the orchestrator won't render this clip at a scale/blur
  outside the recommended range — useful for close-fly-by clips that
  would look wrong when scaled down and blurred.

The runtime fetches `manifest.json` on mount. If it's empty (`clips: []`),
the fallback SVG crow ships in its place · the surface never goes blank.

## Rarity target

The orchestrator schedules crow appearances every **3–8 minutes**, weighted
toward **solo** (80% of appearances are one crow). Users should think:
"wait — was that a real crow?" — not "another crow." Do not increase
frequency in code · scarcity is what makes the moment feel real.
