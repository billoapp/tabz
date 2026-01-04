-- Slideshow images table
CREATE TABLE IF NOT EXISTS slideshow_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bar_id UUID REFERENCES bars(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(bar_id, display_order)
);

-- Add slideshow_settings column to bars table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='bars' AND column_name='slideshow_settings'
  ) THEN
    ALTER TABLE bars ADD COLUMN slideshow_settings JSONB DEFAULT '{
      "transitionSpeed": 3000
    }';
  END IF;
END $$;

-- Create storage buckets for menu images if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('menu-images', 'menu-images', true),
  ('menu-files', 'menu-files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS) for the new table
ALTER TABLE slideshow_images ENABLE ROW LEVEL SECURITY;

-- Create policy for slideshow images (only if user_bar_permissions exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_bar_permissions') THEN

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'Users can view slideshow images for their bar' AND tablename = 'slideshow_images'
    ) THEN
      EXECUTE '
        CREATE POLICY "Users can view slideshow images for their bar"
        ON slideshow_images FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM bars 
            WHERE bars.id = slideshow_images.bar_id 
            AND bars.id IN (
              SELECT bar_id FROM user_bar_permissions 
              WHERE user_id = auth.uid()
            )
          )
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage slideshow images for their bar' AND tablename = 'slideshow_images'
    ) THEN
      EXECUTE '
        CREATE POLICY "Users can manage slideshow images for their bar"
        ON slideshow_images FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM bars 
            WHERE bars.id = slideshow_images.bar_id 
            AND bars.id IN (
              SELECT bar_id FROM user_bar_permissions 
              WHERE user_id = auth.uid()
            )
          )
        )';
    END IF;

  END IF;
END $$;

-- Create storage policies (allow public read from either bucket)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Menu images are publicly accessible' AND schemaname = 'storage' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Menu images are publicly accessible"
    ON storage.objects FOR SELECT
    USING (bucket_id IN ('menu-images', 'menu-files'));
  END IF; 
END $$;

-- Create upload/update/delete policies only if user_bar_permissions exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='user_bar_permissions') THEN

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload menu images for their bar' AND schemaname = 'storage' AND tablename = 'objects'
    ) THEN
      EXECUTE '
        CREATE POLICY "Users can upload menu images for their bar"
        ON storage.objects FOR INSERT
        WITH CHECK (
          bucket_id IN (''menu-images'', ''menu-files'') AND
          auth.role() = ''authenticated'' AND
          (storage.foldername(name))[1] IN (
            SELECT bar_id::text FROM user_bar_permissions 
            WHERE user_id = auth.uid()
          )
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'Users can update menu images for their bar' AND schemaname = 'storage' AND tablename = 'objects'
    ) THEN
      EXECUTE '
        CREATE POLICY "Users can update menu images for their bar"
        ON storage.objects FOR UPDATE
        USING (
          bucket_id IN (''menu-images'', ''menu-files'') AND
          auth.role() = ''authenticated'' AND
          (storage.foldername(name))[1] IN (
            SELECT bar_id::text FROM user_bar_permissions 
            WHERE user_id = auth.uid()
          )
        )';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete menu images for their bar' AND schemaname = 'storage' AND tablename = 'objects'
    ) THEN
      EXECUTE '
        CREATE POLICY "Users can delete menu images for their bar"
        ON storage.objects FOR DELETE
        USING (
          bucket_id IN (''menu-images'', ''menu-files'') AND
          auth.role() = ''authenticated'' AND
          (storage.foldername(name))[1] IN (
            SELECT bar_id::text FROM user_bar_permissions 
            WHERE user_id = auth.uid()
          )
        )';
    END IF;

  END IF;
END $$;


-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_slideshow_images_bar_display_order ON slideshow_images(bar_id, display_order);
CREATE INDEX IF NOT EXISTS idx_slideshow_images_active ON slideshow_images(active);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger only if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_slideshow_images_updated_at'
      AND tgrelid = 'slideshow_images'::regclass
  ) THEN
    EXECUTE '
      CREATE TRIGGER update_slideshow_images_updated_at
      BEFORE UPDATE ON slideshow_images
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column()';
  END IF;
END $$;
