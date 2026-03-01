import React from 'react'
import './DashboardLayout.css'

interface DashboardLayoutProps {
  navbar: React.ReactNode
  ticker: React.ReactNode
  leftPanel: React.ReactNode
  centerPanel: React.ReactNode
  rightPanel: React.ReactNode
  bottomBar?: React.ReactNode
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  navbar,
  ticker,
  leftPanel,
  centerPanel,
  rightPanel,
  bottomBar,
}) => {
  return (
    <div className="wo-dashboard">
      <header className="wo-dashboard__navbar">
        {navbar}
      </header>

      <div className="wo-dashboard__ticker">
        {ticker}
      </div>

      <main className="wo-dashboard__body">
        <aside className="wo-dashboard__left" id="panel-left">
          {leftPanel}
        </aside>

        <section className="wo-dashboard__center" id="panel-center">
          {centerPanel}
          {bottomBar && (
            <div className="wo-dashboard__bottom-bar">
              {bottomBar}
            </div>
          )}
        </section>

        <aside className="wo-dashboard__right" id="panel-right">
          {rightPanel}
        </aside>
      </main>
    </div>
  )
}

export default DashboardLayout
