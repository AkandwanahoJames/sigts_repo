-- Align published cultural content with the Staying Safe guide body (not site nav only).
-- Source: https://www.bwindiimpenetrablenationalpark.com/travel-guide/staying-safe/

UPDATE cultural_narratives
SET published_at = NULL
WHERE title_en IN (
  'Nyundo trails and buffer-zone coexistence',
  'Rubuguri village songs at dusk',
  'Batwa forest memory at the heritage point'
);

UPDATE destination_info
SET content_en = content_en || ' (Trail geometry on the SIGTS map follows designated-path guidance from the official Staying Safe guide — confirm sectors with UWA.)'
WHERE title = 'Forest trail safety'
  AND content_en NOT LIKE '%SIGTS map%';
