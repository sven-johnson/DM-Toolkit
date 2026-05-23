/**
 * Convert a local file path to a Tauri asset-protocol URL.
 *
 * `convertFileSrc` from @tauri-apps/api/core calls `encodeURIComponent` on the
 * entire path, which encodes both the Windows drive-letter colon (`C:` → `C%3A`)
 * and forward slashes (`/` → `%2F`). The asset server cannot resolve these URLs.
 *
 * `encodeURI` preserves `:` and `/` (they are safe URI characters) and only
 * encodes characters that are genuinely unsafe in a URL (spaces → `%20`, etc.),
 * producing the correct form: `http://asset.localhost/C:/Users/test%20file.png`
 */
export function toAssetUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const withoutLeadingSlash = normalized.startsWith('/')
    ? normalized.slice(1)
    : normalized
  const isWindows = navigator.userAgent.includes('Windows')
  const base = isWindows ? 'http://asset.localhost' : 'asset://localhost'
  return `${base}/${encodeURI(withoutLeadingSlash)}`
}
