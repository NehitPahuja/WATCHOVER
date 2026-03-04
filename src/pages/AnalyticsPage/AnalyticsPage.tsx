import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import * as d3 from 'd3'
import './AnalyticsPage.css'

// =============================================
// Types
// =============================================

interface DateRange {
  label: string
  days: number
}

interface RegionData {
  region: string
  count: number
  severity: { critical: number; high: number; medium: number; low: number }
}

interface TimeSeriesPoint {
  date: string
  escalation: number
  deescalation: number
  neutral: number
  total: number
}

interface CategoryData {
  category: string
  count: number
  color: string
}

interface HeatMapCell {
  region: string
  day: string
  value: number
}

// =============================================
// Date Ranges
// =============================================

const DATE_RANGES: DateRange[] = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
]

// =============================================
// Regions and Categories
// =============================================

const REGIONS = ['Middle East', 'Europe', 'Asia Pacific', 'Africa', 'Americas', 'South Asia', 'Central Asia']
const CATEGORIES = [
  { name: 'Military', color: '#ff3b3b' },
  { name: 'Political', color: '#2ca8ff' },
  { name: 'Economic', color: '#ffc857' },
  { name: 'Diplomatic', color: '#00ff85' },
  { name: 'Humanitarian', color: '#ff9f1c' },
  { name: 'Cyber', color: '#00e5ff' },
  { name: 'Territorial', color: '#b388ff' },
]

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// =============================================
// Data Generation (simulated from DB)
// =============================================

function generateRegionData(days: number): RegionData[] {
  const rng = mulberry32(days * 42)
  return REGIONS.map(region => {
    const base = Math.floor(rng() * 30) + 5
    const count = base + Math.floor(rng() * days * 0.8)
    return {
      region,
      count,
      severity: {
        critical: Math.floor(count * (0.05 + rng() * 0.1)),
        high: Math.floor(count * (0.15 + rng() * 0.15)),
        medium: Math.floor(count * (0.3 + rng() * 0.15)),
        low: Math.floor(count * (0.2 + rng() * 0.1)),
      },
    }
  }).sort((a, b) => b.count - a.count)
}

function generateTimeSeries(days: number): TimeSeriesPoint[] {
  const points: TimeSeriesPoint[] = []
  const now = new Date()
  const rng = mulberry32(days * 7)

  for (let i = days; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const esc = Math.floor(3 + rng() * 8 + (days > 30 ? rng() * 4 : 0))
    const deesc = Math.floor(1 + rng() * 5)
    const neutral = Math.floor(4 + rng() * 10)
    points.push({
      date: d.toISOString().slice(0, 10),
      escalation: esc,
      deescalation: deesc,
      neutral,
      total: esc + deesc + neutral,
    })
  }
  return points
}

function generateCategoryData(days: number): CategoryData[] {
  const rng = mulberry32(days * 13)
  return CATEGORIES.map(cat => ({
    category: cat.name,
    count: Math.floor(10 + rng() * days * 1.5),
    color: cat.color,
  })).sort((a, b) => b.count - a.count)
}

function generateHeatMapData(days: number): HeatMapCell[] {
  const cells: HeatMapCell[] = []
  const rng = mulberry32(days * 99)
  const weeks = Math.min(Math.ceil(days / 7), 12)

  for (const region of REGIONS.slice(0, 6)) {
    for (let w = 0; w < weeks; w++) {
      for (const day of DAYS_OF_WEEK) {
        cells.push({
          region,
          day: `W${w + 1} ${day}`,
          value: Math.floor(rng() * 10),
        })
      }
    }
  }
  return cells
}

// Simple seeded PRNG
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// =============================================
// Summary Statistics
// =============================================

