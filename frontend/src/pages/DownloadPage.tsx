import { useQuery } from '@tanstack/react-query'

const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER ?? 'sven-johnson'
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO ?? 'DM-Toolkit'

interface GitHubAsset {
  name: string
  browser_download_url: string
  size: number
}

interface GitHubRelease {
  tag_name: string
  name: string
  published_at: string
  body: string
  assets: GitHubAsset[]
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function findAsset(assets: GitHubAsset[], ext: string): GitHubAsset | undefined {
  return assets.find((a) => a.name.toLowerCase().endsWith(ext))
}

function useLatestRelease() {
  return useQuery<GitHubRelease>({
    queryKey: ['github-release', GITHUB_OWNER, GITHUB_REPO],
    queryFn: async () => {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      )
      if (res.status === 404) throw new Error('No releases yet.')
      if (!res.ok) throw new Error(`GitHub API error: ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

export function DownloadPage() {
  const { data: release, isLoading, error } = useLatestRelease()

  return (
    <div className="download-page">
      <div className="download-hero">
        <h1>DM Toolkit <span className="download-accent">VTT</span></h1>
        <p className="download-subtitle">
          A desktop Virtual Tabletop for your D&amp;D sessions — display maps,
          tokens and effects on a second screen or TV.
        </p>
      </div>

      <div className="download-card">
        {isLoading && (
          <p className="download-loading">Fetching latest release…</p>
        )}

        {error && (
          <p className="download-error">
            {error instanceof Error ? error.message : 'Could not load release info.'}
          </p>
        )}

        {release && (
          <>
            <div className="download-meta">
              <span className="download-version">{release.tag_name}</span>
              <span className="download-date">Released {formatDate(release.published_at)}</span>
            </div>

            <div className="download-platforms">
              {(() => {
                const mac = findAsset(release.assets, '.dmg')
                return (
                  <div className={`download-btn-wrap ${!mac ? 'download-btn-wrap--disabled' : ''}`}>
                    <a
                      className="download-btn"
                      href={mac?.browser_download_url}
                      download={mac?.name}
                      aria-disabled={!mac}
                      onClick={!mac ? (e) => e.preventDefault() : undefined}
                    >
                      <span className="download-btn-icon">🍎</span>
                      <span className="download-btn-label">
                        <strong>macOS</strong>
                        <small>Universal (Intel + Apple Silicon)</small>
                      </span>
                      {mac && (
                        <span className="download-btn-size">{formatBytes(mac.size)}</span>
                      )}
                    </a>
                    {!mac && <p className="download-na">Not yet available</p>}
                  </div>
                )
              })()}

              {(() => {
                const win = findAsset(release.assets, '.msi')
                return (
                  <div className={`download-btn-wrap ${!win ? 'download-btn-wrap--disabled' : ''}`}>
                    <a
                      className="download-btn"
                      href={win?.browser_download_url}
                      download={win?.name}
                      aria-disabled={!win}
                      onClick={!win ? (e) => e.preventDefault() : undefined}
                    >
                      <span className="download-btn-icon">🪟</span>
                      <span className="download-btn-label">
                        <strong>Windows</strong>
                        <small>x64 Installer (.msi)</small>
                      </span>
                      {win && (
                        <span className="download-btn-size">{formatBytes(win.size)}</span>
                      )}
                    </a>
                    {!win && <p className="download-na">Not yet available</p>}
                  </div>
                )
              })()}
            </div>

            {release.body && (
              <div className="download-notes">
                <h2>Release Notes</h2>
                <pre className="download-notes-body">{release.body}</pre>
              </div>
            )}

            <p className="download-all-link">
              <a
                href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`}
                target="_blank"
                rel="noreferrer"
              >
                View all releases on GitHub ↗
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
