import React, { useState, useMemo, useEffect } from 'react'
import Map from 'react-map-gl/maplibre'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer } from '@deck.gl/layers'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import type { MapViewState } from '@deck.gl/core'
import type { WatchEvent } from '../../types'
import { Badge } from '../Badge'
import 'maplibre-gl/dist/maplibre-gl.css'
import './InteractiveGlobe.css'

// We need a dark map style. We can use a free Carto dark matter basemap.
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// =============================================
// Interfaces
// =============================================

interface InteractiveGlobeProps {
  events: WatchEvent[]
  onEventClick?: (event: WatchEvent) => void
  showHeatmap?: boolean
}

interface TooltipInfo {
  x: number
  y: number
  object: WatchEvent | null
}

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 40,
  latitude: 35,
  zoom: 2.5,
  pitch: 30,
  bearing: 0,
}

// =============================================
// Component
// =============================================

const InteractiveGlobe: React.FC<InteractiveGlobeProps> = ({
  events,
  onEventClick,
  showHeatmap = false,
}) => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)
  const [hoverInfo, setHoverInfo] = useState<TooltipInfo>({ x: 0, y: 0, object: null })

  // Auto-rotation effect
  useEffect(() => {
    let animationId: number
    let lastTime = Date.now()
    const ROTATION_SPEED = 0.5 // degrees per second

    const rotate = () => {
      const now = Date.now()
      const dt = (now - lastTime) / 1000
      lastTime = now

      setViewState((vs) => ({
        ...vs,
        bearing: (vs.bearing || 0) + ROTATION_SPEED * dt
      }))
      animationId = requestAnimationFrame(rotate)
    }

    // Only rotate if no hovering
    if (!hoverInfo.object) {
      animationId = requestAnimationFrame(rotate)
    }

    return () => cancelAnimationFrame(animationId)
  }, [hoverInfo.object])


  // =============================================
  // Layers
  // =============================================

  const layers = useMemo(() => {
    // 1. Scatterplot Layer for exact event locations (Pulse nodes)
    const scatterLayer = new ScatterplotLayer<WatchEvent>({
      id: 'event-scatter',
      data: events.filter(e => e.lat != null && e.lng != null),
      getPosition: d => [d.lng, d.lat],
      getFillColor: d => {
        if (d.sentiment === 'escalation') return [255, 59, 59, 200] // Red
        if (d.sentiment === 'de-escalation') return [0, 255, 133, 200] // Green
        return [255, 200, 87, 200] // Yellow
      },
      getLineColor: d => {
        if (d.sentiment === 'escalation') return [255, 59, 59, 255]
        if (d.sentiment === 'de-escalation') return [0, 255, 133, 255]
        return [255, 200, 87, 255]
      },
      getRadius: d => viewState.zoom < 3 ? Math.max(d.confidence * 400, 20000) : Math.max(d.confidence * 200, 10000), // Scale by confidence and zoom
      radiusUnits: 'meters',
      radiusMinPixels: 4,
      radiusMaxPixels: 20,
      lineWidthMinPixels: 1,
      stroked: true,
      filled: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 200],
      onClick: ({ object }) => object && onEventClick?.(object),
      onHover: info => setHoverInfo({
        x: info.x,
        y: info.y,
        object: info.object as WatchEvent || null
      }),
      parameters: { depthTest: false } as any // ensure dots show above terrain
    })

    // 2. Optional Heatmap for density
    const heatmapLayer = new HeatmapLayer<WatchEvent>({
      id: 'event-heatmap',
      data: events.filter(e => e.lat != null && e.lng != null),
      getPosition: d => [d.lng, d.lat],
      getWeight: d => {
        // Higher weight for escalation/critical
        let weight = 1
        if (d.severity === 'critical') weight += 3
        if (d.severity === 'high') weight += 2
        if (d.sentiment === 'escalation') weight += 2
        return weight
      },
      radiusPixels: 40,
      intensity: 1,
      threshold: 0.1,
      colorRange: [
        [10, 10, 10, 0],
        [44, 168, 255, 120],  // Blue
        [255, 200, 87, 180], // Yellow
        [255, 59, 59, 230],  // Red
      ],
      visible: showHeatmap || viewState.zoom < 4 // Progressive disclosure: show heatmap at low zoom
    })

    return [
      showHeatmap || viewState.zoom < 4 ? heatmapLayer : null,
      viewState.zoom >= 2 ? scatterLayer : null // Only show distinct scatter markers if zoom >= 2
    ].filter(Boolean)
  }, [events, onEventClick, showHeatmap, viewState.zoom])

  // =============================================
  // Render
  // =============================================

  return (
    <div className="wo-globe-container">
      <DeckGL
        layers={layers}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as MapViewState)}
        controller={true}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : hoverInfo.object ? 'pointer' : 'grab')}
      >
        <Map
          mapStyle={MAP_STYLE}
          reuseMaps
        >
          {/* Subtle global atmosphere/vignette overlay */}
          <div className="wo-globe-vignette" />
        </Map>
      </DeckGL>

      {/* Hover Tooltip Placeholder */}
      {hoverInfo.object && (
        <div
          className="wo-globe-tooltip"
          style={{ left: hoverInfo.x + 15, top: hoverInfo.y + 15 }}
        >
          <div className="wo-globe-tooltip__header">
            <span className="wo-globe-tooltip__flag">{hoverInfo.object.countryFlag}</span>
            <span className="wo-globe-tooltip__country">{hoverInfo.object.country}</span>
          </div>
          <p className="wo-globe-tooltip__title">{hoverInfo.object.title}</p>
          <div className="wo-globe-tooltip__meta">
            <Badge severity={hoverInfo.object.severity}>{hoverInfo.object.severity}</Badge>
            <span className={`wo-globe-tooltip__sentiment ${
              hoverInfo.object.sentiment === 'escalation' ? 'text-red' :
              hoverInfo.object.sentiment === 'de-escalation' ? 'text-green' : 'text-yellow'
            }`}>
              {hoverInfo.object.sentiment.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Loading overlay if no events (optional fallback) */}
      {events.length === 0 && (
         <div className="wo-globe-loading">
            <span className="wo-globe-spinner" />
            Initializing Geo-Telemetry...
         </div>
      )}

      {/* Military Aircraft Counter Overlay */}
      <div className="wo-aircraft-counter">
        <span className="wo-aircraft-counter__dot" />
        <span className="wo-aircraft-counter__count mono">847</span>
        <span className="wo-aircraft-counter__label">Active Sorties Tracked</span>
      </div>
    </div>
  )
}

export default InteractiveGlobe
