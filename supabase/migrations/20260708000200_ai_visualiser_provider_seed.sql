-- Seed placeholder provider rows so the admin panel already shows the
-- three known providers as "off, no key set". Admin later pastes the
-- key + enables one. Idempotent.

BEGIN;

INSERT INTO ai_visualiser_provider_config
  (provider_id, display_name, model_id, enabled, cost_per_render_pence)
VALUES
  ('openai-images', 'OpenAI (gpt-image-1)', 'gpt-image-1', false, 8),
  ('flux-1.1-pro', 'Flux 1.1 Pro (Replicate)', 'black-forest-labs/flux-1.1-pro', false, 5),
  ('nano-banana', 'Nano Banana', 'nano-banana', false, 4)
ON CONFLICT (provider_id) DO NOTHING;

COMMIT;
