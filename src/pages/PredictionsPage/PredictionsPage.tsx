import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import './PredictionsPage.css'

// =============================================
// Types
// =============================================

export interface PredictionDetail {
  id: string
  question: string
  description: string
  category: string
  probability: number
  votes: number
  timeLeft: string
  closesAt: string
  status: 'active' | 'closed' | 'resolved'
  trend: 'up' | 'down' | 'stable'
  sparkline: number[]
  resolutionRules: string
  history: ProbabilityPoint[]
}

interface ProbabilityPoint {
  date: string
  value: number
}

interface ActivityEntry {
  id: string
  type: 'yes' | 'no' | 'system'
  text: string
  time: string
}

// =============================================
// Mock Data
// =============================================

const MOCK_PREDICTIONS_LIST: PredictionDetail[] = [
  {
    id: '1',
    question: 'Will there be a new ceasefire agreement by Q2 2026?',
    description: 'This prediction tracks the likelihood of any formal ceasefire agreement being signed in the ongoing Eastern European conflict before the end of Q2 2026. Ceasefire must be agreed upon by both primary belligerent parties and recognized by at least one international body (e.g., UN, OSCE).',
    category: 'MIL',
    probability: 62,
    votes: 1847,
    timeLeft: '14d 6h',
    closesAt: '2026-03-17T00:00:00Z',
    status: 'active',
    trend: 'up',
    sparkline: [48, 52, 55, 58, 54, 60, 62],
    resolutionRules: 'This prediction resolves YES if a formal ceasefire agreement is signed by both primary belligerent parties and acknowledged by at least one major international organization (UN, OSCE, EU) before June 30, 2026, 23:59 UTC. Temporary humanitarian ceasefires or unilateral declarations do not count. The agreement must include a defined cessation of hostilities for a minimum of 72 hours.',
    history: generateHistory(62, 90),
  },
  {
    id: '2',
    question: 'Will NATO invoke Article 5 this year?',
    description: 'Market on whether any NATO member state will trigger Article 5 (collective defense) during calendar year 2026. This would be only the second invocation since NATO\'s founding.',
    category: 'POL',
    probability: 8,
    votes: 3291,
    timeLeft: '89d',
    closesAt: '2026-06-01T00:00:00Z',
    status: 'active',
    trend: 'stable',
    sparkline: [10, 9, 11, 8, 9, 8, 8],
    resolutionRules: 'Resolves YES if any NATO member formally invokes Article 5 of the North Atlantic Treaty before December 31, 2026. The invocation must be officially confirmed by NATO\'s Secretary General or the North Atlantic Council.',
    history: generateHistory(8, 90),
  },
  {
    id: '3',
    question: 'Will oil prices exceed $120/barrel by March?',
    description: 'Tracks Brent Crude oil futures. The price must reach or exceed $120 USD per barrel at any point during March 2026 on any major exchange.',
    category: 'ECN',
    probability: 34,
    votes: 956,
    timeLeft: '28d',
    closesAt: '2026-03-31T00:00:00Z',
    status: 'active',
    trend: 'down',
    sparkline: [45, 42, 40, 38, 36, 35, 34],
    resolutionRules: 'Resolves YES if Brent Crude oil futures (front-month contract) reach or exceed $120.00 USD per barrel on any major commodity exchange at any point between March 1-31, 2026 UTC.',
    history: generateHistory(34, 90),
  },
  {
    id: '4',
    question: 'Will sanctions be lifted on Iran by 2027?',
    description: 'Tracks whether the US and/or EU will substantially lift or waive major economic sanctions against Iran. Partial or sectoral relief does not count — must cover at least 50% of currently sanctioned sectors.',
    category: 'DIP',
    probability: 21,
    votes: 412,
    timeLeft: '180d',
    closesAt: '2026-08-31T00:00:00Z',
    status: 'active',
    trend: 'up',
    sparkline: [15, 16, 18, 17, 19, 20, 21],
    resolutionRules: 'Resolves YES if the United States or the European Union formally lifts or waives at least 50% of currently active economic sanctions on Iran before January 1, 2027. Temporary waivers of less than 90 days do not qualify.',
    history: generateHistory(21, 90),
  },
]

