-- Test Supabase connection and storage bucket directly via SQL
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/bkaigyrrzsqbfscyznzw/sql

-- 1. Test if storage buckets table exists and check menu-files bucket
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets 
WHERE name = 'menu-files';

-- 2. Check storage policies for menu-files bucket
    SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
    FROM pg_policies 
    WHERE tablename = 'objects' 
    AND schemaname = 'storage'
    AND policyname LIKE '%menu%';

-- 3. Test if we can query the bars table (this tests database connection)
SELECT 
  id,
  menu_type,
  static_menu_url,
  static_menu_type,
  created_at
FROM bars 
LIMIT 5;

-- 4. Check if there are any existing menu files in storage
SELECT 
  name,
  bucket_id,
  created_at,
  updated_at,
  last_accessed_at,
  metadata
FROM storage.objects 
WHERE bucket_id = 'menu-files'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Test storage bucket permissions by trying to get bucket info
SELECT 
  b.id,
  b.name,
  b.public,
  COUNT(o.name) as file_count
FROM storage.buckets b
LEFT JOIN storage.objects o ON b.id = o.bucket_id
WHERE b.name = 'menu-files'
GROUP BY b.id, b.name, b.public;