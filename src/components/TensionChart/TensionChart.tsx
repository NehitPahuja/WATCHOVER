import React, { useRef, useEffect, useState, useMemo } from 'react'
import * as d3 from 'd3'
import './TensionChart.css'

// =============================================
// Types
// =============================================

export interface TensionDataPoint {
  date: string   // ISO date string, e.g. "2026-02-24"
  value: number  // Tension index 0-100
}

interface TensionChartProps {
  dataPoints: TensionDataPoint[]
  currentValue: number
  change: number        // e.g. +2.3 or -1.8
}

// =============================================
// Mock data for 7 days (will be replaced by API)
// =============================================

export const MOCK_TENSION_DATA: TensionDataPoint[] = [
  { date: '2026-02-24', value: 61.2 },
  { date: '2026-02-25', value: 63.8 },
  { date: '2026-02-26', value: 59.4 },
  { date: '2026-02-27', value: 64.1 },
  { date: '2026-02-28', value: 66.7 },
  { date: '2026-03-01', value: 65.1 },
  { date: '2026-03-02', value: 67.4 },
]

// =============================================
// Component
// =============================================

const TensionChart: React.FC<TensionChartProps> = ({
  dataPoints,
  currentValue,
  change,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredPoint, setHoveredPoint] = useState<TensionDataPoint | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const isUp = change >= 0
  const changeColor = isUp ? 'var(--signal-red)' : 'var(--signal-green)'

  // Observe container size
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setDimensions({ width, height })
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  // Chart margins
  const margin = useMemo(() => ({ top: 8, right: 12, bottom: 20, left: 36 }), [])
  const innerW = dimensions.width - margin.left - margin.right
  const innerH = dimensions.height - margin.top - margin.bottom

  // D3 drawing
  useEffect(() => {
    if (!svgRef.current || innerW <= 0 || innerH <= 0 || dataPoints.length < 2) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Parse dates
    const parsed = dataPoints.map(d => ({
      ...d,
      dateObj: new Date(d.date),
    }))

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(parsed, d => d.dateObj) as [Date, Date])
      .range([0, innerW])

    const yExtent = d3.extent(parsed, d => d.value) as [number, number]
    const yPad = (yExtent[1] - yExtent[0]) * 0.2 || 5
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([innerH, 0])

    const g = svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // ----- Grid lines -----
    const yTicks = yScale.ticks(4)
    g.selectAll('.grid-line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('class', 'wo-tension-grid-line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))

    // ----- Y axis labels -----
    g.selectAll('.y-label')
      .data(yTicks)
      .enter()
      .append('text')
      .attr('class', 'wo-tension-y-label')
      .attr('x', -8)
      .attr('y', d => yScale(d))
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .text(d => d.toFixed(0))

    // ----- X axis labels (day abbreviated) -----
    const dayFormat = d3.timeFormat('%a')
    g.selectAll('.x-label')
      .data(parsed)
      .enter()
      .append('text')
      .attr('class', 'wo-tension-x-label')
      .attr('x', d => xScale(d.dateObj))
      .attr('y', innerH + 14)
      .attr('text-anchor', 'middle')
      .text(d => dayFormat(d.dateObj))

    // ----- Gradient fill under line -----
    const areaGradientId = 'tension-area-gradient'
    const defs = svg.append('defs')
    const gradient = defs.append('linearGradient')
      .attr('id', areaGradientId)
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%')
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', isUp ? '#ff3b3b' : '#00ff85')
      .attr('stop-opacity', 0.15)
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', isUp ? '#ff3b3b' : '#00ff85')
      .attr('stop-opacity', 0.0)

    // Area generator
    const area = d3.area<typeof parsed[0]>()
      .x(d => xScale(d.dateObj))
      .y0(innerH)
      .y1(d => yScale(d.value))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(parsed)
      .attr('fill', `url(#${areaGradientId})`)
      .attr('d', area)

    // ----- Line -----
    const line = d3.line<typeof parsed[0]>()
      .x(d => xScale(d.dateObj))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX)

    const path = g.append('path')
      .datum(parsed)
      .attr('fill', 'none')
      .attr('stroke', isUp ? '#ff3b3b' : '#00ff85')
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round')
      .attr('d', line)

    // Animate line drawing
    const pathLength = path.node()?.getTotalLength() || 0
    path
      .attr('stroke-dasharray', `${pathLength} ${pathLength}`)
      .attr('stroke-dashoffset', pathLength)
      .transition()
      .duration(800)
      .ease(d3.easeQuadOut)
      .attr('stroke-dashoffset', 0)

    // ----- Data dots -----
    g.selectAll('.data-dot')
      .data(parsed)
      .enter()
      .append('circle')
      .attr('class', 'wo-tension-dot')
      .attr('cx', d => xScale(d.dateObj))
      .attr('cy', d => yScale(d.value))
      .attr('r', 0)
      .attr('fill', isUp ? '#ff3b3b' : '#00ff85')
      .attr('stroke', 'var(--bg-secondary)')
      .attr('stroke-width', 2)
      .transition()
      .delay(800)
      .duration(300)
      .attr('r', 3)

    // ----- Hover overlay (invisible wider hit area for each point) -----
    g.selectAll('.hover-target')
      .data(parsed)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.dateObj))
      .attr('cy', d => yScale(d.value))
      .attr('r', 14) // big invisible target
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair')
      .on('mouseenter', (_event, d) => {
        setHoveredPoint({ date: d.date, value: d.value })
        setTooltipPos({
          x: xScale(d.dateObj) + margin.left,
          y: yScale(d.value) + margin.top - 8,
        })
      })
      .on('mouseleave', () => {
        setHoveredPoint(null)
      })

  }, [dataPoints, dimensions, innerW, innerH, margin, isUp])

  // Format for display
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="wo-tension">
      {/* Left: stats */}
      <div className="wo-tension__stats">
        <div className="wo-tension__stat-group">
          <span className="wo-tension__label">Global Tension Index</span>
          <div className="wo-tension__value-row">
            <span className="wo-tension__value mono" style={{ color: changeColor }}>
              {currentValue.toFixed(1)}
            </span>
            <span className="wo-tension__delta mono" style={{ color: changeColor }}>
              {isUp ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
            </span>
          </div>
          <span className="wo-tension__period mono">7-day trend</span>
        </div>

        <div className="wo-tension__counters">
          <div className="wo-tension__counter-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
            <span className="mono">847</span>
            <span className="text-muted">Aircraft</span>
          </div>
          <div className="wo-tension__counter-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8" /><path d="M8 12h8" />
            </svg>
            <span className="mono">14</span>
            <span className="text-muted">Active</span>
          </div>
        </div>
      </div>

      {/* Right: D3 chart */}
      <div className="wo-tension__chart-wrapper" ref={containerRef}>
        <svg ref={svgRef} className="wo-tension__svg" />

        {/* Hover tooltip */}
        {hoveredPoint && (
          <div
            className="wo-tension__tooltip"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            <span className="wo-tension__tooltip-date">
              {formatDate(hoveredPoint.date)}
            </span>
            <span className="wo-tension__tooltip-value mono" style={{ color: changeColor }}>
              {hoveredPoint.value.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default TensionChart
