import { Link, useLocation, useNavigate } from 'react-router-dom'

export function Nav() {
  const location = useLocation()
  const navigate = useNavigate()

  // Extract campaignId from URL without relying on useParams (Nav is outside <Routes>)
  const campaignMatch = location.pathname.match(/^\/campaigns\/(\d+)/)
  const campaignId = campaignMatch ? campaignMatch[1] : null

  function isActive(path: string): boolean {
    return location.pathname.startsWith(path)
  }

  function handleLogout() {
    localStorage.removeItem('auth_token')
    navigate('/login')
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">DM Toolkit</Link>

        {campaignId && (
          <div className="nav-links">
            <Link
              to={`/campaigns/${campaignId}/sessions`}
              className={`nav-link${isActive(`/campaigns/${campaignId}/sessions`) ? ' active' : ''}`}
            >
              Sessions
            </Link>
            <Link
              to={`/campaigns/${campaignId}/storylines`}
              className={`nav-link${isActive(`/campaigns/${campaignId}/storylines`) ? ' active' : ''}`}
            >
              Storylines
            </Link>
            <Link
              to={`/campaigns/${campaignId}/characters`}
              className={`nav-link${isActive(`/campaigns/${campaignId}/characters`) ? ' active' : ''}`}
            >
              Characters
            </Link>
            <Link
              to={`/campaigns/${campaignId}/wiki`}
              className={`nav-link${isActive(`/campaigns/${campaignId}/wiki`) ? ' active' : ''}`}
            >
              Wiki
            </Link>
          </div>
        )}

        <div className="nav-actions">
          {campaignId && (
            <Link to="/" className="nav-link">
              ← Campaigns
            </Link>
          )}
          <Link
            to="/settings"
            className={`nav-link nav-settings${isActive('/settings') ? ' active' : ''}`}
            title="Settings"
          >
            ⚙
          </Link>
          <button className="nav-link nav-logout" type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    </nav>
  )
}
