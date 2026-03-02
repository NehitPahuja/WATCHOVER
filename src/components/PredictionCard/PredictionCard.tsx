import React, { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { Badge } from '../Badge'
import './PredictionCard.css'

// =============================================
// Types
// =============================================

export interface Prediction {
  id: string
  question: string
  category: string
  probability: number   // 0-100 (Yes side)
  votes: number
  timeLeft: string
  trend: 'up' | 'down' | 'stable'
  sparkline?: number[]  // 7 recent values for mini chart
}

interface PredictionCardProps {
  prediction: Prediction
  onClick?: (prediction: Prediction) => void
}

// =============================================
// Sparkline Mini Chart
// =============================================

const Sparkline: React.FC<{ data: number[]; trend: 'up' | 'down' | 'stable'; width?: number; height?: number }> = ({
  data,
  trend,
  width = 52,
  height = 20,
}) => {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || data.length < 2) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const color = trend === 'up' ? '#00ff85' : trend === 'down' ? '#ff3b3b' : '#ffc857'

    const x = d3.scaleLinear().domain([0, data.length - 1]).range([2, width - 2])
    const yExtent = d3.extent(data) as [number, number]
    const yPad = (yExtent[1] - yExtent[0]) * 0.15 || 2
    const y = d3.scaleLinear().domain([yExtent[0] - yPad, yExtent[1] + yPad]).range([height - 2, 2])

    const line = d3.line<number>()
      .x((_, i) => x(i))
      .y(d => y(d))
      .curve(d3.curveMonotoneX)

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
      .attr('stroke-linecap', 'round')
      .attr('d', line)

    // End dot
    svg.append('circle')
      .attr('cx', x(data.length - 1))
      .attr('cy', y(data[data.length - 1]))
      .attr('r', 2)
      .attr('fill', color)
  }, [data, trend, width, height])

  return <svg ref={svgRef} width={width} height={height} className="wo-pred__sparkline" />
}

// =============================================
// Trend Arrow
// =============================================

const TrendArrow: React.FC<{ trend: 'up' | 'down' | 'stable' }> = ({ trend }) => {
  if (trend === 'up') return <span className="wo-pred__trend wo-pred__trend--up">↗</span>
  if (trend === 'down') return <span className="wo-pred__trend wo-pred__trend--down">↘</span>
  return <span className="wo-pred__trend wo-pred__trend--stable">→</span>
}

// =============================================
// Component
// =============================================

const PredictionCard: React.FC<PredictionCardProps> = ({ prediction, onClick }) => {
  const noProb = 100 - prediction.probability

  return (
    <div
      className="wo-pred"
      onClick={() => onClick?.(prediction)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(prediction) }}
    >
      {/* Top: Category + Meta */}
      <div className="wo-pred__top">
        <Badge severity="info" size="sm">{prediction.category}</Badge>
        <div className="wo-pred__meta">
          <span className="mono text-muted">{prediction.votes.toLocaleString()} votes</span>
          <span className="wo-pred__separator">·</span>
          <span className="mono text-muted">{prediction.timeLeft}</span>
        </div>
      </div>

      {/* Question */}
      <p className="wo-pred__question">{prediction.question}</p>

      {/* Bottom: Probability + Sparkline + Trend */}
      <div className="wo-pred__bottom">
        {/* Yes/No Split Bar */}
        <div className="wo-pred__split-bar">
          <div
            className="wo-pred__split-yes"
            style={{ width: `${prediction.probability}%` }}
          >
            <span className="wo-pred__split-label">Yes {prediction.probability}%</span>
          </div>
          <div
            className="wo-pred__split-no"
            style={{ width: `${noProb}%` }}
          >
            {noProb >= 15 && (
              <span className="wo-pred__split-label">No {noProb}%</span>
            )}
          </div>
        </div>

        {/* Sparkline + Trend */}
        <div className="wo-pred__chart-area">
          {prediction.sparkline && prediction.sparkline.length > 1 && (
            <Sparkline data={prediction.sparkline} trend={prediction.trend} />
          )}
          <TrendArrow trend={prediction.trend} />
        </div>
      </div>
    </div>
  )
}

export default PredictionCard