function generateHistory(current: number, days: number): ProbabilityPoint[] {
  const points: ProbabilityPoint[] = []
  const now = new Date()
  let value = Math.max(5, Math.min(95, current - 15 + Math.random() * 10))

  for (let i = days; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const drift = (Math.random() - 0.48) * 3
    value = Math.max(2, Math.min(98, value + drift))
    points.push({
      date: d.toISOString().slice(0, 10),
      value: Math.round(value * 10) / 10,
    })
  }
  // ensure the last point = current
  points[points.length - 1].value = current
  return points
}

const MOCK_ACTIVITY: ActivityEntry[] = [
  { id: '1', type: 'yes', text: 'User voted YES (high confidence)', time: '2m ago' },
  { id: '2', type: 'no', text: 'User voted NO', time: '5m ago' },
  { id: '3', type: 'yes', text: '3 users voted YES', time: '12m ago' },
  { id: '4', type: 'system', text: 'Probability crossed 60% threshold', time: '28m ago' },
  { id: '5', type: 'no', text: 'User voted NO (low confidence)', time: '41m ago' },
  { id: '6', type: 'yes', text: '7 users voted YES', time: '1h ago' },
  { id: '7', type: 'system', text: 'Related event detected: Ceasefire talks resumed', time: '2h ago' },
  { id: '8', type: 'yes', text: 'User voted YES', time: '3h ago' },
]

// =============================================
// Probability Chart Component (D3)
// =============================================

