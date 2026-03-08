import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, SignInButton } from '@clerk/clerk-react'
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
}

const Navbar: React.FC<NavbarProps> = ({
  activeConflicts = 0,
  tensions = 0,
  onLiveViewClick,
  onSubscribeClick,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // ZULU Time Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    const local = date.toLocaleTimeString([], { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
    const zulu = date.toISOString().slice(11, 16)
    return { local, zulu }
  }

  const navigate = useNavigate()
  const { isSignedIn, signOut } = useAuth()
  const { data: notifications = [] } = useNotifications(false, { enabled: !!isSignedIn })
  const safeNotifications = Array.isArray(notifications) ? notifications : []
  const unreadCount = safeNotifications.filter((n) => !n.isRead).length

  return (
    <nav className="wo-navbar" id="navbar">
      {/* 1. LEFT: Identity & Status */}
      <div className="wo-navbar__left">
        <a href="/" className="wo-navbar__logo" aria-label="WatchOver Home">
          <span className="wo-navbar__logo-icon">◉</span>
          <span className="wo-navbar__logo-text">WATCHOVER</span>
        </a>
        <div className="wo-navbar__status">
          <div className="wo-navbar__clock mono">
            <span className="wo-navbar__time-local">{formatTime(currentTime).local}</span>
            <span className="wo-navbar__time-zulu">{formatTime(currentTime).zulu}Z</span>
          </div>
          <LiveIndicator size="sm" />
        </div>
      </div>

      {/* 2. CENTER: Navigation */}
      <div className="wo-navbar__center">
        <button className="wo-navbar__nav-link" onClick={onLiveViewClick}>
          LIVE FEED
        </button>
        <button className="wo-navbar__nav-link" onClick={() => navigate('/predictions')}>
          PREDICTIONS
        </button>
        <button className="wo-navbar__nav-link" onClick={() => navigate('/analytics')}>
          ANALYTICS
        </button>
      </div>

      {/* 3. RIGHT: Telemetry & Actions */}
      <div className={`wo-navbar__right ${mobileMenuOpen ? 'wo-navbar__right--open' : ''}`}>
        <div className="wo-navbar__telemetry">
          <div className="wo-navbar__telemetry-item">
            <span className="wo-navbar__telemetry-label">CONFLICTS</span>
            <AnimatedCounter
              value={activeConflicts}
              className="wo-navbar__telemetry-value mono text-red"
              duration={800}
            />
          </div>
          <div className="wo-navbar__telemetry-item">
            <span className="wo-navbar__telemetry-label">TENSION</span>
            <AnimatedCounter
              value={tensions}
              className="wo-navbar__telemetry-value mono text-yellow"
              duration={800}
            />
          </div>
        </div>

        <div className="wo-navbar__actions">
          <Button variant="cta" size="sm" onClick={onSubscribeClick}>
            SUBSCRIBE
          </Button>
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <Button variant="ghost" size="sm">
                SIGN IN
              </Button>
            </SignInButton>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              SIGN OUT
            </Button>
          )}

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
        </div>
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
