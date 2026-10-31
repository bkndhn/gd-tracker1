import { useState, useEffect } from 'react';
import { parseStorageUrl } from '@/utils/storageUtils';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to resolve a storage URL to a signed URL.
 * For non-Supabase URLs, returns the original URL.
 */
export function useSignedUrl(url: string | null | undefined): string {
  const [signedUrl, setSignedUrl] = useState<string>(url || '');

  useEffect(() => {
    if (!url) { setSignedUrl(''); return; }
    
    const parsed = parseStorageUrl(url);
    if (!parsed) { setSignedUrl(url); return; }

    let cancelled = false;
    supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, 300)
      .then(({ data, error }) => {
        if (!cancelled) {
          setSignedUrl(data?.signedUrl || url);
        }
      });

    return () => { cancelled = true; };
  }, [url]);

  return signedUrl;
}

/**
 * Hook to resolve multiple image URLs to signed URLs in batch.
 */
export function useSignedImageUrls(
  images: Array<{ id: string; image_url: string; image_name?: string }> | undefined
): Array<{ id: string; image_url: string; image_name?: string }> {
  const [resolved, setResolved] = useState(images || []);

  useEffect(() => {
    if (!images || images.length === 0) { setResolved([]); return; }

    // Group by bucket for batch signing
    const BUCKET_NAMES = ['gd-entry-images', 'gd-voice-notes', 'gd-images'];
    let cancelled = false;

    const resolve = async () => {
      const results = [...images];
      const bucketGroups: Record<string, { imgIdx: number; path: string }[]> = {};

      images.forEach((img, idx) => {
        for (const bucket of BUCKET_NAMES) {
          const publicPattern = `/storage/v1/object/public/${bucket}/`;
          const pubIdx = img.image_url.indexOf(publicPattern);
          if (pubIdx !== -1) {
            if (!bucketGroups[bucket]) bucketGroups[bucket] = [];
            bucketGroups[bucket].push({ imgIdx: idx, path: img.image_url.substring(pubIdx + publicPattern.length) });
            return;
          }
          // Also handle signed URL pattern
          const signPattern = `/storage/v1/object/sign/${bucket}/`;
          const signIdx = img.image_url.indexOf(signPattern);
          if (signIdx !== -1) {
            if (!bucketGroups[bucket]) bucketGroups[bucket] = [];
            const pathWithQuery = img.image_url.substring(signIdx + signPattern.length);
            bucketGroups[bucket].push({ imgIdx: idx, path: pathWithQuery.split('?')[0] });
            return;
          }
        }
      });

      await Promise.all(
        Object.entries(bucketGroups).map(async ([bucket, items]) => {
          const paths = items.map(i => i.path);
          const { data } = await supabase.storage
            .from(bucket)
            .createSignedUrls(paths, 300);
          if (data) {
            data.forEach((signed, idx) => {
              if (signed.signedUrl) {
                results[items[idx].imgIdx] = {
                  ...results[items[idx].imgIdx],
                  image_url: signed.signedUrl,
                };
              }
            });
          }
        })
      );

      if (!cancelled) setResolved(results);
    };

    resolve();
    return () => { cancelled = true; };
  }, [images]);

  return resolved;
}