const ProbabilityChart: React.FC<{
  data: ProbabilityPoint[]
  range: string
}> = ({ data, range }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 600, height: 260 })

  // Observe container size changes
  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width - 48 // padding
        setDimensions({ width: Math.max(200, w), height: 260 })
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Filtered data based on range
  const filteredData = useMemo(() => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : data.length
    return data.slice(-days)
  }, [data, range])

  useEffect(() => {
    if (!svgRef.current || filteredData.length < 2) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 20, right: 16, bottom: 32, left: 40 }
    const w = dimensions.width - margin.left - margin.right
    const h = dimensions.height - margin.top - margin.bottom

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleTime()
      .domain(d3.extent(filteredData, d => new Date(d.date)) as [Date, Date])
      .range([0, w])

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([h, 0])

    // Grid lines
    const yTicks = [0, 25, 50, 75, 100]
    yTicks.forEach(tick => {
      g.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', y(tick)).attr('y2', y(tick))
        .attr('stroke', 'rgba(255,255,255,0.04)')
        .attr('stroke-dasharray', tick === 50 ? 'none' : '2,4')
      g.append('text')
        .attr('x', -8).attr('y', y(tick))
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('fill', 'rgba(255,255,255,0.2)')
        .attr('font-size', '10px')
        .attr('font-family', '"JetBrains Mono", monospace')
        .text(`${tick}%`)
    })

    // 50% highlight line
    g.append('line')
      .attr('x1', 0).attr('x2', w)
      .attr('y1', y(50)).attr('y2', y(50))
      .attr('stroke', 'rgba(255,255,255,0.08)')

    // X-axis labels
    const xTicks = x.ticks(Math.min(6, filteredData.length))
    xTicks.forEach(tick => {
      g.append('text')
        .attr('x', x(tick))
        .attr('y', h + 20)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(255,255,255,0.2)')
        .attr('font-size', '10px')
        .attr('font-family', '"JetBrains Mono", monospace')
        .text(d3.timeFormat('%b %d')(tick))
    })

    // Area fill (gradient)
    const areaGradient = svg.append('defs').append('linearGradient')
      .attr('id', 'prob-area-gradient')
      .attr('x1', '0').attr('y1', '0')
      .attr('x2', '0').attr('y2', '1')
    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#00ff85').attr('stop-opacity', 0.15)
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#00ff85').attr('stop-opacity', 0)

    const area = d3.area<ProbabilityPoint>()
      .x(d => x(new Date(d.date)))
      .y0(h)
      .y1(d => y(d.value))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(filteredData)
      .attr('fill', 'url(#prob-area-gradient)')
      .attr('d', area)

    // Line
    const line = d3.line<ProbabilityPoint>()
      .x(d => x(new Date(d.date)))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX)

    const path = g.append('path')
      .datum(filteredData)
      .attr('fill', 'none')
      .attr('stroke', '#00ff85')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('d', line)

    // Animate the line drawing
    const totalLength = path.node()?.getTotalLength() || 0
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(1200)
      .ease(d3.easeCubicInOut)
      .attr('stroke-dashoffset', 0)

    // End dot
    const last = filteredData[filteredData.length - 1]
    g.append('circle')
      .attr('cx', x(new Date(last.date)))
      .attr('cy', y(last.value))
      .attr('r', 4)
      .attr('fill', '#00ff85')
      .attr('stroke', '#000')
      .attr('stroke-width', 2)

    // Glow on end dot
    g.append('circle')
      .attr('cx', x(new Date(last.date)))
      .attr('cy', y(last.value))
      .attr('r', 8)
      .attr('fill', 'none')
      .attr('stroke', '#00ff85')
      .attr('stroke-width', 1)
      .attr('opacity', 0.3)

    // Interactive overlay
    const overlay = g.append('rect')
      .attr('width', w)
      .attr('height', h)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .style('cursor', 'crosshair')

    const hoverLine = g.append('line')
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')
      .attr('y1', 0).attr('y2', h)
      .style('opacity', 0)

    const hoverDot = g.append('circle')
      .attr('r', 4)
      .attr('fill', '#00ff85')
      .attr('stroke', '#000')
      .attr('stroke-width', 2)
      .style('opacity', 0)

    const bisector = d3.bisector<ProbabilityPoint, Date>(d => new Date(d.date)).left

    overlay
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event)
        const dateAtMouse = x.invert(mx)
        const idx = bisector(filteredData, dateAtMouse, 1)
        const d0 = filteredData[idx - 1]
        const d1 = filteredData[idx]
        if (!d0) return
        const d = d1 && (dateAtMouse.getTime() - new Date(d0.date).getTime()) > (new Date(d1.date).getTime() - dateAtMouse.getTime()) ? d1 : d0
        const cx = x(new Date(d.date))
        const cy = y(d.value)

        hoverLine.attr('x1', cx).attr('x2', cx).style('opacity', 1)
        hoverDot.attr('cx', cx).attr('cy', cy).style('opacity', 1)

        if (tooltipRef.current) {
          tooltipRef.current.classList.remove('predictions-page__chart-tooltip--hidden')
          tooltipRef.current.style.left = `${cx + margin.left + 12}px`
          tooltipRef.current.style.top = `${cy + margin.top - 12}px`
          tooltipRef.current.innerHTML = `
            <div class="predictions-page__tooltip-date">${d.date}</div>
            <div class="predictions-page__tooltip-value">${d.value}% Yes</div>
          `
        }
      })
      .on('mouseleave', () => {
        hoverLine.style('opacity', 0)
        hoverDot.style('opacity', 0)
        if (tooltipRef.current) {
          tooltipRef.current.classList.add('predictions-page__chart-tooltip--hidden')
        }
      })
  }, [filteredData, dimensions])

  return (
    <div className="predictions-page__chart-container" ref={containerRef}>
      <svg
        ref={svgRef}
        className="predictions-page__chart-svg"
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      />
      <div
        ref={tooltipRef}
        className="predictions-page__chart-tooltip predictions-page__chart-tooltip--hidden"
      />
    </div>
  )
}

// =============================================
// Predictions List View
// =============================================