function computeStats(timeSeries: TimeSeriesPoint[], regionData: RegionData[]) {
  const totalEvents = timeSeries.reduce((sum, p) => sum + p.total, 0)
  const totalEsc = timeSeries.reduce((sum, p) => sum + p.escalation, 0)
  const totalDeesc = timeSeries.reduce((sum, p) => sum + p.deescalation, 0)
  const escRate = totalEvents > 0 ? Math.round((totalEsc / totalEvents) * 100) : 0
  const avgDaily = timeSeries.length > 0 ? Math.round(totalEvents / timeSeries.length) : 0
  const topRegion = regionData.length > 0 ? regionData[0].region : 'N/A'
  const criticalTotal = regionData.reduce((sum, r) => sum + r.severity.critical, 0)

  // Week-over-week change
  const recent7 = timeSeries.slice(-7).reduce((s, p) => s + p.total, 0)
  const prev7 = timeSeries.slice(-14, -7).reduce((s, p) => s + p.total, 0)
  const weekChange = prev7 > 0 ? Math.round(((recent7 - prev7) / prev7) * 100) : 0

  return { totalEvents, totalEsc, totalDeesc, escRate, avgDaily, topRegion, criticalTotal, weekChange, recent7 }
}

// =============================================
// Chart: Conflict Volume by Region (Bar Chart)
// =============================================

