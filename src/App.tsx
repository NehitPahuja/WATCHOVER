import { DashboardLayout, Navbar, NewsTicker, Badge, Card } from './components'
import type { TickerItem } from './components'
import './App.css'

// Mock Data — will be replaced by API calls

const MOCK_TICKER_ITEMS: TickerItem[] = [
  { id: '1', text: 'Military buildup reported near eastern border region', severity: 'high' },
  { id: '2', text: 'Ceasefire negotiations resume in Geneva', severity: 'low' },
  { id: '3', text: 'Cyber attack targets critical infrastructure in 3 nations', severity: 'high' },
  { id: '4', text: 'UN Security Council emergency session on regional tensions', severity: 'medium' },
  { id: '5', text: 'Naval exercises announced in South China Sea', severity: 'medium' },
  { id: '6', text: 'Aid convoy reaches besieged city after 45-day blockade', severity: 'low' },
  { id: '7', text: 'Diplomatic relations restored between former adversaries', severity: 'low' },
  { id: '8', text: 'Arms deal worth $2.3B signed between regional powers', severity: 'high' },
]

const MOCK_EVENTS = [
  { id: '1', title: 'Military Aircraft Detected in Restricted Airspace', severity: 'high' as const, sentiment: 'escalation' as const, confidence: 94, region: 'Middle East', time: '2m ago', country: '🇮🇷' },
  { id: '2', title: 'Ceasefire Agreement Signed in Eastern Region', severity: 'low' as const, sentiment: 'de-escalation' as const, confidence: 87, region: 'Eastern Europe', time: '8m ago', country: '🇺🇦' },
  { id: '3', title: 'Naval Fleet Mobilization Detected via Satellite', severity: 'high' as const, sentiment: 'escalation' as const, confidence: 76, region: 'Asia-Pacific', time: '15m ago', country: '🇨🇳' },
  { id: '4', title: 'Diplomatic Talks Resume After 6-Month Freeze', severity: 'medium' as const, sentiment: 'de-escalation' as const, confidence: 82, region: 'East Asia', time: '23m ago', country: '🇰🇷' },
  { id: '5', title: 'Cyber Attack on Power Grid Infrastructure', severity: 'high' as const, sentiment: 'escalation' as const, confidence: 91, region: 'Northern Europe', time: '31m ago', country: '🇪🇪' },
  { id: '6', title: 'Peacekeeping Forces Deployment Approved', severity: 'medium' as const, sentiment: 'de-escalation' as const, confidence: 88, region: 'Sub-Saharan Africa', time: '45m ago', country: '🇨🇩' },
  { id: '7', title: 'Cross-Border Artillery Exchange Reported', severity: 'high' as const, sentiment: 'escalation' as const, confidence: 69, region: 'South Asia', time: '1h ago', country: '🇵🇰' },
  { id: '8', title: 'Economic Sanctions Package Announced', severity: 'medium' as const, sentiment: 'neutral' as const, confidence: 95, region: 'Global', time: '1h ago', country: '🇺🇸' },
]

const MOCK_PREDICTIONS = [
  { id: '1', question: 'Will there be a new ceasefire agreement by Q2 2026?', category: 'MIL', probability: 62, votes: 1847, timeLeft: '14d', trend: 'up' as const },
  { id: '2', question: 'Will NATO invoke Article 5 this year?', category: 'POL', probability: 8, votes: 3291, timeLeft: '89d', trend: 'stable' as const },
  { id: '3', question: 'Will oil prices exceed $120/barrel by March?', category: 'ECN', probability: 34, votes: 956, timeLeft: '28d', trend: 'down' as const },
]

const MOCK_KEYWORDS = [
  { rank: 1, keyword: 'Iran', count: 2847 },
  { rank: 2, keyword: 'Airspace', count: 1923 },
  { rank: 3, keyword: 'Sanctions', count: 1654 },
  { rank: 4, keyword: 'NATO', count: 1432 },
  { rank: 5, keyword: 'Ceasefire', count: 1201 },
]

// App Component

function App() {
  return (
    <DashboardLayout
      navbar={
        <Navbar
          activeConflicts={14}
          tensions={23}
        />
      }
      ticker={
        <NewsTicker items={MOCK_TICKER_ITEMS} speed={45} />
      }
      leftPanel={<LeftPanel />}
      centerPanel={<CenterPanel />}
      rightPanel={<RightPanel />}
    />
  )
}

// Left Panel — Pulse Feed

