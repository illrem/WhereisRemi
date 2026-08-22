import { useEffect, useState } from 'react'
import './App.css'

type Device = { id: string; name: string; kind: string; color: string; icon: string }
type Point = { x: number; y: number; time: string; place: string; device: string; deviceId?: string; address: string; accuracy: string }

const devices: Device[] = [
  { id: 'phone', name: 'Galaxy S24 Ultra', kind: 'Phone', color: '#ff765b', icon: '▣' },
  { id: 'watch', name: 'Galaxy Watch6', kind: 'Watch', color: '#68a7ff', icon: '◉' },
  { id: 'tag', name: 'Remi’s Keys', kind: 'SmartTag', color: '#d8a94b', icon: '⌁' },
]

const points: Point[] = [
  { x: 28, y: 63, time: '08:42', place: 'Home', device: 'Galaxy S24 Ultra', address: '1124 3rd Ave, Seattle', accuracy: '8m' },
  { x: 35, y: 55, time: '09:18', place: 'Northline Coffee', device: 'Galaxy S24 Ultra', address: '4301 Fremont Ave N', accuracy: '12m' },
  { x: 45, y: 49, time: '10:06', place: 'Pioneer Square', device: 'Galaxy Watch6', address: '100 S Jackson St', accuracy: '16m' },
  { x: 51, y: 60, time: '12:24', place: 'South Lake Union', device: 'Galaxy S24 Ultra', address: '2111 7th Ave', accuracy: '9m' },
  { x: 62, y: 42, time: '14:02', place: 'Gas Works Park', device: 'Galaxy Watch6', address: '2101 N Northlake Way', accuracy: '21m' },
  { x: 74, y: 48, time: '16:37', place: 'Volunteer Park', device: 'Galaxy S24 Ultra', address: '1247 15th Ave E', accuracy: '11m' },
  { x: 81, y: 33, time: '18:16', place: 'Capitol Hill', device: 'Remi’s Keys', address: '1400 E Pine St', accuracy: '6m' },
  { x: 68, y: 68, time: '20:51', place: 'Home', device: 'Galaxy S24 Ultra', address: '1124 3rd Ave, Seattle', accuracy: '7m' },
]

const deviceStorageKey = 'whereisremi-enabled-devices'
const ownerSessionKey = 'whereisremi-owner-session'

