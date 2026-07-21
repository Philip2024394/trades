-- Seed the concrete job template. Adding a new trade in the future
-- = insert a similar row + build a matching calculator + KB pack.
-- Zero application code changes needed.

insert into hammerex_job_templates (
  slug, display_name, description, trade_slug, icon_slug,
  presets_json, qualifiers_json, calculator_ref,
  default_plugin_slugs, default_merchant_categories, default_trade_categories,
  requires_structural_engineer, sort_order
) values (
  'concrete',
  'Concrete work',
  'Driveways, patios, slabs, foundations, footings, workshop floors, retaining walls, steps, fence posts.',
  'concrete',
  'square',
  jsonb_build_array(
    jsonb_build_object('slug','driveway-car',           'display_name','Driveway (car)',                'default_thickness_mm',100, 'suggested_class','C28/35', 'reinforcement_default',true,  'building_control',false, 'above_ground',false, 'load_bearing',false),
    jsonb_build_object('slug','driveway-van',           'display_name','Driveway (van/light commercial)','default_thickness_mm',150,'suggested_class','C32/40', 'reinforcement_default',true,  'building_control',false, 'above_ground',false, 'load_bearing',false),
    jsonb_build_object('slug','patio',                  'display_name','Patio',                          'default_thickness_mm',100, 'suggested_class','C25',    'reinforcement_default',false, 'building_control',false, 'above_ground',false, 'load_bearing',false),
    jsonb_build_object('slug','garden-path',            'display_name','Garden path',                    'default_thickness_mm',75,  'suggested_class','C20',    'reinforcement_default',false, 'building_control',false, 'above_ground',false, 'load_bearing',false),
    jsonb_build_object('slug','shed-base',              'display_name','Shed base',                      'default_thickness_mm',100, 'suggested_class','C20',    'reinforcement_default',false, 'building_control',false, 'above_ground',false, 'load_bearing',false),
    jsonb_build_object('slug','garage-floor',           'display_name','Garage floor',                   'default_thickness_mm',150, 'suggested_class','C28/35', 'reinforcement_default',true,  'building_control',true,  'above_ground',false, 'load_bearing',false),
    jsonb_build_object('slug','workshop-floor',         'display_name','Workshop floor',                 'default_thickness_mm',200, 'suggested_class','C32/40', 'reinforcement_default',true,  'building_control',true,  'above_ground',false, 'load_bearing',false),
    jsonb_build_object('slug','house-floor-slab',       'display_name','House floor slab',               'default_thickness_mm',150, 'suggested_class','C28/35', 'reinforcement_default',true,  'building_control',true,  'above_ground',false, 'load_bearing',true),
    jsonb_build_object('slug','foundation-strip',       'display_name','Strip foundation',               'default_thickness_mm',225, 'suggested_class','C25',    'reinforcement_default',false, 'building_control',true,  'above_ground',false, 'load_bearing',true),
    jsonb_build_object('slug','foundation-trench',      'display_name','Trench-fill foundation',         'default_thickness_mm',800, 'suggested_class','C25',    'reinforcement_default',false, 'building_control',true,  'above_ground',false, 'load_bearing',true),
    jsonb_build_object('slug','retaining-wall-footing', 'display_name','Retaining wall footing',         'default_thickness_mm',300, 'suggested_class','C32/40', 'reinforcement_default',true,  'building_control',true,  'above_ground',false, 'load_bearing',true),
    jsonb_build_object('slug','concrete-steps',         'display_name','Concrete steps',                 'default_thickness_mm',100, 'suggested_class','C25',    'reinforcement_default',true,  'building_control',false, 'above_ground',true,  'load_bearing',true),
    jsonb_build_object('slug','fence-posts',            'display_name','Fence post foundations',         'default_thickness_mm',600, 'suggested_class','C20',    'reinforcement_default',false, 'building_control',false, 'above_ground',false, 'load_bearing',false)
  ),
  jsonb_build_array(
    jsonb_build_object('key','vehicle_weight',        'label','Will any vehicle drive on it?', 'kind','choice', 'options', jsonb_build_array(
      jsonb_build_object('value','none',  'label','No vehicles'),
      jsonb_build_object('value','car',   'label','Car'),
      jsonb_build_object('value','van',   'label','Van / light commercial'),
      jsonb_build_object('value','truck', 'label','Truck / heavy'),
      jsonb_build_object('value','plant', 'label','Plant / machinery')
    )),
    jsonb_build_object('key','soft_ground',           'label','Is the ground soft, made-up, or clay?', 'kind','boolean'),
    jsonb_build_object('key','reinforcement_planned', 'label','Do you plan to use steel mesh reinforcement?', 'kind','boolean'),
    jsonb_build_object('key','ready_mix_preferred',   'label','Prefer ready-mix delivery (vs mixing on site)?', 'kind','boolean'),
    jsonb_build_object('key','pump_required',         'label','Does the pour need a concrete pump (limited access)?', 'kind','boolean'),
    jsonb_build_object('key','above_ground',          'label','Is this above ground level (upper-floor slab)?', 'kind','boolean'),
    jsonb_build_object('key','load_bearing',          'label','Will this carry a load-bearing structural element (wall, beam)?', 'kind','boolean')
  ),
  'concrete',
  array['knowledge','recommender','videos','weather','photos','journal']::text[],
  array['building-merchant','concrete-supplier','builders-supplies','aggregate-supplier','plant-hire']::text[],
  array['bricklayer','groundworker','driveway-installer','concrete-specialist','concrete-contractor','structural-engineer']::text[],
  false,
  10
)
on conflict (slug) do update set
  display_name                = excluded.display_name,
  description                 = excluded.description,
  trade_slug                  = excluded.trade_slug,
  icon_slug                   = excluded.icon_slug,
  presets_json                = excluded.presets_json,
  qualifiers_json             = excluded.qualifiers_json,
  calculator_ref              = excluded.calculator_ref,
  default_plugin_slugs        = excluded.default_plugin_slugs,
  default_merchant_categories = excluded.default_merchant_categories,
  default_trade_categories    = excluded.default_trade_categories,
  requires_structural_engineer = excluded.requires_structural_engineer,
  sort_order                  = excluded.sort_order;