function LeftPanel() {
  return (
    <div className="panel-left">
      <div className="panel-left__header">
        <h2 className="panel-title">Pulse Feed</h2>
        <div className="panel-left__filters">
          <button className="filter-tab filter-tab--active">All</button>
          <button className="filter-tab">High</button>
          <button className="filter-tab">24H</button>
          <button className="filter-tab filter-tab--esc">Escalation</button>
        </div>
      </div>

      <div className="panel-left__search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input type="text" placeholder="Search events..." className="search-input" />
      </div>

      <div className="panel-left__feed">
        {MOCK_EVENTS.map((event) => (
          <Card
            key={event.id}
            variant={event.sentiment === 'escalation' ? 'escalation' : event.sentiment === 'de-escalation' ? 'de-escalation' : 'default'}
            hoverable
            className="event-card"
          >
            <div className="event-card__top">
              <Badge severity={event.severity} dot>{event.severity.toUpperCase()}</Badge>
              <span className="event-card__time mono">{event.time}</span>
            </div>
            <div className="event-card__title">
              <span className="event-card__flag">{event.country}</span>
              {event.title}
            </div>
            <div className="event-card__meta">
              <span className="text-muted">{event.region}</span>
              <span className="mono" style={{ color: event.confidence >= 80 ? 'var(--signal-green)' : event.confidence >= 50 ? 'var(--signal-yellow)' : 'var(--signal-red)' }}>
                {event.confidence}%
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Center Panel — Globe Placeholder

function CenterPanel() {
  return (
    <div className="panel-center">
      <div className="globe-placeholder">
        <div className="globe-placeholder__ring" />
        <div className="globe-placeholder__ring globe-placeholder__ring--2" />
        <div className="globe-placeholder__ring globe-placeholder__ring--3" />
        <div className="globe-placeholder__label">
          <span className="globe-placeholder__icon">🌍</span>
          <span className="globe-placeholder__text">Globe Visualization</span>
          <span className="globe-placeholder__sub text-muted">MapLibre GL + deck.gl — Phase 1.4</span>
        </div>
      </div>

      {/* Bottom tenstion index placeholder */}
      <div className="tension-bar">
        <div className="tension-bar__left">
          <span className="tension-bar__label">Global Tension Index</span>
          <span className="tension-bar__value mono text-red">67.4</span>
          <span className="tension-bar__delta mono text-red">▲ 2.3%</span>
        </div>
        <div className="tension-bar__right">
          <span className="tension-bar__counter">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
            <span className="mono">847</span>
            <span className="text-muted">Aircraft</span>
          </span>
        </div>
      </div>
    </div>
  )
}

// Right Panel — Predictions, Markets, Keywords

function RightPanel() {
  return (
    <div className="panel-right">
      {/* Predictions */}
      <section className="panel-section">
        <h3 className="panel-section__title">Top Predictions</h3>
        {MOCK_PREDICTIONS.map((pred) => (
          <div key={pred.id} className="prediction-card">
            <div className="prediction-card__top">
              <Badge severity="info" size="sm">{pred.category}</Badge>
              <span className="prediction-card__meta mono text-muted">
                {pred.votes} votes · {pred.timeLeft}
              </span>
            </div>
            <p className="prediction-card__question">{pred.question}</p>
            <div className="prediction-card__bar-wrapper">
              <div className="prediction-card__bar">
                <div className="prediction-card__bar-fill" style={{ width: `${pred.probability}%` }} />
              </div>
              <span className="prediction-card__prob mono">{pred.probability}%</span>
            </div>
          </div>
        ))}
      </section>

      {/* Markets */}
      <section className="panel-section">
        <h3 className="panel-section__title">
          Markets
          <button className="panel-section__refresh" aria-label="Refresh markets">↻</button>
        </h3>
        <div className="markets-list">
          {[
            { name: 'S&P 500', value: '5,234.18', change: '+0.67%', up: true },
            { name: 'NASDAQ', value: '16,742.39', change: '-0.23%', up: false },
            { name: 'Dow Jones', value: '39,142.23', change: '+0.41%', up: true },
            { name: 'DAX', value: '18,456.12', change: '+1.12%', up: true },
          ].map((market) => (
            <div key={market.name} className="market-row">
              <span className="market-row__name">{market.name}</span>
              <span className="market-row__value mono">{market.value}</span>
              <span className={`market-row__change mono ${market.up ? 'text-green' : 'text-red'}`}>
                {market.change}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Keywords */}
      <section className="panel-section">
        <h3 className="panel-section__title">Top Keywords (24H)</h3>
        <div className="keywords-list">
          {MOCK_KEYWORDS.map((kw) => (
            <button key={kw.rank} className="keyword-row">
              <span className="keyword-row__rank mono text-muted">#{kw.rank}</span>
              <span className="keyword-row__word">{kw.keyword}</span>
              <span className="keyword-row__count mono text-muted">{kw.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export default App
