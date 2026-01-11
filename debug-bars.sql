-- Debug: Check what bars exist in the database
SELECT 
    id,
    name,
    slug,
    active,
    created_at
FROM bars 
ORDER BY created_at DESC
LIMIT 20;

-- Also check for any bars with missing/empty slugs
SELECT 
    COUNT(*) as total_bars,
    COUNT(CASE WHEN slug IS NULL OR slug = '' THEN 1 END) as missing_slugs,
    COUNT(CASE WHEN slug IS NOT NULL AND slug != '' THEN 1 END) as with_slugs
FROM bars;
