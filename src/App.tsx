import { Routes, Route, useNavigate } from 'react-router-dom'
import React, { useMemo, lazy, Suspense } from 'react'
import { DashboardLayout, Navbar, NewsTicker, PulseFeed, InteractiveGlobe, TensionChart, MOCK_TENSION_DATA, PredictionCard, MarketsModule, KeywordsModule, LazySection } from './components'
import type { TickerItem, Prediction, MarketEntry, KeywordEntry } from './components'
import type { WatchEvent } from './types'
import { useRealtimeDashboard } from './hooks'
import { useEvents } from './hooks/useQueries'
import './App.css'

// Lazy-loaded route pages — split into separate chunks for faster initial load
const PredictionsPage = lazy(() => import('./pages/PredictionsPage/PredictionsPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage/AnalyticsPage'))

// =============================================
// Mock Data — will be replaced by API calls
// =============================================

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

const MOCK_EVENTS: WatchEvent[] = [
  {
    id: '1',
    title: 'Military Aircraft Detected in Restricted Airspace',
    summary: 'Multiple fighter jets and surveillance aircraft detected operating near contested airspace. Increased military activity observed within 24 hours, with at least 12 sorties recorded by open-source tracking platforms. Regional air traffic control has issued NOTAMs for the affected zone.',
    region: 'Middle East',
    country: 'Iran',
    countryCode: 'IR',
    countryFlag: '🇮🇷',
    lat: 32.4279,
    lng: 53.6880,
    severity: 'high',
    sentiment: 'escalation',
    confidence: 94,
    category: 'Military',
    sources: [
      { name: 'Reuters', url: 'https://reuters.com', credibility: 95 },
      { name: 'FlightRadar24', url: 'https://flightradar24.com', credibility: 88 },
      { name: 'OSINT Aggregator', url: 'https://example.com', credibility: 72 },
    ],
    contradictions: 'Iranian state media denies any unusual military activity. Claims aircraft were conducting routine training exercises.',
    activityCount24h: 47,
    publishedAt: '2026-03-02T01:30:00Z',
    timeAgo: '2m ago',
  },
  {
    id: '2',
    title: 'Ceasefire Agreement Signed in Eastern Region',
    summary: 'Both parties have signed initial ceasefire terms following three weeks of intensive negotiations mediated by the UN Special Envoy. The agreement includes provisions for humanitarian corridors and prisoner exchanges within 72 hours.',
    region: 'Eastern Europe',
    country: 'Ukraine',
    countryCode: 'UA',
    countryFlag: '🇺🇦',
    lat: 48.3794,
    lng: 31.1656,
    severity: 'low',
    sentiment: 'de-escalation',
    confidence: 87,
    category: 'Diplomatic',
    sources: [
      { name: 'Associated Press', url: 'https://apnews.com', credibility: 96 },
      { name: 'BBC News', url: 'https://bbc.com', credibility: 94 },
    ],
    activityCount24h: 23,
    publishedAt: '2026-03-02T01:24:00Z',
    timeAgo: '8m ago',
  },
  {
    id: '3',
    title: 'Naval Fleet Mobilization Detected via Satellite',
    summary: 'Commercial satellite imagery reveals significant naval mobilization at multiple ports. At least 8 warships and 3 submarines have departed from home port, heading toward the contested maritime zone. This represents the largest naval deployment in the region in over 3 years.',
    region: 'Asia-Pacific',
    country: 'China',
    countryCode: 'CN',
    countryFlag: '🇨🇳',
    lat: 35.8617,
    lng: 104.1954,
    severity: 'high',
    sentiment: 'escalation',
    confidence: 76,
    category: 'Military',
    sources: [
      { name: 'Planet Labs', url: 'https://planet.com', credibility: 90 },
      { name: 'Jane\'s Defence', url: 'https://janes.com', credibility: 92 },
    ],
    contradictions: 'Official Chinese military spokesperson stated all naval activities are part of pre-planned annual exercises.',
    activityCount24h: 31,
    publishedAt: '2026-03-02T01:17:00Z',
    timeAgo: '15m ago',
  },
  {
    id: '4',
    title: 'Diplomatic Talks Resume After 6-Month Freeze',
    summary: 'High-level diplomatic talks have resumed between the two nations after a 6-month communication freeze. The meeting, held at a neutral venue, focused on border dispute resolution and trade normalization. Both sides described the atmosphere as "constructive."',
    region: 'East Asia',
    country: 'South Korea',
    countryCode: 'KR',
    countryFlag: '🇰🇷',
    lat: 35.9078,
    lng: 127.7669,
    severity: 'medium',
    sentiment: 'de-escalation',
    confidence: 82,
    category: 'Diplomatic',
    sources: [
      { name: 'Yonhap News', url: 'https://en.yna.co.kr', credibility: 88 },
      { name: 'NHK World', url: 'https://www3.nhk.or.jp', credibility: 91 },
    ],
    activityCount24h: 12,
    publishedAt: '2026-03-02T01:09:00Z',
    timeAgo: '23m ago',
  },
  {
    id: '5',
    title: 'Cyber Attack on Critical Power Grid Infrastructure',
    summary: 'A sophisticated cyber attack has targeted power grid infrastructure across three Baltic states simultaneously. The attack caused brief service disruptions affecting approximately 2 million residents. Attribution analysis points to a state-sponsored APT group.',
    region: 'Northern Europe',
    country: 'Estonia',
    countryCode: 'EE',
    countryFlag: '🇪🇪',
    lat: 58.5953,
    lng: 25.0136,
    severity: 'high',
    sentiment: 'escalation',
    confidence: 91,
    category: 'Cyber',
    sources: [
      { name: 'CERT-EU', url: 'https://cert.europa.eu', credibility: 94 },
      { name: 'Recorded Future', url: 'https://recordedfuture.com', credibility: 85 },
      { name: 'Estonian CERT', url: 'https://cert.ee', credibility: 93 },
    ],
    activityCount24h: 58,
    publishedAt: '2026-03-02T01:01:00Z',
    timeAgo: '31m ago',
  },
  {
    id: '6',
    title: 'Peacekeeping Forces Deployment Approved by Security Council',
    summary: 'The UN Security Council has approved the deployment of 5,000 peacekeeping forces to the conflict zone. The resolution passed with 14 votes in favor and 1 abstention. Forces are expected to begin deployment within 10 days.',
    region: 'Sub-Saharan Africa',
    country: 'Democratic Republic of Congo',
    countryCode: 'CD',
    countryFlag: '🇨🇩',
    lat: -4.0383,
    lng: 21.7587,
    severity: 'medium',
    sentiment: 'de-escalation',
    confidence: 88,
    category: 'Peacekeeping',
    sources: [
      { name: 'UN News', url: 'https://news.un.org', credibility: 97 },
      { name: 'Al Jazeera', url: 'https://aljazeera.com', credibility: 82 },
    ],
    activityCount24h: 15,
    publishedAt: '2026-03-02T00:47:00Z',
    timeAgo: '45m ago',
  },
  {
    id: '7',
    title: 'Cross-Border Artillery Exchange Reported',
    summary: 'Local sources report artillery exchanges along a disputed border region. At least 40 rounds were fired from both sides over a 3-hour period. No casualties have been confirmed, but civilian evacuations are underway in border villages.',
    region: 'South Asia',
    country: 'Pakistan',
    countryCode: 'PK',
    countryFlag: '🇵🇰',
    lat: 30.3753,
    lng: 69.3451,
    severity: 'high',
    sentiment: 'escalation',
    confidence: 69,
    category: 'Military',
    sources: [
      { name: 'Dawn News', url: 'https://dawn.com', credibility: 78 },
      { name: 'NDTV', url: 'https://ndtv.com', credibility: 80 },
    ],
    contradictions: 'Both sides claim the other initiated the exchange. Pakistan military says it was "retaliatory fire" while the opposing side calls it "unprovoked aggression."',
    activityCount24h: 34,
    publishedAt: '2026-03-02T00:32:00Z',
    timeAgo: '1h ago',
  },
  {
    id: '8',
    title: 'Economic Sanctions Package Announced Against Regional Power',
    summary: 'A coalition of Western nations has announced a comprehensive sanctions package targeting key sectors including energy, finance, and technology exports. The package includes asset freezes on 47 individuals and 12 corporate entities.',
    region: 'Global',
    country: 'United States',
    countryCode: 'US',
    countryFlag: '🇺🇸',
    lat: 38.9072,
    lng: -77.0369,
    severity: 'medium',
    sentiment: 'neutral',
    confidence: 95,
    category: 'Economic',
    sources: [
      { name: 'US Treasury Dept', url: 'https://treasury.gov', credibility: 99 },
      { name: 'Financial Times', url: 'https://ft.com', credibility: 93 },
    ],
    activityCount24h: 22,
    publishedAt: '2026-03-02T00:32:00Z',
    timeAgo: '1h ago',
  },
]

