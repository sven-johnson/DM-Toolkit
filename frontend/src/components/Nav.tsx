import { Link, useLocation } from 'react-router-dom'

export function Nav() {
  const location = useLocation()

  function isActive(path: string): boolean {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <span className="nav-brand">DM Toolkit</span>
        <div className="nav-links">
          <Link
            to="/"
            className={`nav-link${isActive('/') ? ' active' : ''}`}
          >
            Sessions
          </Link>
          <Link
            to="/characters"
            className={`nav-link${isActive('/characters') ? ' active' : ''}`}
          >
            Characters
          </Link>
          <Link
            to="/rolls"
            className={`nav-link${isActive('/rolls') ? ' active' : ''}`}
          >
            Roll History
          </Link>
        </div>
      </div>
    </nav>
  )
}
