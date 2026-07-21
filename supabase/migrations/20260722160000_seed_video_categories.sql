-- Seed the 10 top-level video categories for Networkers TV.
-- Leaf taxonomy (kitchen → cabinets → hinges → Blum) comes in Phase 2
-- when we have real videos to classify against.

INSERT INTO hammerex_video_categories (slug, parent_slug, display_name, description, sort_order, trade_slugs)
VALUES
  ('plumbing',       NULL, 'Plumbing',        'Bathroom refits, boiler installs, drainage, wet-room work.',              10, ARRAY['plumber','gas-safe-engineer']),
  ('electrical',     NULL, 'Electrical',      'Rewires, consumer units, EV chargers, sockets, testing.',                 20, ARRAY['electrician']),
  ('carpentry',      NULL, 'Carpentry + joinery', 'Kitchens, staircases, doors, bespoke joinery, first + second fix.',    30, ARRAY['carpenter']),
  ('plastering',     NULL, 'Plastering',      'Skim, browning, wet render, drylining, heritage lime work.',              40, ARRAY['plasterer']),
  ('roofing',        NULL, 'Roofing',         'Pitched + flat roofs, slate, tile, EPDM, GRP, lead work.',                50, ARRAY['roofer']),
  ('brickwork',      NULL, 'Brickwork + masonry', 'Extensions, garden walls, chimney stacks, repointing, heritage.',     60, ARRAY['bricklayer']),
  ('tiling',         NULL, 'Tiling',          'Bathrooms, kitchens, wet-rooms, floors, natural stone, feature work.',    70, ARRAY['tiler']),
  ('landscaping',    NULL, 'Landscaping',     'Patios, decking, driveways, garden walls, planting, drainage.',           80, ARRAY['landscaper']),
  ('painting',       NULL, 'Painting + decorating', 'Interior + exterior, wallpaper, heritage, effect finishes.',        90, ARRAY['painter']),
  ('heat-pumps',     NULL, 'Heat pumps + renewables', 'Air-source, ground-source, solar PV, battery storage, retrofit.',100, ARRAY['gas-safe-engineer','plumber','electrician'])
ON CONFLICT (slug) DO NOTHING;