const MOCK_PREDICTIONS: Prediction[] = [
  { id: '1', question: 'Will there be a new ceasefire agreement by Q2 2026?', category: 'MIL', probability: 62, votes: 1847, timeLeft: '14d', trend: 'up', sparkline: [48, 52, 55, 58, 54, 60, 62] },
  { id: '2', question: 'Will NATO invoke Article 5 this year?', category: 'POL', probability: 8, votes: 3291, timeLeft: '89d', trend: 'stable', sparkline: [10, 9, 11, 8, 9, 8, 8] },
  { id: '3', question: 'Will oil prices exceed $120/barrel by March?', category: 'ECN', probability: 34, votes: 956, timeLeft: '28d', trend: 'down', sparkline: [45, 42, 40, 38, 36, 35, 34] },
  { id: '4', question: 'Will sanctions be lifted on Iran by 2027?', category: 'DIP', probability: 21, votes: 412, timeLeft: '180d', trend: 'up', sparkline: [15, 16, 18, 17, 19, 20, 21] },
]

const MOCK_MARKETS: MarketEntry[] = [
  { name: 'S&P 500', symbol: 'SPX', value: '5,234.18', change: '0.67%', isUp: true },
  { name: 'NASDAQ', symbol: 'NDX', value: '16,742.39', change: '0.23%', isUp: false },
  { name: 'Dow Jones', symbol: 'DJI', value: '39,142.23', change: '0.41%', isUp: true },
  { name: 'DAX', symbol: 'DAX', value: '18,456.12', change: '1.12%', isUp: true },
]

