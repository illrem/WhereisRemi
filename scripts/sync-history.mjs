import { mkdir, writeFile } from 'node:fs/promises'

const token = process.env.SMARTTHINGS_TOKEN
const locationId = process.env.SMARTTHINGS_LOCATION_ID
const apiBase = process.env.SMARTTHINGS_API_BASE || 'https://api.smartthings.com/v1'
const historyUrl = process.env.SMARTTHINGS_HISTORY_URL || `${apiBase}/history/devices?locationId=${encodeURIComponent(locationId)}`

if (!token) throw new Error('SMARTTHINGS_TOKEN is required')
if (!locationId) throw new Error('SMARTTHINGS_LOCATION_ID is required')

const response = await fetch(historyUrl, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
if (!response.ok) throw new Error(`SmartThings history request failed: ${response.status} ${response.statusText}`)

const payload = await response.json()
const records = collectRecords(payload)
const points = records
  .map(normalizeRecord)
  .filter((point) => point !== null)
  .sort((left, right) => left.timestamp.localeCompare(right.timestamp))

const output = {
  syncedAt: new Date().toISOString(),
  locationId,
  points: projectCoordinates(points),
}

await mkdir('public', { recursive: true })
await writeFile('public/location-history.json', `${JSON.stringify(output, null, 2)}\n`)
console.log(`Wrote ${output.points.length} location points to public/location-history.json`)

function collectRecords(value) {
  if (Array.isArray(value)) return value.flatMap(collectRecords)
  if (!value || typeof value !== 'object') return []
  const object = value
  for (const key of ['items', 'history', 'events', 'locations', 'data']) {
    if (Array.isArray(object[key])) return object[key].flatMap(collectRecords)
  }
  return object.latitude !== undefined || object.lat !== undefined ? [object] : []
}

function normalizeRecord(record) {
  const latitude = Number(record.latitude ?? record.lat ?? record.location?.latitude ?? record.location?.lat)
  const longitude = Number(record.longitude ?? record.lng ?? record.lon ?? record.location?.longitude ?? record.location?.lng)
  const rawTimestamp = record.timestamp ?? record.time ?? record.createdAt ?? record.occurredAt
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !rawTimestamp) return null
  return {
    timestamp: new Date(rawTimestamp).toISOString(),
    latitude,
    longitude,
    accuracy: Number(record.accuracy ?? record.location?.accuracy ?? 0),
    deviceId: canonicalDeviceId(String(record.deviceName ?? record.device?.name ?? record.deviceId ?? 'unknown')),
    device: String(record.deviceName ?? record.device?.name ?? record.deviceId ?? 'SmartThings device'),
    place: String(record.place ?? record.locationName ?? 'Unknown place'),
  }
}

function canonicalDeviceId(name) {
  const normalized = name.toLowerCase()
  if (normalized.includes('watch')) return 'watch'
  if (normalized.includes('tag') || normalized.includes('tracker') || normalized.includes('keys')) return 'tag'
  if (normalized.includes('phone') || normalized.includes('galaxy') || normalized.includes('mobile')) return 'phone'
  return name
}

function projectCoordinates(points) {
  if (!points.length) return []
  const latitudes = points.map((point) => point.latitude)
  const longitudes = points.map((point) => point.longitude)
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLon = Math.min(...longitudes)
  const maxLon = Math.max(...longitudes)
  return points.map((point) => ({
    x: scale(point.longitude, minLon, maxLon),
    y: 100 - scale(point.latitude, minLat, maxLat),
    time: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    place: point.place,
    device: point.device,
    address: '',
    accuracy: `${point.accuracy}m`,
    timestamp: point.timestamp,
    latitude: point.latitude,
    longitude: point.longitude,
    deviceId: point.deviceId,
  }))
}

function scale(value, minimum, maximum) {
  if (minimum === maximum) return 50
  return Math.round(((value - minimum) / (maximum - minimum)) * 1000) / 10
}
