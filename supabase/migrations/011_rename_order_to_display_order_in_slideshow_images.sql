BEGIN;

-- Add or migrate to `display_order` column on slideshow_images
DO $$
BEGIN
  -- If display_order already exists, do nothing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='slideshow_images' AND column_name='display_order'
  ) THEN

    -- If an old "order" column exists, copy values and remove it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_name='slideshow_images' AND column_name='order'
    ) THEN
      ALTER TABLE slideshow_images ADD COLUMN display_order INTEGER;
      UPDATE slideshow_images SET display_order = "order";

      -- Drop old unique constraint if named in legacy migrations
      ALTER TABLE slideshow_images DROP CONSTRAINT IF EXISTS slideshow_images_bar_id_order_key;

      -- Create new unique constraint on (bar_id, display_order)
      ALTER TABLE slideshow_images DROP CONSTRAINT IF EXISTS slideshow_images_bar_id_display_order_key;
      ALTER TABLE slideshow_images ADD CONSTRAINT slideshow_images_bar_id_display_order_key UNIQUE (bar_id, display_order);

      -- Replace index on (bar_id, "order") with display_order
      DROP INDEX IF EXISTS idx_slideshow_images_bar_order;
      CREATE INDEX IF NOT EXISTS idx_slideshow_images_bar_display_order ON slideshow_images(bar_id, display_order);

      -- Remove the old "order" column
      ALTER TABLE slideshow_images DROP COLUMN IF EXISTS "order";

    ELSE
      -- No order column existed; just add display_order as NOT NULL with default
      ALTER TABLE slideshow_images ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE slideshow_images ADD CONSTRAINT slideshow_images_bar_id_display_order_key UNIQUE (bar_id, display_order);
      CREATE INDEX IF NOT EXISTS idx_slideshow_images_bar_display_order ON slideshow_images(bar_id, display_order);
    END IF;

  END IF;
END $$;

COMMIT;