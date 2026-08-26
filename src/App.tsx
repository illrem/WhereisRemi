import { useEffect, useRef, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { FeatureCollection } from 'geojson'
import world from 'world-atlas/countries-110m.json'
import './App.css'

type LocationPoint = {
  id?: string; time: string; city?: string; country?: string; place?: string
  lat?: number; lng?: number; note?: string; video?: string; accuracyKm?: number
}
type HistoryFile = { syncedAt?: string; points?: LocationPoint[] }
type RangeSelection = 'today' | 'week' | 'month' | 'last-month' | 'all' | `month:${string}`

const fallback: HistoryFile = { points: [] }

function labelFor(point: LocationPoint) {
  if (/^(uk|united kingdom|england|scotland|wales|northern ireland)$/i.test(point.country ?? '') || point.place === 'UK') return 'UK'
  return point.city || point.place || 'adventure'
}
function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}
function timeLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
function monthKey(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key: string) {
  const date = new Date(`${key}-01T00:00:00`)
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}
const countries = feature(world as never, world.objects.countries as never) as unknown as FeatureCollection

function WorldMap({ points, current, onSelect }: { points: LocationPoint[]; current?: LocationPoint; onSelect: (point: LocationPoint) => void }) {
  const maxZoom = 4 * 1.3 ** 2
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const drag = useRef<{ clientX: number; clientY: number; moved: boolean; active: boolean; point?: LocationPoint } | null>(null)
  const pointers = useRef(new Map<number, { clientX: number; clientY: number }>())
  const pinch = useRef<{ distance: number; centerX: number; centerY: number; zoom: number } | null>(null)
  const projection = geoNaturalEarth1().fitSize([1000, 500], countries as never)
  const path = geoPath(projection)
  const wrap = (value: number, width: number) => ((value + width / 2) % width + width) % width - width / 2
  const clampY = (value: number, zoom: number) => Math.min(0, Math.max(500 - 500 * zoom, value))
  const svgPoint = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const bounds = svg.getBoundingClientRect()
    return { x: (clientX - bounds.left) / bounds.width * 1000, y: (clientY - bounds.top) / bounds.height * 500 }
  }
  const zoomAt = (nextZoom: number, x = 500, y = 250) => {
    setView((previous) => {
      const worldX = (x - previous.x) / previous.zoom
      const worldY = (y - previous.y) / previous.zoom
      return { zoom: nextZoom, x: wrap(x - worldX * nextZoom, 1000 * nextZoom), y: clampY(y - worldY * nextZoom, nextZoom) }
    })
  }
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
    if (pointers.current.size >= 2) {
      const [first, second] = [...pointers.current.values()]
      const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
      const center = svgPoint(event.currentTarget, (first.clientX + second.clientX) / 2, (first.clientY + second.clientY) / 2)
      const gesture = pinch.current
      if (gesture && gesture.distance > 0) {
        const nextZoom = Math.min(maxZoom, Math.max(1, gesture.zoom * distance / gesture.distance))
        setView((previous) => {
          const worldX = (gesture.centerX - previous.x) / previous.zoom
          const worldY = (gesture.centerY - previous.y) / previous.zoom
          return { zoom: nextZoom, x: wrap(center.x - worldX * nextZoom, 1000 * nextZoom), y: clampY(center.y - worldY * nextZoom, nextZoom) }
        })
      }
      return
    }
    if (!drag.current?.active) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const deltaX = (event.clientX - drag.current.clientX) / bounds.width * 1000
    const deltaY = (event.clientY - drag.current.clientY) / bounds.height * 500
    if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) drag.current.moved = true
    drag.current.clientX = event.clientX
    drag.current.clientY = event.clientY
    setView((previous) => ({ ...previous, x: wrap(previous.x + deltaX, 1000 * previous.zoom), y: clampY(previous.y + deltaY, previous.zoom) }))
  }
  const renderWorld = (offset: number) => <g key={offset} transform={`translate(${offset * 1000} 0)`}>
    <g className="country-shapes">{countries.features.map((country) => <path key={`${offset}-${country.id}`} d={path(country) ?? undefined} />)}</g>
    <g className="map-points">{points.map((point) => {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null
      const position = projection([point.lng!, point.lat!])
      if (!position) return null
      return <circle className={`map-point ${point === points[0] ? 'current' : ''} ${point === current ? 'selected' : ''}`} key={`${offset}-${point.id ?? point.time ?? 'point'}-${points.indexOf(point)}`} data-point-index={points.indexOf(point)} cx={position[0]} cy={position[1]} r={(point === points[0] ? 7 : 5) / view.zoom} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelect(point) }} role="button" tabIndex={0} aria-label={`View ${labelFor(point)}`} />
    })}</g>
  </g>
  const stopDrag = (event: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    const currentDrag = drag.current
    if (currentDrag) {
      currentDrag.active = false
      if (pointers.current.size === 0 && !currentDrag.moved && currentDrag.point) onSelect(currentDrag.point)
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return <div className="map-viewport">
    <svg className="map-svg" viewBox="0 0 1000 500" role="img" aria-label="World map with location history" onWheel={(event) => { const point = svgPoint(event.currentTarget, event.clientX, event.clientY); zoomAt(Math.min(maxZoom, Math.max(1, view.zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2))), point.x, point.y) }} onPointerDown={(event) => { const target = event.target as Element; const pointIndex = target.closest?.('.map-point')?.getAttribute('data-point-index'); pointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY }); drag.current = { clientX: event.clientX, clientY: event.clientY, moved: false, active: pointers.current.size === 1, point: pointIndex === null ? undefined : points[Number(pointIndex)] }; if (pointers.current.size === 2) { const [first, second] = [...pointers.current.values()]; const center = svgPoint(event.currentTarget, (first.clientX + second.clientX) / 2, (first.clientY + second.clientY) / 2); pinch.current = { distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY), centerX: center.x, centerY: center.y, zoom: view.zoom }; drag.current.moved = true; drag.current.point = undefined }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={move} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={() => { if (drag.current) drag.current.active = false }}>
      <g className="map-transform" transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>{[-1, 0, 1].map(renderWorld)}</g>
    </svg>
    <div className="map-controls" aria-label="Map controls">
      <button type="button" onClick={() => zoomAt(Math.min(maxZoom, view.zoom * 1.3))} aria-label="Zoom in" title="Zoom in">+</button>
      <button type="button" onClick={() => zoomAt(Math.max(1, view.zoom / 1.3))} aria-label="Zoom out" title="Zoom out">-</button>
      <button type="button" onClick={() => { drag.current = null; setView({ zoom: 1, x: 0, y: 0 }) }} aria-label="Reset map" title="Reset map">Reset</button>
    </div>
  </div>
}

