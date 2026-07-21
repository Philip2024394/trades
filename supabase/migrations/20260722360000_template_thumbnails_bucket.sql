-- Storage bucket for admin-generated template preview PNGs. Public
-- read so the Templates drawer can render <img src=...> directly.
-- Writes go through the service role via
-- /api/admin/site-editor/template-thumbnail which enforces admin
-- auth, so no upstream RLS policy is needed on the bucket beyond
-- the default owner check.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('template-thumbnails', 'template-thumbnails', TRUE, 2097152)
ON CONFLICT (id) DO NOTHING;
