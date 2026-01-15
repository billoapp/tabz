-- Create storage bucket for alert audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'alert-audio',
  'alert-audio',
  true,
  5242880, -- 5MB in bytes
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/x-wav']
) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload alert audio files
CREATE POLICY "Users can upload alert audio" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'alert-audio' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users to read alert audio files
CREATE POLICY "Users can read alert audio" ON storage.objects
FOR SELECT USING (
  bucket_id = 'alert-audio' AND
  auth.role() = 'authenticated'
);

-- Allow users to update their own alert audio files
CREATE POLICY "Users can update their alert audio" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'alert-audio' AND
  auth.role() = 'authenticated'
);

-- Allow users to delete their own alert audio files
CREATE POLICY "Users can delete their alert audio" ON storage.objects
FOR DELETE USING (
  bucket_id = 'alert-audio' AND
  auth.role() = 'authenticated'
);