const PredictionsListView: React.FC<{
  predictions: PredictionDetail[]
  status: 'active' | 'resolved'
  onSelect: (id: string) => void
}> = ({ predictions, status, onSelect }) => {
  const filtered = predictions.filter(p =>
    status === 'active' ? p.status === 'active' : p.status !== 'active'
  )

  if (filtered.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-small)' }}>
          No {status} predictions
        </p>
      </div>
    )
  }

  return (
    <div className="predictions-page__list">
      {filtered.map((pred) => {
        const catLower = pred.category.toLowerCase()
        return (
          <div
            key={pred.id}
            className="predictions-page__list-card"
            onClick={() => onSelect(pred.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect(pred.id) }}
          >
            <div className={`predictions-page__list-category predictions-page__list-category--${catLower}`}>
              {pred.category}
            </div>
            <div className="predictions-page__list-info">
              <div className="predictions-page__list-question">{pred.question}</div>
              <div className="predictions-page__list-meta">
                <span>{pred.votes.toLocaleString()} votes</span>
                <span className="predictions-page__list-sep">·</span>
                <span>{pred.timeLeft} left</span>
                <span className="predictions-page__list-sep">·</span>
                <span className={pred.status === 'active' ? 'predictions-page__status-active' : 'predictions-page__status-resolved'}>
                  {pred.status.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="predictions-page__list-prob-bar">
              <div className="predictions-page__list-prob-track">
                <div
                  className="predictions-page__list-prob-fill"
                  style={{ width: `${pred.probability}%` }}
                />
              </div>
              <div className="predictions-page__list-prob-labels">
                <span className="predictions-page__list-prob-yes">{pred.probability}%</span>
                <span className="predictions-page__list-prob-no">{100 - pred.probability}%</span>
              </div>
            </div>
            <span className="predictions-page__list-arrow">→</span>
          </div>
        )
      })}
    </div>
  )
}

// =============================================
// Prediction Detail View
// =============================================

