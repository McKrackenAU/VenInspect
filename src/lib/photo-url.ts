/**
 * Browser-safe photo URL helper.
 * `v=p1` busts Cloudflare/browser caches that may have stored 404s under the
 * old immutable Cache-Control on /api/uploads.
 */

export const PHOTO_URL_CACHE_BUST = "p1";

export function photoPublicUrl(relativePath: string): string {
  const encoded = relativePath
    .replace(/^[/\\]+/, "")
    .split(/[/\\]/)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `/api/uploads/${encoded}?v=${PHOTO_URL_CACHE_BUST}`;
}

/** Prefer gallery rows; fall back to legacy Defect.photoPath. */
export function primaryDefectPhotoPath(defect: {
  photoPath?: string | null;
  photos?: { path: string | null | undefined }[] | null;
}): string | null {
  const fromGallery = defect.photos?.find((p) => p.path?.trim())?.path?.trim();
  if (fromGallery) return fromGallery;
  const legacy = defect.photoPath?.trim();
  return legacy || null;
}