export default function App() {
  const [history, setHistory] = useState<HistoryFile>(fallback)
  const [selected, setSelected] = useState(0)
  const [range, setRange] = useState<RangeSelection>('today')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}location-history.json`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Location history is unavailable.')))
      .then((data: HistoryFile) => setHistory(data))
      .catch((error: Error) => setLoadError(error.message))
  }, [])

  const points = [...(history.points ?? [])].sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).valueOf()
  const startOfWeek = startOfToday - ((now.getDay() + 6) % 7) * 86400000
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).valueOf()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).valueOf()
  const endOfLastMonth = startOfMonth
  const inRange = (point: LocationPoint) => {
    const time = Date.parse(point.time)
    if (range === 'all') return true
    if (range === 'today') return time >= startOfToday
    if (range === 'week') return time >= startOfWeek
    if (range === 'month') return time >= startOfMonth
    if (range === 'last-month') return time >= startOfLastMonth && time < endOfLastMonth
    return monthKey(point.time) === range.slice(6)
  }
  const rangePoints = points.filter(inRange)
  const current = rangePoints[selected] ?? rangePoints[0]
  const latest = rangePoints[0] ?? points[0]
  const places = new Set(rangePoints.map(labelFor))
  const monthKeys = [...new Set(points.map((point) => monthKey(point.time)).filter(Boolean))].sort().reverse()
  const changeRange = (next: RangeSelection) => { setRange(next); setSelected(0) }
  const synced = history.syncedAt ? new Date(history.syncedAt) : undefined

  return <main>
    <header className="topbar">
      <a className="brand" href="."><span className="brand-mark">w/</span> whereis<span>REMI</span></a>
      <div className="status"><i /> <span>SHARING LIVE</span><b>{synced && !Number.isNaN(synced.valueOf()) ? `updated ${synced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'waiting for first sync'}</b></div>
    </header>
    <div className="layout">
      <aside>
        <p className="eyebrow">A SMALL ATLAS OF</p>
        <h1>Where Remi<br /><em>has been.</em></h1>
        <p className="lede">A quiet window into the places, detours, and good stories along the way.</p>
        <div className="stats"><div><strong>{places.size}</strong><small>PLACES</small></div><div><strong>{points.length}</strong><small>CHECK-INS</small></div></div>
        <div className="privacy"><span>◎</span><p>Precise addresses stay private.<br /><b>UK locations are shown as UK.</b></p></div>
      </aside>
      <section className="content">
        <div className="heading"><div><p className="eyebrow">CURRENTLY</p><h2>{labelFor(latest ?? { time: '' })}</h2><p className="muted">{latest ? `${dateLabel(latest.time)} · ${timeLabel(latest.time)}` : 'No location has been published yet'}</p></div><div className="signal"><span /><span /><span /><span /><span /></div></div>
        <section className="map" aria-label="Location map">
          <WorldMap points={rangePoints} current={current} onSelect={(point) => { const next = rangePoints.indexOf(point); if (next >= 0) setSelected(next) }} />
          <span className="map-label north">N</span>
          {current && <div className="map-caption"><small>SELECTED STOP</small><strong>{labelFor(current)}</strong><span>{dateLabel(current.time)} · {timeLabel(current.time)}</span></div>}
          <div className="scale">10 km</div>
        </section>
        <nav className="range-picker" aria-label="Location history range">
          <div className="range-quick"><button className={range === 'today' ? 'active' : ''} onClick={() => changeRange('today')}>Today</button><button className={range === 'week' ? 'active' : ''} onClick={() => changeRange('week')}>This week</button><button className={range === 'month' ? 'active' : ''} onClick={() => changeRange('month')}>This month</button><button className={range === 'last-month' ? 'active' : ''} onClick={() => changeRange('last-month')}>Last month</button><button className={range === 'all' ? 'active' : ''} onClick={() => changeRange('all')}>All</button></div>
          <div className="month-calendar"><span className="range-label">MONTHS</span>{monthKeys.map((key) => <button key={key} className={range === `month:${key}` ? 'active' : ''} onClick={() => changeRange(`month:${key}`)}>{monthLabel(key)}</button>)}</div>
        </nav>
        <div className="history-head"><div><p className="eyebrow">THE JOURNAL</p><h2>Places along the way</h2></div></div>
        {loadError && <p className="notice">{loadError}</p>}
        {rangePoints.length === 0 ? <div className="empty"><strong>Your atlas is ready.</strong><span>The first synced location will appear here.</span></div> : <div className="timeline">{rangePoints.map((point, index) => <button className={`entry ${index === selected ? 'selected' : ''}`} key={point.id ?? point.time} onClick={() => setSelected(index)}><span className="entry-dot" /><span className="entry-date">{dateLabel(point.time)}<small>{timeLabel(point.time)}</small></span><span className="entry-place"><strong>{labelFor(point)}</strong><small>{point.accuracyKm ? `within ${point.accuracyKm} km` : 'approximate location'}</small></span><span className="entry-arrow">{point.note || point.video ? '✦' : '↗'}</span></button>)}</div>}
        {current && (current.note || current.video) && <article className="memory"><p className="eyebrow">A MEMORY FROM HERE</p>{current.note && <p className="note">“{current.note}”</p>}{current.video && <a href={current.video} target="_blank" rel="noreferrer">Watch the video <span>↗</span></a>}</article>}
        <footer>Location data is rounded before it is published. <span>Made for friends & family.</span></footer>
      </section>
    </div>
  </main>
}