const MOCK_KEYWORDS: KeywordEntry[] = [
  { rank: 1, keyword: 'Iran', count: 2847, trend: 'up' },
  { rank: 2, keyword: 'Airspace', count: 1923, trend: 'up' },
  { rank: 3, keyword: 'Sanctions', count: 1654, trend: 'stable' },
  { rank: 4, keyword: 'NATO', count: 1432, trend: 'down' },
  { rank: 5, keyword: 'Ceasefire', count: 1201, trend: 'up' },
]

// =============================================
// App Component
// =============================================

function Dashboard() {
  // ---- Realtime Integration ----
  const {
    counters,
    realtimeEvents,
    unreadCount,
    markAllRead,
  } = useRealtimeDashboard({
    activeConflicts: 14,
    tensions: 23,
    aircraft: 1128,
    ships: 342,
  })

  // ---- Fetch real events from database API ----
  const { data: apiResponse } = useEvents(
    { limit: 50 },
    { refetchInterval: 30_000 }  // Re-fetch every 30s
  )

  // Convert API events to WatchEvent format
  const apiEvents = useMemo((): WatchEvent[] => {
    if (!apiResponse?.data?.length) return []

    return apiResponse.data.map((e) => {
      // Calculate relative time
      const now = Date.now()
      const published = new Date(e.publishedAt).getTime()
      const diffMs = now - published
      const diffMin = Math.floor(diffMs / 60_000)
      const diffHr = Math.floor(diffMs / 3_600_000)
      let timeAgo: string
      if (diffMin < 1) timeAgo = 'Just now'
      else if (diffMin < 60) timeAgo = `${diffMin}m ago`
      else if (diffHr < 24) timeAgo = `${diffHr}h ago`
      else timeAgo = `${Math.floor(diffHr / 24)}d ago`

      return {
        id: e.id,
        title: e.title,
        summary: e.summary || '',
        region: e.region || 'Global',
        country: e.country || e.region || 'Unknown',
        countryCode: e.countryCode || '',
        countryFlag: getCountryFlag(e.countryCode) || '🌍',
        lat: e.lat || 0,
        lng: e.lng || 0,
        severity: e.severity,
        sentiment: e.sentiment,
        confidence: e.confidence,
        category: e.category || 'General',
        sources: (e.sourceRefs || []).map(url => ({
          name: extractSourceName(url),
          url,
          credibility: 80,
        })),
        activityCount24h: 0,
        publishedAt: e.publishedAt,
        timeAgo,
      }
    })
  }, [apiResponse])

  // Merge: realtime WS events first → API events → fallback to mocks
  const allEvents = useMemo(() => {
    const seenIds = new Set<string>()
    const result: WatchEvent[] = []

    // 1. Realtime events first (newest)
    for (const e of realtimeEvents) {
      if (!seenIds.has(e.id)) {
        seenIds.add(e.id)
        result.push(e)
      }
    }

    // 2. API events (from database)
    for (const e of apiEvents) {
      if (!seenIds.has(e.id)) {
        seenIds.add(e.id)
        result.push(e)
      }
    }

    // 3. Only use mock events as fallback if we have nothing from the API
    if (result.length === 0) {
      return MOCK_EVENTS
    }

    return result
  }, [realtimeEvents, apiEvents])

  // Create ticker items from real events
  const tickerItems = useMemo((): TickerItem[] => {
    if (allEvents.length === 0) return MOCK_TICKER_ITEMS
    return allEvents.slice(0, 12).map(e => ({
      id: e.id,
      text: e.title,
      severity: e.severity === 'critical' ? 'high' : e.severity,
    }))
  }, [allEvents])

  return (
    <DashboardLayout
      navbar={
        <Navbar
          activeConflicts={counters.activeConflicts}
          tensions={counters.tensions}
        />
      }
      ticker={
        <NewsTicker items={tickerItems} speed={45} />
      }
      leftPanel={
        <>
          {unreadCount > 0 && (
            <div className="realtime-banner" onClick={markAllRead}>
              <span className="realtime-banner__dot" />
              {unreadCount} new event{unreadCount > 1 ? 's' : ''} — click to mark read
            </div>
          )}
          <PulseFeed events={allEvents} />
        </>
      }
      centerPanel={<CenterPanel events={allEvents} aircraft={counters.aircraft} />}
      rightPanel={<RightPanel />}
    />
  )
}

