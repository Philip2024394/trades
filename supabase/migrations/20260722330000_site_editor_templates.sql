-- Site Editor templates — curated pre-made compositions (frame +
-- overlay stack + optional starter image) merchants tap to
-- instantiate. Eliminates the blank-canvas paralysis; every trade
-- gets to a decent-looking post in ~10 seconds.
--
-- Categories:
--   quote            — a big text quote card ("Best in Manchester")
--   before-after     — split-composition template pre-configured
--   price-card       — headline price + call-to-action badge
--   promo            — sale / discount layout
--   testimonial      — customer quote with attribution
--   announcement     — "we're hiring" / "now booking" style
--
-- The state_json column stores the full EditorState the merchant
-- gets when they pick this template. Same shape as the drafts table
-- so we can copy → adjust → save with zero conversion.

CREATE TABLE IF NOT EXISTS public.hammerex_site_editor_templates (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  slug           TEXT          NOT NULL UNIQUE,
  label          TEXT          NOT NULL,
  category       TEXT          NOT NULL DEFAULT 'quote',
  frame_slug     TEXT          NOT NULL,

  -- Full EditorState snapshot — same JSONB shape drafts use.
  state_json     JSONB         NOT NULL,

  -- Optional preview thumbnail — used in the picker drawer. When
  -- null the picker renders the composition live (slower).
  thumbnail_url  TEXT,

  -- Per-tier gate. NULL = free-to-all. Any of {app_trial|app_paid|
  -- verified} restricts to that tier or higher.
  min_tier       TEXT,

  -- Curation controls.
  active         BOOLEAN       NOT NULL DEFAULT TRUE,
  display_order  INTEGER       NOT NULL DEFAULT 100,

  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT hammerex_editor_templates_category_check CHECK (
    category IN ('quote', 'before-after', 'price-card', 'promo', 'testimonial', 'announcement', 'other')
  )
);

CREATE INDEX IF NOT EXISTS idx_hammerex_editor_templates_active
  ON public.hammerex_site_editor_templates (category, display_order, created_at DESC)
  WHERE active = TRUE;

ALTER TABLE public.hammerex_site_editor_templates ENABLE ROW LEVEL SECURITY;

