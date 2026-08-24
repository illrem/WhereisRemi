import { useEffect, useState } from 'react'
import './App.css'

type LocationPoint = {
  id?: string; time: string; city?: string; country?: string; place?: string
  lat?: number; lng?: number; note?: string; video?: string; accuracyKm?: number
}
type HistoryFile = { syncedAt?: string; points?: LocationPoint[] }

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

export default function App() {
  const [history, setHistory] = useState<HistoryFile>(fallback)
  const [selected, setSelected] = useState(0)
  const [filter, setFilter] = useState<'all' | 'notes'>('all')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}location-history.json`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Location history is unavailable.')))
      .then((data: HistoryFile) => setHistory(data))
      .catch((error: Error) => setLoadError(error.message))
  }, [])

  const points = [...(history.points ?? [])].sort((a, b) => Date.parse(b.time) - Date.parse(a.time))
  const visible = filter === 'notes' ? points.filter((point) => point.note || point.video) : points
  const current = visible[selected] ?? visible[0]
  const latest = points[0]
  const places = new Set(points.map(labelFor))
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
          <div className="map-grid" />
          <div className="map-water" />
          <span className="map-label north">N</span><span className="map-label region">THE OPEN ROAD</span>
          {points.map((point, index) => <button key={point.id ?? point.time} className={`map-point ${index === 0 ? 'current' : ''} ${current === point ? 'selected' : ''}`} style={{ left: `${12 + ((index * 19) % 74)}%`, top: `${27 + ((index * 31) % 54)}%` }} onClick={() => { const next = visible.indexOf(point); if (next >= 0) setSelected(next) }} aria-label={`View ${labelFor(point)}`}><i /></button>)}
          {current && <div className="map-caption"><small>SELECTED STOP</small><strong>{labelFor(current)}</strong><span>{dateLabel(current.time)} · {timeLabel(current.time)}</span></div>}
          <div className="scale">10 km</div>
        </section>
        <div className="history-head"><div><p className="eyebrow">THE JOURNAL</p><h2>Places along the way</h2></div><div className="filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => { setFilter('all'); setSelected(0) }}>All stops</button><button className={filter === 'notes' ? 'active' : ''} onClick={() => { setFilter('notes'); setSelected(0) }}>With notes</button></div></div>
        {loadError && <p className="notice">{loadError}</p>}
        {visible.length === 0 ? <div className="empty"><strong>Your atlas is ready.</strong><span>The first synced location will appear here.</span></div> : <div className="timeline">{visible.map((point, index) => <button className={`entry ${index === selected ? 'selected' : ''}`} key={point.id ?? point.time} onClick={() => setSelected(index)}><span className="entry-dot" /><span className="entry-date">{dateLabel(point.time)}<small>{timeLabel(point.time)}</small></span><span className="entry-place"><strong>{labelFor(point)}</strong><small>{point.accuracyKm ? `within ${point.accuracyKm} km` : 'approximate location'}</small></span><span className="entry-arrow">{point.note || point.video ? '✦' : '↗'}</span></button>)}</div>}
        {current && (current.note || current.video) && <article className="memory"><p className="eyebrow">A MEMORY FROM HERE</p>{current.note && <p className="note">“{current.note}”</p>}{current.video && <a href={current.video} target="_blank" rel="noreferrer">Watch the video <span>↗</span></a>}</article>}
        <footer>Location data is rounded before it is published. <span>Made for friends & family.</span></footer>
      </section>
    </div>
  </main>
}
