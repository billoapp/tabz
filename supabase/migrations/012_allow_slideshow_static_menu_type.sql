-- Migration: Allow 'slideshow' as a valid value for bars.static_menu_type
-- Adds 'slideshow' to the CHECK constraint and preserves NULL as allowed value.

ALTER TABLE bars DROP CONSTRAINT IF EXISTS bars_static_menu_type_check;

ALTER TABLE bars
  ADD CONSTRAINT bars_static_menu_type_check
  CHECK (static_menu_type IS NULL OR static_menu_type IN ('pdf', 'image', 'slideshow'));

-- Optional: sanity-check existing rows (no-op unless violations exist)
-- SELECT id, static_menu_type FROM bars WHERE static_menu_type IS NOT NULL AND static_menu_type NOT IN ('pdf','image','slideshow');