// Helper: Extract source name from URL
function extractSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname
    return hostname.replace('www.', '').split('.')[0]
  } catch {
    return 'Source'
  }
}

// Helper: Get flag emoji from country code
function getCountryFlag(code: string | null): string {
  if (!code || code.length < 2) return '🌍'
  const codeUpper = code.toUpperCase().slice(0, 2)
  const offset = 127397
  return String.fromCodePoint(
    ...Array.from(codeUpper).map(c => c.charCodeAt(0) + offset)
  )
}


// Suspense fallback for lazy-loaded pages
const PageLoader = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: 'var(--bg-base)',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    letterSpacing: '0.1em',
  }}>
    LOADING MODULE...
  </div>
)

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/predictions/:id" element={<PredictionsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
      </Routes>
    </Suspense>
  )
}

// =============================================
// Center Panel — Globe + Tension Chart (memoized)
// =============================================


const CenterPanel = React.memo(function CenterPanel({ events, aircraft }: { events: WatchEvent[]; aircraft: number }) {
  return (
    <div className="panel-center">
      <div className="globe-placeholder">
        <InteractiveGlobe events={events} showHeatmap={false} aircraft={aircraft} />
      </div>

      <TensionChart
        dataPoints={MOCK_TENSION_DATA}
        currentValue={67.4}
        change={2.3}
      />
    </div>
  )
})

// =============================================
// Right Panel — Predictions, Markets, Keywords
// =============================================

function RightPanel() {
  const navigate = useNavigate()

  return (
    <div className="panel-right">
      {/* Predictions — lazy loaded */}
      <LazySection placeholderHeight={280} rootMargin="400px">
        <section className="panel-section">
          <h3 className="panel-section__title">Top Predictions</h3>
          {MOCK_PREDICTIONS.map((pred) => (
            <PredictionCard
              key={pred.id}
              prediction={pred}
              onClick={(p) => navigate(`/predictions/${p.id}`)}
            />
          ))}
        </section>
      </LazySection>

      {/* Markets — lazy loaded */}
      <LazySection placeholderHeight={180} rootMargin="300px">
        <MarketsModule markets={MOCK_MARKETS} />
      </LazySection>

      {/* Keywords — lazy loaded */}
      <LazySection placeholderHeight={200} rootMargin="300px">
        <KeywordsModule
          keywords={MOCK_KEYWORDS}
          onKeywordClick={(kw) => console.log('Filter by keyword:', kw)}
        />
      </LazySection>
    </div>
  )
}

export default App
