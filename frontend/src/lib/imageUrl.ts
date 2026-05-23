const R2_BASE = (
  (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ??
  'https://pub-626ae8c96a9f4cc886826f67f798185e.r2.dev'
).replace(/\/$/, '')

/** Construct the full CDN URL for an R2 object key. */
export function getImageUrl(objectKey: string): string {
  return `${R2_BASE}/${objectKey}`
}

/**
 * Extract the R2 object key from a full public URL.
 * Returns null if the URL is not from this R2 bucket (e.g. an external URL).
 */
export function getObjectKeyFromUrl(url: string): string | null {
  if (!url.startsWith(R2_BASE)) return null
  return url.slice(R2_BASE.length).replace(/^\//, '')
}
