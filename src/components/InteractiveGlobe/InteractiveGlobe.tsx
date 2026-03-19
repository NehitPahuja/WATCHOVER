import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Map from 'react-map-gl/maplibre'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer } from '@deck.gl/layers'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { _GlobeView as GlobeView, type MapViewState } from '@deck.gl/core'
import type { WatchEvent } from '../../types'
import { Badge } from '../Badge'
import { AnimatedCounter } from '../AnimatedCounter'
import 'maplibre-gl/dist/maplibre-gl.css'
import './InteractiveGlobe.css'

// =============================================
// Constants & Config
// =============================================

// High-fidelity dark tactical map style (using Carto Dark Matter)
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: 25,
  latitude: 20,
  zoom: 1.5,
  pitch: 0,
  bearing: 0,
}

// Reusable GlobeView instance — avoids re-creation on every render
const GLOBE_VIEW = new GlobeView({ id: 'globe', controller: true, resolution: 1 })

// Throttle interval for layer-affecting state updates (ms)
// The globe still renders at 60fps; this only controls how often
// we rebuild layer objects (which is expensive).
const LAYER_UPDATE_INTERVAL = 100

// =============================================
// Interfaces
// =============================================

interface InteractiveGlobeProps {
  events: WatchEvent[]
  onEventClick?: (event: WatchEvent) => void
  showHeatmap?: boolean
  aircraft?: number
}

interface TooltipInfo {
  x: number
  y: number
  object: WatchEvent | null
}

// =============================================
// Component
// =============================================