-- ─── Seed the initial 6 templates ────────────────────────────────
INSERT INTO public.hammerex_site_editor_templates (slug, label, category, frame_slug, state_json, display_order)
VALUES
  ('quote-big-white', 'Big quote (white)', 'quote', 'ig-feed', '{
    "version": 1,
    "frameSlug": "ig-feed",
    "mode": "single",
    "base": { "sourceImageId": null, "url": null, "offsetX": 0, "offsetY": 0, "scale": 1 },
    "layers": [
      {
        "id": "text-quote", "kind": "text", "z": 0,
        "x": 60, "y": 300, "rotation": 0, "opacity": 1,
        "text": "Your quote goes here",
        "fontSize": 64, "fontWeight": 800, "fontFamily": "playfair",
        "color": "#FFFFFF", "align": "center", "width": 600,
        "variant": "header",
        "effects": { "shadow": { "color": "rgba(0,0,0,0.7)", "blur": 8, "offsetX": 0, "offsetY": 3 } }
      }
    ]
  }'::jsonb, 10),

  ('price-headline', 'Price headline', 'price-card', 'ig-feed', '{
    "version": 1,
    "frameSlug": "ig-feed",
    "mode": "single",
    "base": { "sourceImageId": null, "url": null, "offsetX": 0, "offsetY": 0, "scale": 1 },
    "layers": [
      {
        "id": "text-from", "kind": "text", "z": 0,
        "x": 60, "y": 220, "rotation": 0, "opacity": 1,
        "text": "FROM",
        "fontSize": 36, "fontWeight": 700, "fontFamily": "poppins",
        "color": "#FFFFFF", "align": "center", "width": 600,
        "variant": "body"
      },
      {
        "id": "text-price", "kind": "text", "z": 1,
        "x": 60, "y": 280, "rotation": 0, "opacity": 1,
        "text": "£99",
        "fontSize": 180, "fontWeight": 800, "fontFamily": "poppins",
        "color": "#FFB300", "align": "center", "width": 600,
        "variant": "header",
        "effects": { "shadow": { "color": "rgba(0,0,0,0.8)", "blur": 12, "offsetX": 0, "offsetY": 4 } }
      },
      {
        "id": "text-cta", "kind": "text", "z": 2,
        "x": 60, "y": 500, "rotation": 0, "opacity": 1,
        "text": "GET A QUOTE",
        "fontSize": 32, "fontWeight": 700, "fontFamily": "poppins",
        "color": "#FFFFFF", "align": "center", "width": 600,
        "variant": "body",
        "effects": { "highlight": { "color": "#0A0A0A", "padding": 12 } }
      }
    ]
  }'::jsonb, 20),

  ('before-after-classic', 'Before / After', 'before-after', 'ig-portrait', '{
    "version": 1,
    "frameSlug": "ig-portrait",
    "mode": "beforeAfter",
    "base": { "sourceImageId": null, "url": null, "offsetX": 0, "offsetY": 0, "scale": 1 },
    "secondaryBase": { "sourceImageId": null, "url": null, "offsetX": 0, "offsetY": 0, "scale": 1 },
    "layers": []
  }'::jsonb, 30),

  ('promo-sale', 'Sale promo', 'promo', 'ig-feed', '{
    "version": 1,
    "frameSlug": "ig-feed",
    "mode": "single",
    "base": { "sourceImageId": null, "url": null, "offsetX": 0, "offsetY": 0, "scale": 1 },
    "layers": [
      {
        "id": "text-headline", "kind": "text", "z": 0,
        "x": 60, "y": 340, "rotation": 0, "opacity": 1,
        "text": "SALE",
        "fontSize": 200, "fontWeight": 800, "fontFamily": "poppins",
        "color": "#FFB300", "align": "center", "width": 600,
        "variant": "header",
        "effects": {
          "shadow": { "color": "rgba(0,0,0,0.8)", "blur": 10, "offsetX": 0, "offsetY": 4 },
          "outline": { "color": "#0A0A0A", "width": 3 }
        }
      },
      {
        "id": "text-percent", "kind": "text", "z": 1,
        "x": 60, "y": 560, "rotation": 0, "opacity": 1,
        "text": "Up to 20% off this week",
        "fontSize": 32, "fontWeight": 700, "fontFamily": "poppins",
        "color": "#FFFFFF", "align": "center", "width": 600,
        "variant": "body",
        "effects": { "shadow": { "color": "rgba(0,0,0,0.7)", "blur": 6, "offsetX": 0, "offsetY": 2 } }
      }
    ]
  }'::jsonb, 40),

  ('testimonial-card', 'Customer testimonial', 'testimonial', 'ig-portrait', '{
    "version": 1,
    "frameSlug": "ig-portrait",
    "mode": "single",
    "base": { "sourceImageId": null, "url": null, "offsetX": 0, "offsetY": 0, "scale": 1 },
    "layers": [
      {
        "id": "text-quote-mark", "kind": "text", "z": 0,
        "x": 60, "y": 200, "rotation": 0, "opacity": 1,
        "text": "“",
        "fontSize": 200, "fontWeight": 800, "fontFamily": "playfair",
        "color": "#FFB300", "align": "left", "width": 200,
        "variant": "header"
      },
      {
        "id": "text-body", "kind": "text", "z": 1,
        "x": 60, "y": 400, "rotation": 0, "opacity": 1,
        "text": "\"Absolute pros. Job done in a day, spotless finish.\"",
        "fontSize": 42, "fontWeight": 600, "fontFamily": "playfair",
        "color": "#FFFFFF", "align": "center", "width": 600,
        "variant": "body",
        "effects": { "shadow": { "color": "rgba(0,0,0,0.7)", "blur": 6, "offsetX": 0, "offsetY": 2 } }
      },
      {
        "id": "text-attrib", "kind": "text", "z": 2,
        "x": 60, "y": 700, "rotation": 0, "opacity": 1,
        "text": "— SARAH · MANCHESTER",
        "fontSize": 22, "fontWeight": 700, "fontFamily": "poppins",
        "color": "#FFB300", "align": "center", "width": 600,
        "variant": "body"
      }
    ]
  }'::jsonb, 50),

  ('announcement-hiring', 'Now hiring', 'announcement', 'ig-feed', '{
    "version": 1,
    "frameSlug": "ig-feed",
    "mode": "single",
    "base": { "sourceImageId": null, "url": null, "offsetX": 0, "offsetY": 0, "scale": 1 },
    "layers": [
      {
        "id": "text-now", "kind": "text", "z": 0,
        "x": 60, "y": 280, "rotation": 0, "opacity": 1,
        "text": "NOW HIRING",
        "fontSize": 88, "fontWeight": 800, "fontFamily": "poppins",
        "color": "#FFFFFF", "align": "center", "width": 600,
        "variant": "header",
        "effects": {
          "shadow": { "color": "rgba(0,0,0,0.8)", "blur": 10, "offsetX": 0, "offsetY": 4 },
          "highlight": { "color": "#166534", "padding": 16 }
        }
      },
      {
        "id": "text-role", "kind": "text", "z": 1,
        "x": 60, "y": 480, "rotation": 0, "opacity": 1,
        "text": "Experienced tradespeople",
        "fontSize": 36, "fontWeight": 600, "fontFamily": "poppins",
        "color": "#FFFFFF", "align": "center", "width": 600,
        "variant": "body",
        "effects": { "shadow": { "color": "rgba(0,0,0,0.7)", "blur": 4, "offsetX": 0, "offsetY": 2 } }
      },
      {
        "id": "text-cta", "kind": "text", "z": 2,
        "x": 60, "y": 620, "rotation": 0, "opacity": 1,
        "text": "DM to apply",
        "fontSize": 28, "fontWeight": 700, "fontFamily": "poppins",
        "color": "#0A0A0A", "align": "center", "width": 600,
        "variant": "body",
        "effects": { "highlight": { "color": "#FFB300", "padding": 10 } }
      }
    ]
  }'::jsonb, 60)

ON CONFLICT (slug) DO NOTHING;
