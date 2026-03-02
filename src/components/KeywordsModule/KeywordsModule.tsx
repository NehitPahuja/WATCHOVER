import React from 'react'
import './KeywordsModule.css'

// =============================================
// Types
// =============================================

export interface KeywordEntry {
  rank: number
  keyword: string
  count: number
  trend?: 'up' | 'down' | 'stable'
}

interface KeywordsModuleProps {
  keywords: KeywordEntry[]
  onKeywordClick?: (keyword: string) => void
}

// =============================================
// Trend indicator
// =============================================

const TrendIcon: React.FC<{ trend?: 'up' | 'down' | 'stable' }> = ({ trend }) => {
  if (!trend || trend === 'stable') return <span className="wo-kw__trend wo-kw__trend--stable">—</span>
  if (trend === 'up') return <span className="wo-kw__trend wo-kw__trend--up">↑</span>
  return <span className="wo-kw__trend wo-kw__trend--down">↓</span>
}

// =============================================
// Component
// =============================================

const KeywordsModule: React.FC<KeywordsModuleProps> = ({ keywords, onKeywordClick }) => {
  return (
    <section className="wo-keywords">
      <h3 className="wo-keywords__title">Top Keywords (24H)</h3>
      <div className="wo-keywords__list">
        {keywords.map((kw) => {
          // Compute fill bar width relative to max count
          const maxCount = keywords[0]?.count || 1
          const pct = (kw.count / maxCount) * 100

          return (
            <button
              key={kw.rank}
              className="wo-kw__row"
              onClick={() => onKeywordClick?.(kw.keyword)}
              title={`Filter feed by "${kw.keyword}"`}
            >
              <span className="wo-kw__rank mono text-muted">#{kw.rank}</span>

              <div className="wo-kw__word-col">
                <span className="wo-kw__word">{kw.keyword}</span>
                {/* Background bar for relative frequency */}
                <div className="wo-kw__bar" style={{ width: `${pct}%` }} />
              </div>

              <TrendIcon trend={kw.trend} />

              <span className="wo-kw__count mono text-muted">
                {kw.count.toLocaleString()}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default KeywordsModule
