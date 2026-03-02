import React, { useState } from 'react'
import './MarketsModule.css'

// =============================================
// Types
// =============================================

export interface MarketEntry {
  name: string
  symbol: string
  value: string
  change: string
  isUp: boolean
}

interface MarketsModuleProps {
  markets: MarketEntry[]
  onRefresh?: () => void
}

// =============================================
// Component
// =============================================

const MarketsModule: React.FC<MarketsModuleProps> = ({ markets, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    onRefresh?.()
    // Simulate refresh animation
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  return (
    <section className="wo-markets">
      <h3 className="wo-markets__title">
        <span>Markets</span>
        <button
          className={`wo-markets__refresh ${isRefreshing ? 'wo-markets__refresh--spinning' : ''}`}
          onClick={handleRefresh}
          aria-label="Refresh markets"
        >
          ↻
        </button>
      </h3>

      <div className="wo-markets__list">
        {markets.map((market) => (
          <div key={market.name} className="wo-markets__row">
            <div className="wo-markets__name-col">
              <span className="wo-markets__symbol mono">{market.symbol}</span>
              <span className="wo-markets__name">{market.name}</span>
            </div>
            <span className="wo-markets__value mono">{market.value}</span>
            <span className={`wo-markets__change mono ${market.isUp ? 'text-green' : 'text-red'}`}>
              {market.isUp ? '▲' : '▼'} {market.change}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default MarketsModule