function App() {
  const [isSetupRoute, setIsSetupRoute] = useState(window.location.hash === '#/setup')
  const [isOwner, setIsOwner] = useState(sessionStorage.getItem(ownerSessionKey) === 'true')
  const [activeRange, setActiveRange] = useState('Week')
  const [activeDevices, setActiveDevices] = useState(() => {
    const savedDevices = localStorage.getItem(deviceStorageKey)
    return savedDevices ? JSON.parse(savedDevices) as string[] : devices.map((device) => device.id)
  })
  const [selectedPoint, setSelectedPoint] = useState(3)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState('Today, 9:14 AM')
  const [historyPoints, setHistoryPoints] = useState<Point[]>(points)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => {
    fetch('./location-history.json', { cache: 'no-store' })
      .then((response) => {
        if (response.status === 404) return null
        if (!response.ok) throw new Error(`History request failed (${response.status})`)
        return response.json() as Promise<{ points?: Point[]; syncedAt?: string }>
      })
      .then((data) => {
        if (!data?.points?.length) return
        setHistoryPoints(data.points)
        if (data.syncedAt) setLastSynced(new Date(data.syncedAt).toLocaleString())
      })
      .catch((error: Error) => setHistoryError(error.message))
  }, [])

  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setInterval(() => setSelectedPoint((point) => (point + 1) % historyPoints.length), 1100)
    return () => window.clearInterval(timer)
  }, [isPlaying, historyPoints.length])

  useEffect(() => {
    const onHashChange = () => setIsSetupRoute(window.location.hash === '#/setup')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => { localStorage.setItem(deviceStorageKey, JSON.stringify(activeDevices)) }, [activeDevices])

  const toggleDevice = (id: string) => setActiveDevices((current) => current.includes(id) ? current.filter((deviceId) => deviceId !== id) : [...current, id])
  const refresh = () => { setIsSyncing(true); window.setTimeout(() => { setIsSyncing(false); setLastSynced('Just now') }, 900) }
  const visiblePoints = historyPoints.filter((point) => { const device = devices.find((item) => item.id === point.deviceId || item.name === point.device); return device && activeDevices.includes(device.id) })

  const openSetup = () => { window.location.hash = '#/setup' }
  const unlockOwner = (code: string) => {
    if (code.trim().length < 4) return false
    sessionStorage.setItem(ownerSessionKey, 'true')
    setIsOwner(true)
    return true
  }
  const signOutOwner = () => { sessionStorage.removeItem(ownerSessionKey); setIsOwner(false) }

  if (isSetupRoute) return <SetupPage isOwner={isOwner} unlockOwner={unlockOwner} signOutOwner={signOutOwner} activeDevices={activeDevices} toggleDevice={toggleDevice} />

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">w/</span><span>whereis<span className="brand-accent">REMI</span></span></div>
        <div className="header-meta"><span className="live-dot"></span> All systems connected <span className="header-divider"></span><span>Sat, Aug 23, 2025</span><button className="avatar" aria-label="Open profile">R</button></div>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <div className="eyebrow">PERSONAL ATLAS</div><h1>Where you’ve<br /><em>been.</em></h1><p className="intro">A quiet record of the places that made up your week.</p>
          <section className="side-section"><div className="section-heading"><span>DEVICES</span><button className="text-button" onClick={openSetup}>Manage</button></div><div className="device-list">{devices.map((device) => <button key={device.id} className={`device-row ${activeDevices.includes(device.id) ? 'is-active' : ''}`} onClick={() => toggleDevice(device.id)}><span className="device-icon" style={{ color: device.color }}>{device.icon}</span><span className="device-copy"><strong>{device.name}</strong><small>{device.kind}</small></span><span className="device-check">{activeDevices.includes(device.id) ? '✓' : ''}</span></button>)}</div></section>
          <section className="sync-box"><div className="sync-icon">↻</div><div><span className="section-heading">SYNC STATUS</span><strong>{isSyncing ? 'Syncing history…' : 'Up to date'}</strong><small>Last synced {lastSynced}</small></div><button className="refresh-button" onClick={refresh} aria-label="Refresh location history">↻</button></section>
          <div className="privacy-note"><span>⌁</span> Your location data stays private<br /><b>and encrypted.</b></div>
        </aside>
        <section className="main-panel">
          <div className="content-header"><div><div className="kicker">EXPLORING</div><h2>Seattle, WA <span className="chevron">⌄</span></h2></div><div className="range-tabs">{['Day', 'Week', 'Month', 'Year'].map((range) => <button key={range} className={activeRange === range ? 'selected' : ''} onClick={() => setActiveRange(range)}>{range}</button>)}</div></div>
          <div className="map-card"><div className="map-toolbar"><span className="map-label"><span className="map-pin">●</span> {visiblePoints.length} points <span className="muted">· {activeDevices.length} devices</span></span><div className="map-actions"><button aria-label="Zoom in">+</button><button aria-label="Zoom out">−</button><button aria-label="Center map">◎</button></div></div><div className="map-canvas"><div className="map-water"></div><div className="map-neighborhood n-one">BALLARD</div><div className="map-neighborhood n-two">FREMONT</div><div className="map-neighborhood n-three">CAPITOL HILL</div><div className="map-neighborhood n-four">DOWNTOWN</div><svg className="route-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Location history route"><path className="route-shadow" d="M28 63 C30 55, 37 55, 45 49 S47 58, 51 60 S56 48, 62 42 S70 46, 74 48 S78 37, 81 33 S77 52, 68 68" /><path className="route-line" d="M28 63 C30 55, 37 55, 45 49 S47 58, 51 60 S56 48, 62 42 S70 46, 74 48 S78 37, 81 33 S77 52, 68 68" /></svg>{historyPoints.map((point, index) => <button key={`${point.time}-${point.place}`} className={`map-point ${selectedPoint === index ? 'point-selected' : ''} ${visiblePoints.includes(point) ? '' : 'point-hidden'}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} onClick={() => setSelectedPoint(index)} aria-label={`${point.place} at ${point.time}`}><span></span>{selectedPoint === index && <span className="point-tooltip"><b>{point.place}</b><small>{point.time} · {point.device}</small></span>}</button>)}<div className="map-compass">N<br /><span>↑</span></div><div className="map-scale">1 km</div></div></div>
          <div className="timeline-panel"><div className="timeline-heading"><div><span className="kicker">TIMELINE</span><strong>{activeRange === 'Week' ? 'Aug 18 — Aug 24, 2025' : `${activeRange} view`}</strong></div><button className={`play-button ${isPlaying ? 'playing' : ''}`} onClick={() => setIsPlaying(!isPlaying)} aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'}>{isPlaying ? 'Ⅱ' : '▶'}</button></div>{historyError && <div className="history-error">Demo history shown. {historyError}</div>}<div className="timeline"><div className="timeline-line"></div>{historyPoints.map((point, index) => <button key={point.time} className={`timeline-stop ${selectedPoint === index ? 'active' : ''}`} style={{ left: `${(index / Math.max(historyPoints.length - 1, 1)) * 100}%` }} onClick={() => setSelectedPoint(index)}><span></span><small>{point.time}</small></button>)}</div><div className="timeline-days"><span>MON 18</span><span>WED 20</span><span>FRI 22</span><span>SUN 24</span></div></div>
          <div className="bottom-grid"><section><div className="kicker">PLACES DETECTED</div><h3>Your regulars</h3><div className="places"><div className="place-item"><span className="place-dot home"></span><span><b>Home</b><small>12h 48m · 3 visits</small></span><button aria-label="Edit Home label">···</button></div><div className="place-item"><span className="place-dot work"></span><span><b>Northline Coffee</b><small>1h 16m · 4 visits</small></span><button aria-label="Edit Northline Coffee label">···</button></div></div></section><section className="day-summary"><div className="kicker">THIS WEEK</div><strong>42.8 <small>km traveled</small></strong><div className="summary-bar"><span></span></div><p>Across 8 places <span>↗ +12%</span></p></section></div>
        </section>
      </div>
    </main>
  )
}

type SetupPageProps = {
  isOwner: boolean
  unlockOwner: (code: string) => boolean
  signOutOwner: () => void
  activeDevices: string[]
  toggleDevice: (id: string) => void
}

function SetupPage({ isOwner, unlockOwner, signOutOwner, activeDevices, toggleDevice }: SetupPageProps) {
  const [code, setCode] = useState('')
  const [hasError, setHasError] = useState(false)

  if (!isOwner) return (
    <main className="setup-shell">
      <div className="setup-gate">
        <div className="brand"><span className="brand-mark">w/</span><span>whereis<span className="brand-accent">REMI</span></span></div>
        <div className="lock-mark">⌁</div><div className="eyebrow">PRIVATE SETUP</div><h1>Owner access</h1>
        <p>Enter your owner code to manage the devices shown on the public atlas.</p>
        <form onSubmit={(event) => { event.preventDefault(); setHasError(!unlockOwner(code)) }}><label htmlFor="owner-code">Owner code</label><input id="owner-code" type="password" value={code} onChange={(event) => setCode(event.target.value)} autoFocus /><button className="primary-button" type="submit">Unlock setup <span>→</span></button></form>
        {hasError && <small className="form-error">Use an owner code with at least 4 characters.</small>}
        <button className="back-link" onClick={() => { window.location.hash = '' }}>← Back to public atlas</button>
      </div>
    </main>
  )

  return (
    <main className="setup-shell"><header className="topbar"><div className="brand"><span className="brand-mark">w/</span><span>whereis<span className="brand-accent">REMI</span></span></div><button className="back-link" onClick={() => { window.location.hash = ''; signOutOwner() }}>Exit setup</button></header><section className="setup-content"><div className="kicker">PRIVATE SETUP</div><h1>Device publishing</h1><p className="setup-intro">Choose which connected devices contribute to the public-facing atlas. Changes save automatically in this browser.</p><div className="setup-card"><div className="setup-card-header"><div><h2>Connected devices</h2><p>{activeDevices.length} of {devices.length} devices publishing</p></div><span className="setup-status"><i></i> Local only</span></div>{devices.map((device) => <button className={`setup-device ${activeDevices.includes(device.id) ? 'enabled' : ''}`} key={device.id} onClick={() => toggleDevice(device.id)}><span className="device-icon" style={{ color: device.color }}>{device.icon}</span><span className="device-copy"><strong>{device.name}</strong><small>{device.kind} · Connected</small></span><span className="toggle"><i></i></span></button>)}</div><div className="setup-note"><span>⌁</span><p><b>About this gate</b><br />GitHub Pages is static hosting, so this owner gate lives in your browser. For real access control, put the setup route behind an identity-aware host or backend.</p></div><button className="back-link" onClick={() => { window.location.hash = '' }}>← View public atlas</button></section></main>
  )
}

export default App
