import { useState } from 'react'
import { Button, Badge, Card, Modal, Tooltip, Skeleton, LiveIndicator } from './components'
import './App.css'

function App() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <div className="app-showcase">
      <header className="showcase-header">
        <h1>WatchOver</h1>
        <p className="showcase-subtitle">Component Design System — Phase 0.2</p>
        <LiveIndicator />
      </header>

      <div className="showcase-grid">
        {/* Buttons */}
        <section className="showcase-section">
          <h2>Buttons</h2>
          <div className="showcase-row">
            <Button variant="primary">Primary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="cta">Subscribe</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" isLoading>Loading</Button>
            <Button variant="primary" size="sm">Small</Button>
          </div>
        </section>

        {/* Badges */}
        <section className="showcase-section">
          <h2>Badges</h2>
          <div className="showcase-row">
            <Badge severity="high" dot>HIGH</Badge>
            <Badge severity="medium">MEDIUM</Badge>
            <Badge severity="low">LOW</Badge>
            <Badge severity="info">INFO</Badge>
            <Badge severity="escalation" dot>ESCALATION</Badge>
            <Badge severity="de-escalation" dot>DE-ESCALATION</Badge>
          </div>
        </section>

        {/* Cards */}
        <section className="showcase-section">
          <h2>Cards</h2>
          <div className="showcase-cards">
            <Card hoverable>
              <h3>Default Card</h3>
              <p>Hover to see the subtle glow effect.</p>
            </Card>
            <Card variant="escalation" hoverable>
              <div className="card-header-row">
                <Badge severity="high" dot>HIGH</Badge>
                <span className="card-time mono">2m ago</span>
              </div>
              <h3>Escalation Event</h3>
              <p>Military buildup detected near border region.</p>
              <div className="card-meta">
                <span className="text-muted">Confidence</span>
                <span className="mono text-red">87%</span>
              </div>
            </Card>
            <Card variant="de-escalation" hoverable>
              <div className="card-header-row">
                <Badge severity="de-escalation" dot>DE-ESCALATION</Badge>
                <span className="card-time mono">15m ago</span>
              </div>
              <h3>Ceasefire Agreement</h3>
              <p>Both parties signed initial ceasefire terms.</p>
              <div className="card-meta">
                <span className="text-muted">Confidence</span>
                <span className="mono text-green">92%</span>
              </div>
            </Card>
          </div>
        </section>

        {/* Tooltip */}
        <section className="showcase-section">
          <h2>Tooltip</h2>
          <div className="showcase-row">
            <Tooltip content="Top tooltip" position="top">
              <Button variant="ghost">Hover me (top)</Button>
            </Tooltip>
            <Tooltip content="Right tooltip" position="right">
              <Button variant="ghost">Hover me (right)</Button>
            </Tooltip>
            <Tooltip content="Bottom tooltip" position="bottom">
              <Button variant="ghost">Hover me (bottom)</Button>
            </Tooltip>
          </div>
        </section>

        {/* Skeleton */}
        <section className="showcase-section">
          <h2>Skeleton Loaders</h2>
          <div className="showcase-skeleton-grid">
            <div className="skeleton-demo">
              <Skeleton variant="circle" width={40} height={40} />
              <Skeleton variant="text" lines={3} />
            </div>
            <Skeleton variant="rect" height={120} />
          </div>
        </section>

        {/* Live Indicator */}
        <section className="showcase-section">
          <h2>Live Indicators</h2>
          <div className="showcase-row">
            <LiveIndicator size="sm" />
            <LiveIndicator size="md" />
            <LiveIndicator label="BROADCASTING" />
          </div>
        </section>

        {/* Modal */}
        <section className="showcase-section">
          <h2>Modal</h2>
          <Button variant="primary" onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>
          <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Event Detail">
            <div className="modal-demo-content">
              <div className="modal-meta-row">
                <Badge severity="high" dot>HIGH</Badge>
                <LiveIndicator size="sm" />
              </div>
              <h3>Military Aircraft Detected</h3>
              <p>Multiple fighter jets detected operating near contested airspace. Increased military activity observed within 24 hours.</p>
              <div className="modal-meta-grid">
                <div>
                  <span className="text-muted">Severity</span>
                  <span className="text-red mono">Critical</span>
                </div>
                <div>
                  <span className="text-muted">Confidence</span>
                  <span className="mono">94%</span>
                </div>
                <div>
                  <span className="text-muted">Region</span>
                  <span>Middle East</span>
                </div>
                <div>
                  <span className="text-muted">24H Activity</span>
                  <span className="mono">+47</span>
                </div>
              </div>
            </div>
          </Modal>
        </section>
      </div>
    </div>
  )
}

export default App
