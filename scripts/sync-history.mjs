import { mkdir, readFile, writeFile } from 'node:fs/promises'

const token = process.env.SMARTTHINGS_TOKEN
const locationId = process.env.SMARTTHINGS_LOCATION_ID
if (!token) throw new Error('SMARTTHINGS_TOKEN is required.')
if (!locationId || locationId === 'YOUR_LOCATION_ID') throw new Error('SMARTTHINGS_LOCATION_ID is missing.')
const url = process.env.SMARTTHINGS_HISTORY_URL || `https://api.smartthings.com/v1/history/devices?locationId=${encodeURIComponent(locationId)}`
const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
if (!response.ok) throw new Error(`SmartThings history request failed: ${response.status} ${response.statusText}`)
const payload = await response.json()
const notes = await readJson('public/location-notes.json', {})
const records = collect(payload).map(normalize).filter(Boolean).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
const output = { syncedAt: new Date().toISOString(), points: records.map((point) => ({
  time: point.timestamp, city: point.country === 'UK' ? undefined : point.city, country: point.country,
  place: point.country === 'UK' ? 'UK' : point.city, accuracyKm: 1, note: notes[point.timestamp]?.note, video: notes[point.timestamp]?.video,
  x: point.x, y: point.y,
})).map(stripUndefined) }
await mkdir('public', { recursive: true })
await writeFile('public/location-history.json', `${JSON.stringify(output, null, 2)}\n`)
console.log(`Wrote ${output.points.length} privacy-rounded points.`)

function collect(value) {
  if (Array.isArray(value)) return value.flatMap(collect)
  if (!value || typeof value !== 'object') return []
  for (const key of ['items', 'history', 'events', 'locations', 'data']) if (Array.isArray(value[key])) return value[key].flatMap(collect)
  return value.latitude !== undefined || value.lat !== undefined || value.location ? [value] : []
}
function normalize(record) {
  const latitude = Number(record.latitude ?? record.lat ?? record.location?.latitude ?? record.location?.lat)
  const longitude = Number(record.longitude ?? record.lng ?? record.location?.longitude ?? record.location?.lng)
  const rawTime = record.timestamp ?? record.time ?? record.createdAt ?? record.occurredAt
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !rawTime) return null
  const timestamp = new Date(rawTime).toISOString()
  const country = String(record.country ?? record.location?.country ?? '').toLowerCase().includes('kingdom') || String(record.country ?? '').toLowerCase() === 'uk' ? 'UK' : String(record.country ?? '')
  return { timestamp, country, city: record.city ?? record.location?.city ?? record.place ?? 'Somewhere new', latitude, longitude }
}
function stripUndefined(value) { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) }
function readJson(path, fallback) { return readFile(path, 'utf8').then(JSON.parse).catch(() => fallback) }
