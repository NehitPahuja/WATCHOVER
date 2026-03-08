import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { useNotifications } from '../../hooks/useNotifications'
import { NotificationsPanel } from '../NotificationsPanel/NotificationsPanel'
import { LiveIndicator } from '../LiveIndicator'
import { AnimatedCounter } from '../AnimatedCounter'
import { Button } from '../Button'
import './Navbar.css'

interface NavbarProps {
  activeConflicts?: number
  tensions?: number
  onLiveViewClick?: () => void
  onSubscribeClick?: () => void
  onSignInClick?: () => void
}

const Navbar: React.FC<NavbarProps> = ({
  activeConflicts = 0,
  tensions = 0,
  onLiveViewClick,
  onSubscribeClick,
  onSignInClick,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const navigate = useNavigate()
  const { isSignedIn } = useAuth()
  const { data: notifications = [] } = useNotifications(false, { enabled: !!isSignedIn })
  const safeNotifications = Array.isArray(notifications) ? notifications : []
  const unreadCount = safeNotifications.filter((n) => !n.isRead).length

  return (
    <nav className="wo-navbar" id="navbar">
      {/* Left section — Logo + Counters */}
      <div className="wo-navbar__left">
        <a href="/" className="wo-navbar__logo" aria-label="WatchOver Home">
          <span className="wo-navbar__logo-icon">◉</span>
          <span className="wo-navbar__logo-text">WATCHOVER</span>
        </a>

        <div className="wo-navbar__divider" />

        <div className="wo-navbar__counters">
          <div className="wo-navbar__counter">
            <AnimatedCounter
              value={activeConflicts}
              className="wo-navbar__counter-value mono text-red wo-animated-counter--red"
              duration={800}
            />
            <span className="wo-navbar__counter-label">Active Conflicts</span>
          </div>
          <div className="wo-navbar__counter">
            <AnimatedCounter
              value={tensions}
              className="wo-navbar__counter-value mono text-yellow wo-animated-counter--yellow"
              duration={800}
            />
            <span className="wo-navbar__counter-label">Tensions</span>
          </div>
        </div>

        <div className="wo-navbar__divider" />

        <LiveIndicator size="sm" />
      </div>

      {/* Right section — Actions */}
      <div className={`wo-navbar__right ${mobileMenuOpen ? 'wo-navbar__right--open' : ''}`}>
        <Button variant="ghost" size="sm" onClick={onLiveViewClick}>
          Live View
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/predictions')}>
          Predictions
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/analytics')}>
          Analytics
        </Button>
        <Button variant="cta" size="sm" onClick={onSubscribeClick}>
          Subscribe
        </Button>
        <Button variant="ghost" size="sm" onClick={onSignInClick}>
          Sign In
        </Button>

        <button 
          className="wo-navbar__activity-pulse" 
          aria-label="Activity notifications"
          onClick={() => setNotificationsOpen(true)}
        >
          {unreadCount > 0 && <span className="wo-navbar__activity-dot" />}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </button>
        <NotificationsPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      </div>

      {/* Mobile hamburger */}
      <button
        className="wo-navbar__hamburger"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <span />
        <span />
        <span />
      </button>
    </nav>
  )
}

export default Navbar