const InteractiveGlobe: React.FC<InteractiveGlobeProps> = ({
  events,
  onEventClick,
  showHeatmap = false,
  aircraft = 1128,
}) => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE)
  const [hoverInfo, setHoverInfo] = useState<TooltipInfo>({ x: 0, y: 0, object: null })

  // Throttled view state for layer computations (updates at most every LAYER_UPDATE_INTERVAL ms)
  // This is the key 60fps optimization: viewState changes every frame during rotation,
  // but we only rebuild layers when layerViewState changes.
  const [layerViewState, setLayerViewState] = useState(INITIAL_VIEW_STATE)
  const lastLayerUpdateRef = useRef(0)

  // Update layerViewState at a throttled rate
  useEffect(() => {
    const now = Date.now()
    if (now - lastLayerUpdateRef.current >= LAYER_UPDATE_INTERVAL) {
      lastLayerUpdateRef.current = now
      setLayerViewState(viewState)
    } else {
      const timeout = setTimeout(() => {
        lastLayerUpdateRef.current = Date.now()
        setLayerViewState(viewState)
      }, LAYER_UPDATE_INTERVAL - (now - lastLayerUpdateRef.current))
      return () => clearTimeout(timeout)
    }
  }, [viewState])

  // Auto-rotation effect (longitude based for globe)
  useEffect(() => {
    let animationId: number
    const lastTimeRef = { value: Date.now() }
    const ROTATION_SPEED = 0.8 // degrees per second

    const rotate = () => {
      const now = Date.now()
      const dt = (now - lastTimeRef.value) / 1000
      lastTimeRef.value = now

      setViewState((vs) => ({
        ...vs,
        longitude: (vs.longitude || 0) + ROTATION_SPEED * dt
      }))
      animationId = requestAnimationFrame(rotate)
    }

    // Auto-rotate only if we aren't currently hovering an object
    if (!hoverInfo.object) {
      animationId = requestAnimationFrame(rotate)
    }

    return () => cancelAnimationFrame(animationId)
  }, [hoverInfo.object])

  // =============================================
  // Memoized data & visibility
  // =============================================

  // Pre-filter valid events once (not on every frame)
  const validEvents = useMemo(
    () => events.filter(e => e.lat != null && e.lng != null),
    [events]
  )

  // Visibility check using the throttled layer view state
  const isVisible = useCallback((eventLat: number, eventLng: number) => {
    const viewLat = layerViewState.latitude || 0
    const viewLng = layerViewState.longitude || 0
    const p = Math.PI / 180
    
    const lat1 = viewLat * p
    const lat2 = eventLat * p
    const dLng = (eventLng - viewLng) * p
    
    const cosAngle = Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(dLng)
    
    // The exact horizon is 0, but using 0.05 hides the marker just prior to visual distortion on the edge
    return cosAngle > 0.05
  }, [layerViewState.latitude, layerViewState.longitude])

  // Stable callbacks to avoid recreating layers
  const handleHover = useCallback((info: any) => {
    setHoverInfo({
      x: info.x,
      y: info.y,
      object: (info.object as WatchEvent) || null
    })
  }, [])

  const handleClick = useCallback(({ object }: any) => {
    if (object) onEventClick?.(object)
  }, [onEventClick])

  // =============================================
  // Layers Configuration (keyed on throttled state)
  // =============================================

  const layers = useMemo(() => {
    const zoom = layerViewState.zoom || 0

    // 1. Scatterplot Layer for events
    const scatterLayer = new ScatterplotLayer<WatchEvent>({
      id: 'event-scatter',
      data: validEvents,
      getPosition: d => [d.lng!, d.lat!],
      getFillColor: d => {
        if (!isVisible(d.lat!, d.lng!)) return [0, 0, 0, 0]
        if (d.sentiment === 'escalation') return [255, 30, 30, 200]
        if (d.sentiment === 'de-escalation') return [0, 255, 133, 200]
        return [255, 200, 87, 200]
      },
      getLineColor: d => {
        if (!isVisible(d.lat!, d.lng!)) return [0, 0, 0, 0]
        if (d.sentiment === 'escalation') return [255, 30, 30, 255]
        if (d.sentiment === 'de-escalation') return [0, 255, 133, 255]
        return [255, 200, 87, 255]
      },
      // Scale markers based on zoom level for globe projection
      getRadius: d => {
        if (!isVisible(d.lat!, d.lng!)) return 0
        const baseRadius = 50000 // 50km base pulse
        const zoomFactor = Math.pow(1.5, -zoom)
        return baseRadius * zoomFactor * (d.confidence / 50)
      },
      radiusUnits: 'meters',
      radiusMinPixels: 3,
      radiusMaxPixels: 20,
      stroked: true,
      filled: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 100],
      onClick: handleClick,
      onHover: handleHover,
      parameters: {
        depthTest: true
      } as any,
      updateTriggers: {
        getFillColor: [layerViewState.longitude, layerViewState.latitude],
        getLineColor: [layerViewState.longitude, layerViewState.latitude],
        getRadius: [layerViewState.longitude, layerViewState.latitude, zoom]
      }
    })

    const scatterGlowLayer = new ScatterplotLayer<WatchEvent>({
      id: 'event-scatter-glow',
      data: validEvents,
      getPosition: d => [d.lng!, d.lat!],
      getFillColor: d => {
        if (!isVisible(d.lat!, d.lng!)) return [0, 0, 0, 0]
        if (d.sentiment === 'escalation') return [255, 30, 30, 60]
        if (d.sentiment === 'de-escalation') return [0, 255, 133, 60]
        return [255, 200, 87, 60]
      },
      getRadius: d => {
        if (!isVisible(d.lat!, d.lng!)) return 0
        const baseRadius = 80000 // 80km base pulse for glow
        const zoomFactor = Math.pow(1.5, -zoom)
        return baseRadius * zoomFactor * (d.confidence / 50)
      },
      radiusUnits: 'meters',
      radiusMinPixels: 6,
      radiusMaxPixels: 40,
      stroked: false,
      filled: true,
      pickable: false,
      parameters: {
        depthTest: true
      } as any,
      updateTriggers: {
        getFillColor: [layerViewState.longitude, layerViewState.latitude],
        getRadius: [layerViewState.longitude, layerViewState.latitude, zoom]
      }
    })

    // 2. Optional Heatmap Layer for density
    const heatmapLayer = new HeatmapLayer<WatchEvent>({
      id: 'event-heatmap',
      data: validEvents,
      getPosition: d => [d.lng!, d.lat!],
      getWeight: d => isVisible(d.lat!, d.lng!) ? (d.severity === 'critical' ? 5 : d.severity === 'high' ? 3 : 1) : 0,
      radiusPixels: 45,
      intensity: 1.5,
      threshold: 0.1,
      colorRange: [
        [10, 10, 10, 0],
        [44, 168, 255, 80],
        [255, 200, 87, 150],
        [255, 30, 30, 200],
      ],
      visible: showHeatmap || zoom < 3.5,
      updateTriggers: {
        getWeight: [layerViewState.longitude, layerViewState.latitude]
      }
    })

    return [
      showHeatmap || zoom < 3.5 ? heatmapLayer : null,
      zoom >= 1.5 ? scatterGlowLayer : null,
      zoom >= 1.5 ? scatterLayer : null
    ].filter(Boolean)
  }, [validEvents, showHeatmap, layerViewState.zoom, layerViewState.longitude, layerViewState.latitude, isVisible, handleClick, handleHover])

  // Stable view state change handler
  const handleViewStateChange = useCallback(({ viewState }: any) => {
    setViewState(viewState as MapViewState)
  }, [])

  // Stable cursor handler
  const getCursor = useCallback(({ isDragging }: { isDragging: boolean }) => (
    isDragging ? 'grabbing' : hoverInfo.object ? 'pointer' : 'grab'
  ), [hoverInfo.object])

  // =============================================
  // Render
  // =============================================

  return (
    <div className="wo-globe-container">
      <DeckGL
        views={GLOBE_VIEW}
        layers={layers}
        viewState={viewState}
        onViewStateChange={handleViewStateChange}
        getCursor={getCursor}
      >
        <Map
          mapStyle={MAP_STYLE}
          reuseMaps
          // @ts-ignore - MapLibre globe property
          projection="globe"
        >
          {/* Surface atmosphere glow wrapper */}
          <div className="wo-globe-atmosphere" />
        </Map>
      </DeckGL>

      {/* Interactive Tooltip */}
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

      {/* Loading Overlay */}
      {events.length === 0 && (
         <div className="wo-globe-loading">
            <span className="wo-globe-spinner" />
            Synchronizing Global Intel...
         </div>
      )}

      {/* Aircraft Counter Overlay */}
      <div className="wo-aircraft-counter">
        <span className="wo-aircraft-counter__dot" />
        <AnimatedCounter
          value={aircraft}
          className="wo-aircraft-counter__count mono"
          duration={800}
        />
        <span className="wo-aircraft-counter__label">Militarized Sorties Detected</span>
      </div>
    </div>
  )
}

export default InteractiveGlobe

