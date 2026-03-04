import { useState, useEffect, useCallback } from 'react'
import './SmartDigest.css'

// =============================================
// Types
// =============================================

interface DigestData {
  date: string
  generatedAt: string
  headline: string
  body: string
  keyPoints: string[]
  threatLevel: 'critical' | 'elevated' | 'moderate' | 'low'
  regionsOfConcern: string[]
  eventsAnalyzed: number
  provider: string
}

// =============================================
// Component
// =============================================

const SmartDigest: React.FC = () => {
  const [digest, setDigest] = useState<DigestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const fetchDigest = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('http://localhost:3001/api/digest')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data: DigestData = await res.json()
      setDigest(data)
    } catch (err) {
      console.warn('[SmartDigest] API unavailable, using local fallback')
      setError('Digest API offline')

      // If API is not running, show a placeholder
      setDigest(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleRegenerate = useCallback(async () => {
    try {
      setRegenerating(true)
      const res = await fetch('http://localhost:3001/api/digest/generate', {
        method: 'POST',
      })
      if (res.ok) {
        const data: DigestData = await res.json()
        setDigest(data)
      }
    } catch {
      console.error('[SmartDigest] Regeneration failed')
    } finally {
      setRegenerating(false)
    }
  }, [])

  useEffect(() => {
    fetchDigest()

    // Refresh every 30 minutes
    const interval = setInterval(fetchDigest, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchDigest])

  const threatColors: Record<string, string> = {
    critical: 'var(--signal-red)',
    elevated: 'var(--signal-yellow)',
    moderate: 'var(--signal-blue)',
    low: 'var(--signal-green)',
  }

  const threatLabels: Record<string, string> = {
    critical: 'CRITICAL',
    elevated: 'ELEVATED',
    moderate: 'MODERATE',
    low: 'LOW',
  }

  // Loading state
  if (loading) {
    return (
      <div className="wo-smart-digest">
        <div className="wo-smart-digest__header">
          <div className="wo-smart-digest__icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="wo-smart-digest__title">Smart Digest</span>
          <span className="wo-smart-digest__loading-dot" />
        </div>
        <div className="wo-smart-digest__skeleton">
          <div className="wo-smart-digest__skeleton-line" style={{ width: '90%' }} />
          <div className="wo-smart-digest__skeleton-line" style={{ width: '75%' }} />
          <div className="wo-smart-digest__skeleton-line" style={{ width: '60%' }} />
        </div>
      </div>
    )
  }

  // Error / offline state
  if (error && !digest) {
    return (
      <div className="wo-smart-digest">
        <div className="wo-smart-digest__header">
          <div className="wo-smart-digest__icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="wo-smart-digest__title">Smart Digest</span>
        </div>
        <p className="wo-smart-digest__offline">
          AI briefing service offline. Run <code>npm run digest:serve</code> to start.
        </p>
      </div>
    )
  }

  if (!digest) return null

  const threatColor = threatColors[digest.threatLevel] || 'var(--text-muted)'

  // Format time
  const generatedDate = new Date(digest.generatedAt)
  const timeAgo = getTimeAgo(generatedDate)

  return (
    <div className={`wo-smart-digest ${expanded ? 'wo-smart-digest--expanded' : ''}`}>
      {/* Header row */}
      <div
        className="wo-smart-digest__header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setExpanded(!expanded) }}
      >
        <div className="wo-smart-digest__icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        <span className="wo-smart-digest__title">Smart Digest</span>

        {/* Threat level badge */}
        <span
          className="wo-smart-digest__threat-badge"
          style={{
            color: threatColor,
            borderColor: threatColor,
            background: `${threatColor}11`,
          }}
        >
          {threatLabels[digest.threatLevel]}
        </span>

        <span className="wo-smart-digest__time mono">{timeAgo}</span>

        <div className={`wo-smart-digest__chevron ${expanded ? 'wo-smart-digest__chevron--up' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Headline preview (always visible) */}
      <p className="wo-smart-digest__headline">{digest.headline}</p>

      {/* Expanded content */}
      {expanded && (
        <div className="wo-smart-digest__body">
          {/* Meta bar */}
          <div className="wo-smart-digest__meta">
            <span className="wo-smart-digest__meta-item">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {generatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="wo-smart-digest__meta-item">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                <line x1="4" y1="22" x2="4" y2="15" />
              </svg>
              {digest.eventsAnalyzed} events analyzed
            </span>
            <span className="wo-smart-digest__meta-item mono">
              via {digest.provider}
            </span>
          </div>

          {/* Key points */}
          <div className="wo-smart-digest__key-points">
            <h4 className="wo-smart-digest__section-title">Key Developments</h4>
            <ul className="wo-smart-digest__points-list">
              {digest.keyPoints.map((point, idx) => (
                <li key={idx} className="wo-smart-digest__point">
                  <span className="wo-smart-digest__point-dot" style={{ background: threatColor }} />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Regions of concern */}
          {digest.regionsOfConcern.length > 0 && (
            <div className="wo-smart-digest__regions">
              <h4 className="wo-smart-digest__section-title">Regions of Concern</h4>
              <div className="wo-smart-digest__region-tags">
                {digest.regionsOfConcern.map((region, idx) => (
                  <span key={idx} className="wo-smart-digest__region-tag">{region}</span>
                ))}
              </div>
            </div>
          )}

          {/* Full analysis */}
          <div className="wo-smart-digest__analysis">
            <h4 className="wo-smart-digest__section-title">Analysis</h4>
            <div className="wo-smart-digest__analysis-text">
              {digest.body.split('\n\n').map((paragraph, idx) => (
                <p key={idx} dangerouslySetInnerHTML={{ __html: renderMarkdownBold(paragraph) }} />
              ))}
            </div>
          </div>

          {/* Footer controls */}
          <div className="wo-smart-digest__footer">
            <button
              className="wo-smart-digest__refresh-btn"
              onClick={(e) => { e.stopPropagation(); handleRegenerate() }}
              disabled={regenerating}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={regenerating ? 'spinning' : ''}>
                <path d="M23 4v6h-6" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              {regenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
            <span className="wo-smart-digest__footer-note mono">
              Next refresh in ~{Math.max(1, Math.floor((6 * 60 - (Date.now() - generatedDate.getTime()) / 60000)))}m
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================
// Helpers
// =============================================

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function renderMarkdownBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

export default SmartDigest
