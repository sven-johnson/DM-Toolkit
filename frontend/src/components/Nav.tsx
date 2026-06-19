import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCampaignIdMaybe, useCampaignRole } from '../context/CampaignContext'
import { useCurrentUser } from '../hooks/useCurrentUser'

export function Nav() {
  const location = useLocation()
  const navigate = useNavigate()
  const campaignId = useCampaignIdMaybe()
  const campaignRole = useCampaignRole()
  const { data: currentUser } = useCurrentUser()

  const isAdmin = currentUser?.is_admin ?? false
  const canSeeFullMenu = isAdmin || campaignRole === 'owner' || campaignRole === 'game_master'

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
            {canSeeFullMenu && (
              <>
                <Link
                  to="/sessions"
                  className={`nav-link${isActive('/sessions') ? ' active' : ''}`}
                >
                  Sessions
                </Link>
                <Link
                  to="/storylines"
                  className={`nav-link${isActive('/storylines') ? ' active' : ''}`}
                >
                  Storylines
                </Link>
                <Link
                  to="/characters"
                  className={`nav-link${isActive('/characters') ? ' active' : ''}`}
                >
                  Characters
                </Link>
                <Link
                  to="/monster-factory"
                  className={`nav-link${isActive('/monster-factory') ? ' active' : ''}`}
                >
                  Monster Factory
                </Link>
              </>
            )}
            <Link
              to="/locations"
              className={`nav-link${isActive('/locations') ? ' active' : ''}`}
            >
              Locations
            </Link>
            <Link
              to="/wiki"
              className={`nav-link${isActive('/wiki') ? ' active' : ''}`}
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
            to="/download"
            className={`nav-link${isActive('/download') ? ' active' : ''}`}
            title="Download the VTT desktop app"
          >
            Download VTT
          </Link>
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
