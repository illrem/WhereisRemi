import { useEffect, useState } from 'react'
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
type RangeSelection = 'today' | 'week' | 'month' | 'last-month' | `month:${string}`

const fallback: HistoryFile = { points: [] }
const uk = /^(uk|united kingdom|england|scotland|wales|northern ireland)$/i

function labelFor(point: LocationPoint) {
  if (uk.test(point.country ?? '') || uk.test(point.place ?? '')) return 'UK'
  return point.city || point.place || 'Somewhere new'
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
  const projection = geoNaturalEarth1().fitSize([1000, 500], countries as never)
  const path = geoPath(projection)
  return <svg className="map-svg" viewBox="0 0 1000 500" role="img" aria-label="World map with location history">
    <g className="country-shapes">{countries.features.map((country) => <path key={country.id} d={path(country) ?? undefined} />)}</g>
    <g className="map-points">{points.map((point) => {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null
      const position = projection([point.lng!, point.lat!])
      if (!position) return null
      return <circle className={`map-point ${point === points[0] ? 'current' : ''} ${point === current ? 'selected' : ''}`} key={point.id ?? point.time} cx={position[0]} cy={position[1]} r={point === points[0] ? 7 : 5} onClick={() => onSelect(point)} role="button" tabIndex={0} aria-label={`View ${labelFor(point)}`} />
    })}</g>
  </svg>
}

export default function App() {
  const [history, setHistory] = useState<HistoryFile>(fallback)
  const [selected, setSelected] = useState(0)
  const [filter, setFilter] = useState<'all' | 'notes'>('all')
  const [range, setRange] = useState<RangeSelection>('month')
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
    if (range === 'today') return time >= startOfToday
    if (range === 'week') return time >= startOfWeek
    if (range === 'month') return time >= startOfMonth
    if (range === 'last-month') return time >= startOfLastMonth && time < endOfLastMonth
    return monthKey(point.time) === range.slice(6)
  }
  const rangePoints = points.filter(inRange)
  const visible = filter === 'notes' ? rangePoints.filter((point) => point.note || point.video) : rangePoints
  const current = visible[selected] ?? visible[0]
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
          <WorldMap points={rangePoints} current={current} onSelect={(point) => { const next = visible.indexOf(point); if (next >= 0) setSelected(next) }} />
          <span className="map-label north">N</span>
          {current && <div className="map-caption"><small>SELECTED STOP</small><strong>{labelFor(current)}</strong><span>{dateLabel(current.time)} · {timeLabel(current.time)}</span></div>}
          <div className="scale">10 km</div>
        </section>
        <nav className="range-picker" aria-label="Location history range">
          <div className="range-quick"><button className={range === 'today' ? 'active' : ''} onClick={() => changeRange('today')}>Today</button><button className={range === 'week' ? 'active' : ''} onClick={() => changeRange('week')}>This week</button><button className={range === 'month' ? 'active' : ''} onClick={() => changeRange('month')}>This month</button><button className={range === 'last-month' ? 'active' : ''} onClick={() => changeRange('last-month')}>Last month</button></div>
          <div className="month-calendar"><span className="range-label">MONTHS</span>{monthKeys.map((key) => <button key={key} className={range === `month:${key}` ? 'active' : ''} onClick={() => changeRange(`month:${key}`)}>{monthLabel(key)}</button>)}</div>
        </nav>
        <div className="history-head"><div><p className="eyebrow">THE JOURNAL</p><h2>Places along the way</h2></div><div className="filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setSelected(0) }}>All stops</button><button className={filter === 'notes' ? 'active' : ''} onClick={() => { setFilter('notes'); setSelected(0) }}>With notes</button></div></div>
        {loadError && <p className="notice">{loadError}</p>}
        {visible.length === 0 ? <div className="empty"><strong>Your atlas is ready.</strong><span>The first synced location will appear here.</span></div> : <div className="timeline">{visible.map((point, index) => <button className={`entry ${index === selected ? 'selected' : ''}`} key={point.id ?? point.time} onClick={() => setSelected(index)}><span className="entry-dot" /><span className="entry-date">{dateLabel(point.time)}<small>{timeLabel(point.time)}</small></span><span className="entry-place"><strong>{labelFor(point)}</strong><small>{point.accuracyKm ? `within ${point.accuracyKm} km` : 'approximate location'}</small></span><span className="entry-arrow">{point.note || point.video ? '✦' : '↗'}</span></button>)}</div>}
        {current && (current.note || current.video) && <article className="memory"><p className="eyebrow">A MEMORY FROM HERE</p>{current.note && <p className="note">“{current.note}”</p>}{current.video && <a href={current.video} target="_blank" rel="noreferrer">Watch the video <span>↗</span></a>}</article>}
        <footer>Location data is rounded before it is published. <span>Made for friends & family.</span></footer>
      </section>
    </div>
  </main>
}