const RegionBarChart: React.FC<{ data: RegionData[] }> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 400, h: 280 })

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setDims({ w: Math.max(200, e.contentRect.width - 16), h: 280 })
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 16, right: 20, bottom: 50, left: 110 }
    const w = dims.w - margin.left - margin.right
    const h = dims.h - margin.top - margin.bottom
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.count)! * 1.1]).range([0, w])
    const y = d3.scaleBand().domain(data.map(d => d.region)).range([0, h]).padding(0.35)

    // Grid
    x.ticks(5).forEach(t => {
      g.append('line')
        .attr('x1', x(t)).attr('x2', x(t))
        .attr('y1', 0).attr('y2', h)
        .attr('stroke', 'rgba(255,255,255,0.04)')
    })

    // Bars with stacked severity
    data.forEach(d => {
      const barY = y(d.region)!
      const barH = y.bandwidth()
      const total = d.count
      const severities = [
        { key: 'critical', value: d.severity.critical, color: '#ff3b3b' },
        { key: 'high', value: d.severity.high, color: '#ff9f1c' },
        { key: 'medium', value: d.severity.medium, color: '#ffc857' },
        { key: 'low', value: d.severity.low, color: '#00ff85' },
      ]

      let offset = 0
      severities.forEach(s => {
        const segW = total > 0 ? (s.value / total) * x(total) : 0
        g.append('rect')
          .attr('x', offset)
          .attr('y', barY)
          .attr('width', 0)
          .attr('height', barH)
          .attr('fill', s.color)
          .attr('opacity', 0.8)
          .attr('rx', 2)
          .transition()
          .duration(800)
          .delay(data.indexOf(d) * 60)
          .attr('width', segW)
        offset += segW
      })

      // Value label
      g.append('text')
        .attr('x', x(total) + 6)
        .attr('y', barY + barH / 2)
        .attr('dy', '0.35em')
        .attr('fill', 'var(--text-muted)')
        .attr('font-size', '11px')
        .attr('font-family', '"JetBrains Mono", monospace')
        .text(total)
        .attr('opacity', 0)
        .transition()
        .duration(400)
        .delay(data.indexOf(d) * 60 + 400)
        .attr('opacity', 1)
    })

    // Y-axis labels
    data.forEach(d => {
      g.append('text')
        .attr('x', -8)
        .attr('y', y(d.region)! + y.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('fill', 'var(--text-secondary)')
        .attr('font-size', '11px')
        .text(d.region)
    })
  }, [data, dims])

  return (
    <div ref={containerRef} className="analytics__chart-wrap">
      <svg ref={svgRef} width={dims.w} height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`} />
    </div>
  )
}

// =============================================
// Chart: Event Timeline (Stacked Area)
// =============================================

const EventTimelineChart: React.FC<{ data: TimeSeriesPoint[] }> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 600, h: 260 })

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setDims({ w: Math.max(300, e.contentRect.width - 16), h: 260 })
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current || data.length < 2) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 16, right: 16, bottom: 32, left: 40 }
    const w = dims.w - margin.left - margin.right
    const h = dims.h - margin.top - margin.bottom
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3.scaleTime()
      .domain(d3.extent(data, d => new Date(d.date)) as [Date, Date])
      .range([0, w])
    const maxTotal = d3.max(data, d => d.total) || 20
    const y = d3.scaleLinear().domain([0, maxTotal * 1.2]).range([h, 0])

    // Grid
    y.ticks(4).forEach(t => {
      g.append('line')
        .attr('x1', 0).attr('x2', w)
        .attr('y1', y(t)).attr('y2', y(t))
        .attr('stroke', 'rgba(255,255,255,0.04)')
      g.append('text')
        .attr('x', -8).attr('y', y(t))
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('fill', 'rgba(255,255,255,0.2)')
        .attr('font-size', '10px')
        .attr('font-family', '"JetBrains Mono", monospace')
        .text(t)
    })

    // X labels
    const xTicks = x.ticks(Math.min(6, data.length))
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

    // Stacked areas
    const layers = [
      { key: 'escalation' as const, color: '#ff3b3b', opacity: 0.2 },
      { key: 'neutral' as const, color: '#ffc857', opacity: 0.1 },
      { key: 'deescalation' as const, color: '#00ff85', opacity: 0.15 },
    ]

    // Gradients
    const defs = svg.append('defs')
    layers.forEach(layer => {
      const grad = defs.append('linearGradient')
        .attr('id', `area-grad-${layer.key}`)
        .attr('x1', '0').attr('y1', '0')
        .attr('x2', '0').attr('y2', '1')
      grad.append('stop').attr('offset', '0%').attr('stop-color', layer.color).attr('stop-opacity', layer.opacity)
      grad.append('stop').attr('offset', '100%').attr('stop-color', layer.color).attr('stop-opacity', 0)
    })

    layers.forEach(layer => {
      const area = d3.area<TimeSeriesPoint>()
        .x(d => x(new Date(d.date)))
        .y0(h)
        .y1(d => y(d[layer.key]))
        .curve(d3.curveMonotoneX)

      g.append('path')
        .datum(data)
        .attr('fill', `url(#area-grad-${layer.key})`)
        .attr('d', area)

      const line = d3.line<TimeSeriesPoint>()
        .x(d => x(new Date(d.date)))
        .y(d => y(d[layer.key]))
        .curve(d3.curveMonotoneX)

      const path = g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', layer.color)
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0.8)
        .attr('d', line)

      const totalLen = path.node()?.getTotalLength() || 0
      path
        .attr('stroke-dasharray', `${totalLen} ${totalLen}`)
        .attr('stroke-dashoffset', totalLen)
        .transition()
        .duration(1200)
        .ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0)
    })

    // Hover overlay
    const overlay = g.append('rect')
      .attr('width', w).attr('height', h)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .style('cursor', 'crosshair')

    const hoverLine = g.append('line')
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-dasharray', '3,3')
      .attr('y1', 0).attr('y2', h)
      .style('opacity', 0)

    const bisector = d3.bisector<TimeSeriesPoint, Date>(d => new Date(d.date)).left

    overlay
      .on('mousemove', (event: MouseEvent) => {
        const [mx] = d3.pointer(event)
        const dateAtMouse = x.invert(mx)
        const idx = bisector(data, dateAtMouse, 1)
        const d0 = data[idx - 1]
        const d1 = data[idx]
        if (!d0) return
        const d = d1 && (dateAtMouse.getTime() - new Date(d0.date).getTime()) > (new Date(d1.date).getTime() - dateAtMouse.getTime()) ? d1 : d0
        const cx = x(new Date(d.date))
        hoverLine.attr('x1', cx).attr('x2', cx).style('opacity', 1)

        if (tooltipRef.current) {
          tooltipRef.current.style.opacity = '1'
          tooltipRef.current.style.left = `${cx + margin.left + 12}px`
          tooltipRef.current.style.top = `${margin.top}px`
          tooltipRef.current.innerHTML = `
            <div class="analytics__tooltip-date">${d.date}</div>
            <div class="analytics__tooltip-row"><span class="analytics__tooltip-dot" style="background:#ff3b3b"></span>Escalation: ${d.escalation}</div>
            <div class="analytics__tooltip-row"><span class="analytics__tooltip-dot" style="background:#ffc857"></span>Neutral: ${d.neutral}</div>
            <div class="analytics__tooltip-row"><span class="analytics__tooltip-dot" style="background:#00ff85"></span>De-escalation: ${d.deescalation}</div>
            <div class="analytics__tooltip-total">Total: ${d.total}</div>
          `
        }
      })
      .on('mouseleave', () => {
        hoverLine.style('opacity', 0)
        if (tooltipRef.current) tooltipRef.current.style.opacity = '0'
      })
  }, [data, dims])

  return (
    <div ref={containerRef} className="analytics__chart-wrap" style={{ position: 'relative' }}>
      <svg ref={svgRef} width={dims.w} height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`} />
      <div ref={tooltipRef} className="analytics__tooltip" style={{ opacity: 0 }} />
    </div>
  )
}

// =============================================
// Chart: Category Distribution (Donut Chart)
// =============================================

const CategoryDonutChart: React.FC<{ data: CategoryData[] }> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const size = 200
    const radius = size / 2
    const innerRadius = radius * 0.6
    const g = svg.append('g').attr('transform', `translate(${radius},${radius})`)

    const pie = d3.pie<CategoryData>()
      .value(d => d.count)
      .sort(null)
      .padAngle(0.03)

    const arc = d3.arc<d3.PieArcDatum<CategoryData>>()
      .innerRadius(innerRadius)
      .outerRadius(radius - 4)
      .cornerRadius(3)

    const arcs = g.selectAll('.arc')
      .data(pie(data))
      .join('g')
      .attr('class', 'arc')

    arcs.append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('opacity', 0.85)
      .attr('stroke', 'var(--bg-primary)')
      .attr('stroke-width', 1)
      .transition()
      .duration(800)
      .attrTween('d', function (d) {
        const interp = d3.interpolate({ startAngle: 0, endAngle: 0 }, d)
        return function (t) { return arc(interp(t) as d3.PieArcDatum<CategoryData>) || '' }
      })

    // Center text
    const total = data.reduce((s, d) => s + d.count, 0)
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .attr('fill', 'var(--text-primary)')
      .attr('font-size', '22px')
      .attr('font-weight', '700')
      .attr('font-family', '"JetBrains Mono", monospace')
      .text(total)
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('fill', 'var(--text-dim)')
      .attr('font-size', '10px')
      .attr('font-family', '"JetBrains Mono", monospace')
      .attr('text-transform', 'uppercase')
      .text('TOTAL')
  }, [data])

  return (
    <div ref={containerRef} className="analytics__donut-wrap">
      <svg ref={svgRef} width={200} height={200} viewBox="0 0 200 200" />
      <div className="analytics__donut-legend">
        {data.map(d => (
          <div key={d.category} className="analytics__legend-item">
            <span className="analytics__legend-dot" style={{ background: d.color }} />
            <span className="analytics__legend-label">{d.category}</span>
            <span className="analytics__legend-value mono">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// =============================================
// Chart: Heat Map by Region
// =============================================

const RegionHeatMap: React.FC<{ data: HeatMapCell[] }> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 600, h: 200 })

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      for (const e of entries) {
        setDims({ w: Math.max(300, e.contentRect.width - 16), h: 200 })
      }
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const regions = [...new Set(data.map(d => d.region))]
    const days = [...new Set(data.map(d => d.day))]

    const margin = { top: 8, right: 16, bottom: 32, left: 100 }
    const w = dims.w - margin.left - margin.right
    const h = dims.h - margin.top - margin.bottom
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

    const cellW = Math.max(4, Math.min(16, w / days.length - 1))
    const cellH = Math.max(6, h / regions.length - 2)

    const maxVal = d3.max(data, d => d.value) || 10
    const colorScale = d3.scaleSequential(d3.interpolateInferno).domain([0, maxVal])

    data.forEach(d => {
      const col = days.indexOf(d.day)
      const row = regions.indexOf(d.region)
      g.append('rect')
        .attr('x', col * (cellW + 1))
        .attr('y', row * (cellH + 2))
        .attr('width', cellW)
        .attr('height', cellH)
        .attr('rx', 2)
        .attr('fill', d.value === 0 ? 'rgba(255,255,255,0.02)' : colorScale(d.value))
        .attr('opacity', 0)
        .transition()
        .duration(400)
        .delay(col * 8 + row * 30)
        .attr('opacity', 1)
    })

    // Y labels
    regions.forEach((region, i) => {
      g.append('text')
        .attr('x', -8)
        .attr('y', i * (cellH + 2) + cellH / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .attr('fill', 'var(--text-muted)')
        .attr('font-size', '10px')
        .text(region)
    })
  }, [data, dims])

  return (
    <div ref={containerRef} className="analytics__chart-wrap">
      <svg ref={svgRef} width={dims.w} height={dims.h} viewBox={`0 0 ${dims.w} ${dims.h}`} />
    </div>
  )
}

// =============================================
// Chart: Escalation Rate (Gauge)
// =============================================

const EscalationGauge: React.FC<{ rate: number; prevRate?: number }> = ({ rate, prevRate }) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const size = 160
    const center = size / 2
    const radius = 60
    const thickness = 10
    const startAngle = -Math.PI * 0.75
    const endAngle = Math.PI * 0.75

    const g = svg.append('g').attr('transform', `translate(${center},${center + 10})`)

    // Background arc
    const bgArc = d3.arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(radius - thickness)
      .outerRadius(radius)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .cornerRadius(5)

    g.append('path')
      .attr('d', bgArc({ startAngle, endAngle }) || '')
      .attr('fill', 'rgba(255,255,255,0.05)')

    // Value arc
    const valueAngle = startAngle + (rate / 100) * (endAngle - startAngle)
    const valueArc = d3.arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(radius - thickness)
      .outerRadius(radius)
      .startAngle(startAngle)
      .endAngle(valueAngle)
      .cornerRadius(5)

    const color = rate > 60 ? '#ff3b3b' : rate > 40 ? '#ffc857' : '#00ff85'

    const path = g.append('path')
      .attr('fill', color)
      .attr('opacity', 0.9)

    path.transition()
      .duration(1200)
      .ease(d3.easeCubicInOut)
      .attrTween('d', () => {
        const interp = d3.interpolate(startAngle, valueAngle)
        return (t: number) => {
          return valueArc({ startAngle, endAngle: interp(t) }) || ''
        }
      })

    // Center value
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.1em')
      .attr('fill', color)
      .attr('font-size', '28px')
      .attr('font-weight', '700')
      .attr('font-family', '"JetBrains Mono", monospace')
      .text(`${rate}%`)

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.6em')
      .attr('fill', 'var(--text-dim)')
      .attr('font-size', '10px')
      .attr('font-family', '"JetBrains Mono", monospace')
      .text('ESCALATION RATE')

    // Change indicator
    if (prevRate !== undefined) {
      const diff = rate - prevRate
      const diffColor = diff > 0 ? '#ff3b3b' : diff < 0 ? '#00ff85' : 'var(--text-dim)'
      const arrow = diff > 0 ? '▲' : diff < 0 ? '▼' : '—'
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '3.2em')
        .attr('fill', diffColor)
        .attr('font-size', '10px')
        .attr('font-family', '"JetBrains Mono", monospace')
        .text(`${arrow} ${Math.abs(diff)}% vs prev period`)
    }
  }, [rate, prevRate])

  return (
    <div className="analytics__gauge-wrap">
      <svg ref={svgRef} width={160} height={160} viewBox="0 0 160 160" />
    </div>
  )
}

// =============================================
// Export Utilities
// =============================================

function exportToCSV(timeSeries: TimeSeriesPoint[], regionData: RegionData[], categoryData: CategoryData[]) {
  let csv = 'WatchOver Analytics Report\n\n'

  csv += 'Event Timeline\nDate,Escalation,De-escalation,Neutral,Total\n'
  timeSeries.forEach(p => {
    csv += `${p.date},${p.escalation},${p.deescalation},${p.neutral},${p.total}\n`
  })

  csv += '\nConflict Volume by Region\nRegion,Total,Critical,High,Medium,Low\n'
  regionData.forEach(r => {
    csv += `${r.region},${r.count},${r.severity.critical},${r.severity.high},${r.severity.medium},${r.severity.low}\n`
  })

  csv += '\nEvent Type Distribution\nCategory,Count\n'
  categoryData.forEach(c => {
    csv += `${c.category},${c.count}\n`
  })

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `watchover-analytics-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportToPDF(stats: ReturnType<typeof computeStats>, range: string) {
  // Generate a printable HTML report and open in a new window for PDF printing
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WatchOver Analytics Report</title>
      <style>
        body { font-family: 'Inter', sans-serif; background: #fff; color: #111; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { font-size: 24px; border-bottom: 2px solid #111; padding-bottom: 8px; }
        h2 { font-size: 16px; margin-top: 24px; color: #444; text-transform: uppercase; letter-spacing: 0.05em; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 16px 0; }
        .stat { background: #f5f5f5; padding: 16px; border-radius: 8px; }
        .stat-value { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
        .stat-label { font-size: 11px; color: #666; text-transform: uppercase; }
        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; color: #999; font-size: 11px; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <h1>WatchOver — Intelligence Analytics Report</h1>
      <p style="color: #666;">Generated: ${new Date().toLocaleString()} | Range: Last ${range}</p>

      <h2>Key Metrics</h2>
      <div class="stat-grid">
        <div class="stat"><div class="stat-value">${stats.totalEvents.toLocaleString()}</div><div class="stat-label">Total Events</div></div>
        <div class="stat"><div class="stat-value">${stats.escRate}%</div><div class="stat-label">Escalation Rate</div></div>
        <div class="stat"><div class="stat-value">${stats.avgDaily}</div><div class="stat-label">Daily Average</div></div>
        <div class="stat"><div class="stat-value">${stats.criticalTotal}</div><div class="stat-label">Critical Events</div></div>
      </div>

      <h2>Summary</h2>
      <p>${stats.totalEvents.toLocaleString()} events were tracked over the last ${range}, with an escalation rate of ${stats.escRate}%. The most active region is <strong>${stats.topRegion}</strong>. Week-over-week activity changed by ${stats.weekChange > 0 ? '+' : ''}${stats.weekChange}%.</p>
      <p>${stats.criticalTotal} critical-severity events were identified. The average daily event count is ${stats.avgDaily}.</p>

      <div class="footer">
        <p>WatchOver Intelligence Platform — Confidential</p>
        <p>This report is auto-generated. Use Ctrl+P or Cmd+P to save as PDF.</p>
      </div>
    </body>
    </html>
  `
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }
}

// =============================================
// Main Analytics Page
// =============================================

const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate()
  const [activeRange, setActiveRange] = useState<DateRange>(DATE_RANGES[1]) // Default 30d

  const regionData = useMemo(() => generateRegionData(activeRange.days), [activeRange])
  const timeSeries = useMemo(() => generateTimeSeries(activeRange.days), [activeRange])
  const categoryData = useMemo(() => generateCategoryData(activeRange.days), [activeRange])
  const heatMapData = useMemo(() => generateHeatMapData(activeRange.days), [activeRange])
  const stats = useMemo(() => computeStats(timeSeries, regionData), [timeSeries, regionData])

  // Prev period escalation rate for gauge
  const prevTimeSeries = useMemo(() => generateTimeSeries(activeRange.days * 2).slice(0, activeRange.days), [activeRange])
  const prevStats = useMemo(() => computeStats(prevTimeSeries, regionData), [prevTimeSeries, regionData])

  const handleExportCSV = useCallback(() => {
    exportToCSV(timeSeries, regionData, categoryData)
  }, [timeSeries, regionData, categoryData])

  const handleExportPDF = useCallback(() => {
    exportToPDF(stats, activeRange.label)
  }, [stats, activeRange])

  return (
    <div className="analytics-page">
      {/* Top Bar */}
      <div className="analytics-page__topbar">
        <button className="analytics-page__back" onClick={() => navigate('/')}>
          <span className="analytics-page__back-arrow">←</span>
          Dashboard
        </button>
        <span className="analytics-page__logo">WatchOver</span>
        <div className="analytics-page__topbar-right">
          <div className="analytics-page__live-badge">
            <span className="analytics-page__live-dot" />
            ANALYTICS
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="analytics-page__content">
        {/* Header */}
        <div className="analytics-page__header">
          <div className="analytics-page__header-left">
            <h1 className="analytics-page__title">Intelligence Analytics</h1>
            <p className="analytics-page__subtitle">
              Conflict monitoring, trend analysis, and regional intelligence reporting.
            </p>
          </div>
          <div className="analytics-page__header-right">
            {/* Date Range Selector */}
            <div className="analytics-page__range-selector">
              {DATE_RANGES.map(r => (
                <button
                  key={r.label}
                  className={`analytics-page__range-btn ${activeRange.label === r.label ? 'analytics-page__range-btn--active' : ''}`}
                  onClick={() => setActiveRange(r)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {/* Export Buttons */}
            <div className="analytics-page__export-group">
              <button className="analytics-page__export-btn" onClick={handleExportCSV}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                CSV
              </button>
              <button className="analytics-page__export-btn" onClick={handleExportPDF}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* KPI Stats Row */}
        <div className="analytics-page__kpi-row">
          <div className="analytics-page__kpi">
            <div className="analytics-page__kpi-value mono">{stats.totalEvents.toLocaleString()}</div>
            <div className="analytics-page__kpi-label">Total Events</div>
            <div className={`analytics-page__kpi-change ${stats.weekChange >= 0 ? 'analytics-page__kpi-change--up' : 'analytics-page__kpi-change--down'}`}>
              {stats.weekChange >= 0 ? '▲' : '▼'} {Math.abs(stats.weekChange)}% WoW
            </div>
          </div>
          <div className="analytics-page__kpi">
            <div className="analytics-page__kpi-value mono" style={{ color: 'var(--signal-red)' }}>{stats.criticalTotal}</div>
            <div className="analytics-page__kpi-label">Critical Events</div>
          </div>
          <div className="analytics-page__kpi">
            <div className="analytics-page__kpi-value mono" style={{ color: 'var(--signal-yellow)' }}>{stats.avgDaily}</div>
            <div className="analytics-page__kpi-label">Daily Average</div>
          </div>
          <div className="analytics-page__kpi">
            <div className="analytics-page__kpi-value mono" style={{ color: 'var(--signal-blue)' }}>{stats.topRegion}</div>
            <div className="analytics-page__kpi-label">Most Active Region</div>
          </div>
          <div className="analytics-page__kpi">
            <div className="analytics-page__kpi-value mono" style={{ color: 'var(--signal-green)' }}>{stats.recent7}</div>
            <div className="analytics-page__kpi-label">Last 7 Days</div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="analytics-page__grid">
          {/* Event Timeline */}
          <div className="analytics-page__card analytics-page__card--wide">
            <div className="analytics-page__card-header">
              <h2 className="analytics-page__card-title">Event Timeline</h2>
              <div className="analytics-page__card-legend">
                <span className="analytics-page__mini-legend"><span style={{ background: '#ff3b3b' }} /> Escalation</span>
                <span className="analytics-page__mini-legend"><span style={{ background: '#ffc857' }} /> Neutral</span>
                <span className="analytics-page__mini-legend"><span style={{ background: '#00ff85' }} /> De-escalation</span>
              </div>
            </div>
            <EventTimelineChart data={timeSeries} />
          </div>

          {/* Escalation Rate Gauge */}
          <div className="analytics-page__card analytics-page__card--center">
            <div className="analytics-page__card-header">
              <h2 className="analytics-page__card-title">Escalation Rate</h2>
            </div>
            <EscalationGauge rate={stats.escRate} prevRate={prevStats.escRate} />
          </div>

          {/* Conflict Volume by Region */}
          <div className="analytics-page__card analytics-page__card--wide">
            <div className="analytics-page__card-header">
              <h2 className="analytics-page__card-title">Conflict Volume by Region</h2>
              <div className="analytics-page__card-legend">
                <span className="analytics-page__mini-legend"><span style={{ background: '#ff3b3b' }} /> Critical</span>
                <span className="analytics-page__mini-legend"><span style={{ background: '#ff9f1c' }} /> High</span>
                <span className="analytics-page__mini-legend"><span style={{ background: '#ffc857' }} /> Medium</span>
                <span className="analytics-page__mini-legend"><span style={{ background: '#00ff85' }} /> Low</span>
              </div>
            </div>
            <RegionBarChart data={regionData} />
          </div>

          {/* Category Distribution */}
          <div className="analytics-page__card">
            <div className="analytics-page__card-header">
              <h2 className="analytics-page__card-title">Event Type Distribution</h2>
            </div>
            <CategoryDonutChart data={categoryData} />
          </div>

          {/* Activity Heat Map */}
          <div className="analytics-page__card analytics-page__card--full">
            <div className="analytics-page__card-header">
              <h2 className="analytics-page__card-title">Regional Activity Heat Map</h2>
              <span className="analytics-page__card-subtitle mono">
                intensity by region × time
              </span>
            </div>
            <RegionHeatMap data={heatMapData} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default AnalyticsPage
