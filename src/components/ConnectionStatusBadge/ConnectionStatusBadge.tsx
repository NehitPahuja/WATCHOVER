import type { ConnectionStatus } from '../../hooks/useRealtime'
import './ConnectionStatusBadge.css'

interface ConnectionStatusBadgeProps {
  status: ConnectionStatus
  onReconnect?: () => void
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; className: string }> = {
  connected: { label: 'LIVE', className: 'wo-conn-badge--live' },
  connecting: { label: 'CONNECTING', className: 'wo-conn-badge--connecting' },
  disconnected: { label: 'OFFLINE', className: 'wo-conn-badge--offline' },
  'fallback-polling': { label: 'POLLING', className: 'wo-conn-badge--polling' },
}

const ConnectionStatusBadge: React.FC<ConnectionStatusBadgeProps> = ({ status, onReconnect }) => {
  const config = STATUS_CONFIG[status]

  return (
    <button
      className={`wo-conn-badge ${config.className}`}
      onClick={status !== 'connected' ? onReconnect : undefined}
      title={status !== 'connected' ? 'Click to reconnect' : 'Connected to relay'}
    >
      <span className="wo-conn-badge__dot" />
      <span className="wo-conn-badge__label">{config.label}</span>
    </button>
  )
}

export default ConnectionStatusBadge