const PredictionDetailView: React.FC<{
  prediction: PredictionDetail
  allPredictions: PredictionDetail[]
  onNavigate: (id: string) => void
}> = ({ prediction, allPredictions, onNavigate }) => {
  const [chartRange, setChartRange] = useState('30d')
  const [voteChoice, setVoteChoice] = useState<'yes' | 'no' | null>(null)
  const [hasVoted, setHasVoted] = useState(false)

  const noProb = 100 - prediction.probability
  const catLower = prediction.category.toLowerCase()

  const handleVote = useCallback((choice: 'yes' | 'no') => {
    setVoteChoice(choice)
    setHasVoted(true)
  }, [])

  const relatedPredictions = allPredictions.filter(p => p.id !== prediction.id)

  return (
    <div className="predictions-page__content">
      {/* Main Column */}
      <div className="predictions-page__main">
        {/* Header */}
        <div className="predictions-page__header">
          <div className="predictions-page__tabs" style={{ marginBottom: '0', opacity: 0, height: 0, overflow: 'hidden' }}>
            {/* hidden, tab nav is in list mode */}
          </div>

          <span className={`predictions-page__category-badge predictions-page__category-badge--${catLower}`} style={{
            background: catLower === 'mil' ? 'var(--signal-red-dim)' : catLower === 'pol' ? 'var(--signal-blue-dim)' : catLower === 'ecn' ? 'var(--signal-yellow-dim)' : 'var(--signal-green-dim)',
            color: catLower === 'mil' ? 'var(--signal-red)' : catLower === 'pol' ? 'var(--signal-blue)' : catLower === 'ecn' ? 'var(--signal-yellow)' : 'var(--signal-green)',
            marginBottom: '12px',
            display: 'inline-flex',
          }}>
            {prediction.category}
          </span>

          <h1 className="predictions-page__title">{prediction.question}</h1>
          <p className="predictions-page__description">{prediction.description}</p>

          <div className="predictions-page__meta-row">
            <div className="predictions-page__meta-item">
              <span className="predictions-page__meta-icon">🗳️</span>
              <div>
                <div className="predictions-page__meta-label">Votes</div>
                <div className="predictions-page__meta-value">{prediction.votes.toLocaleString()}</div>
              </div>
            </div>
            <div className="predictions-page__meta-item">
              <span className="predictions-page__meta-icon">⏱️</span>
              <div>
                <div className="predictions-page__meta-label">Closes In</div>
                <div className="predictions-page__meta-value--yellow" style={{ fontWeight: 600 }}>{prediction.timeLeft}</div>
              </div>
            </div>
            <div className="predictions-page__meta-item">
              <span className="predictions-page__meta-icon">📊</span>
              <div>
                <div className="predictions-page__meta-label">Trend</div>
                <div className={`predictions-page__meta-value--${prediction.trend === 'up' ? 'green' : prediction.trend === 'down' ? 'red' : 'yellow'}`} style={{ fontWeight: 600 }}>
                  {prediction.trend === 'up' ? '↗ Rising' : prediction.trend === 'down' ? '↘ Falling' : '→ Stable'}
                </div>
              </div>
            </div>
            <div className="predictions-page__meta-item">
              <span className="predictions-page__meta-icon">🔴</span>
              <div>
                <div className="predictions-page__meta-label">Status</div>
                <div className="predictions-page__meta-value--green" style={{ fontWeight: 600 }}>{prediction.status.toUpperCase()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Probability Chart */}
        <div className="predictions-page__chart-section">
          <div className="predictions-page__chart-header">
            <span className="predictions-page__chart-title">Probability Timeline</span>
            <div className="predictions-page__chart-range">
              {['7d', '30d', '90d', 'All'].map(r => (
                <button
                  key={r}
                  className={`predictions-page__range-btn ${chartRange === r ? 'predictions-page__range-btn--active' : ''}`}
                  onClick={() => setChartRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <ProbabilityChart data={prediction.history} range={chartRange} />
        </div>

        {/* Probability Bar */}
        <div className="predictions-page__prob-section">
          <div className="predictions-page__prob-header">
            <span className="predictions-page__prob-title">Current Probability</span>
          </div>
          <div className="predictions-page__prob-bar">
            <div className="predictions-page__prob-yes" style={{ width: `${prediction.probability}%` }}>
              <span className="predictions-page__prob-label">Yes</span>
              <span className="predictions-page__prob-value">{prediction.probability}%</span>
            </div>
            <div className="predictions-page__prob-no" style={{ width: `${noProb}%` }}>
              {noProb >= 15 && (
                <>
                  <span className="predictions-page__prob-label">No</span>
                  <span className="predictions-page__prob-value">{noProb}%</span>
                </>
              )}
            </div>
          </div>
          <div className="predictions-page__prob-stats">
            <div className="predictions-page__prob-stat">
              <div className="predictions-page__prob-stat-label">Yes Votes</div>
              <div className="predictions-page__prob-stat-value" style={{ color: 'var(--signal-green)' }}>
                {Math.round(prediction.votes * prediction.probability / 100).toLocaleString()}
              </div>
            </div>
            <div className="predictions-page__prob-stat">
              <div className="predictions-page__prob-stat-label">No Votes</div>
              <div className="predictions-page__prob-stat-value" style={{ color: 'var(--signal-red)' }}>
                {Math.round(prediction.votes * noProb / 100).toLocaleString()}
              </div>
            </div>
            <div className="predictions-page__prob-stat">
              <div className="predictions-page__prob-stat-label">Total Votes</div>
              <div className="predictions-page__prob-stat-value">{prediction.votes.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Vote Section */}
        <div className="predictions-page__vote-section">
          <div className="predictions-page__vote-title">Cast Your Vote</div>
          {!hasVoted ? (
            <div className="predictions-page__vote-buttons">
              <button
                className={`predictions-page__vote-btn predictions-page__vote-btn--yes ${voteChoice === 'yes' ? 'predictions-page__vote-btn--selected' : ''}`}
                onClick={() => handleVote('yes')}
              >
                <span className="predictions-page__vote-icon">✓</span>
                <span className="predictions-page__vote-label">Yes</span>
              </button>
              <button
                className={`predictions-page__vote-btn predictions-page__vote-btn--no ${voteChoice === 'no' ? 'predictions-page__vote-btn--selected' : ''}`}
                onClick={() => handleVote('no')}
              >
                <span className="predictions-page__vote-icon">✕</span>
                <span className="predictions-page__vote-label">No</span>
              </button>
            </div>
          ) : (
            <div className="predictions-page__vote-submitted">
              <span className="predictions-page__vote-check">✓</span>
              <span className="predictions-page__vote-text">
                Vote recorded — You voted {voteChoice?.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Resolution Rules */}
        <div className="predictions-page__rules-section">
          <div className="predictions-page__rules-title">Resolution Rules</div>
          <div className="predictions-page__rules-box">
            {prediction.resolutionRules}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="predictions-page__sidebar">
        {/* Related Predictions */}
        <div className="predictions-page__related">
          <div className="predictions-page__related-title">Related Predictions</div>
          {relatedPredictions.map(rp => {
            const rpCat = rp.category.toLowerCase()
            return (
              <div
                key={rp.id}
                className="predictions-page__related-card"
                onClick={() => onNavigate(rp.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') onNavigate(rp.id) }}
              >
                <div className="predictions-page__related-top">
                  <span className={`predictions-page__related-badge predictions-page__related-badge--${rpCat}`}>
                    {rp.category}
                  </span>
                  <span className="predictions-page__related-prob">{rp.probability}%</span>
                </div>
                <div className="predictions-page__related-question">{rp.question}</div>
                <div className="predictions-page__related-meta">
                  <span>{rp.votes.toLocaleString()} votes</span>
                  <span className="predictions-page__related-sep">·</span>
                  <span>{rp.timeLeft}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Activity Feed */}
        <div className="predictions-page__activity">
          <div className="predictions-page__activity-title">Recent Activity</div>
          <div className="predictions-page__activity-list">
            {MOCK_ACTIVITY.map(a => (
              <div key={a.id} className="predictions-page__activity-item">
                <div className={`predictions-page__activity-dot predictions-page__activity-dot--${a.type}`} />
                <div>
                  <div className="predictions-page__activity-text">{a.text}</div>
                  <span className="predictions-page__activity-time">{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// =============================================
// Main Page Component
// =============================================

const PredictionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'active' | 'resolved'>('active')

  const selectedPrediction = id
    ? MOCK_PREDICTIONS_LIST.find(p => p.id === id)
    : null

  const handleSelectPrediction = useCallback((predId: string) => {
    navigate(`/predictions/${predId}`)
  }, [navigate])

  const handleBack = useCallback(() => {
    if (selectedPrediction) {
      navigate('/predictions')
    } else {
      navigate('/')
    }
  }, [navigate, selectedPrediction])

  return (
    <div className="predictions-page">
      {/* Top Bar */}
      <div className="predictions-page__topbar">
        <button className="predictions-page__back" onClick={handleBack}>
          <span className="predictions-page__back-arrow">←</span>
          {selectedPrediction ? 'All Predictions' : 'Dashboard'}
        </button>
        <span className="predictions-page__logo">WatchOver</span>
        <div className="predictions-page__topbar-right">
          <div className="predictions-page__live-badge">
            <span className="predictions-page__live-dot" />
            LIVE
          </div>
        </div>
      </div>

      {/* Content */}
      {selectedPrediction ? (
        <PredictionDetailView
          prediction={selectedPrediction}
          allPredictions={MOCK_PREDICTIONS_LIST}
          onNavigate={handleSelectPrediction}
        />
      ) : (
        <div className="predictions-page__content" style={{ gridTemplateColumns: '1fr' }}>
          <div className="predictions-page__main">
            <div className="predictions-page__header">
              <h1 className="predictions-page__title">Predictions Market</h1>
              <p className="predictions-page__description">
                Forecast geopolitical events. Vote on outcomes. Track probabilities in real-time.
              </p>
              <div className="predictions-page__tabs">
                <button
                  className={`predictions-page__tab ${activeTab === 'active' ? 'predictions-page__tab--active' : ''}`}
                  onClick={() => setActiveTab('active')}
                >
                  Active
                </button>
                <button
                  className={`predictions-page__tab ${activeTab === 'resolved' ? 'predictions-page__tab--active' : ''}`}
                  onClick={() => setActiveTab('resolved')}
                >
                  Resolved
                </button>
              </div>
            </div>
            <PredictionsListView
              predictions={MOCK_PREDICTIONS_LIST}
              status={activeTab}
              onSelect={handleSelectPrediction}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default PredictionsPage
