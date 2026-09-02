import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions'
import { TableClient, TableEntity } from '@azure/data-tables'
import crypto from 'node:crypto'

type OwnTracksLocation = { _type?: string; lat?: number; lon?: number; tst?: number; acc?: number; tid?: string; batt?: number }
type LocationEntity = TableEntity & { eventTimestamp?: string; latitude: number; longitude: number; accuracy?: number; tracker?: string; battery?: number; city?: string; country?: string }

const tableName = process.env.LOCATION_TABLE_NAME || 'LocationPoints'
const client = TableClient.fromConnectionString(process.env.AzureWebJobsStorage || '', tableName)

function authorized(request: HttpRequest, expected: string | undefined, basicUser?: string, basicPassword?: string) {
  const token = request.headers.get('x-location-token') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (expected && token) {
    const supplied = Buffer.from(token)
    const configured = Buffer.from(expected)
    if (supplied.length === configured.length && crypto.timingSafeEqual(supplied, configured)) return true
  }
  const basic = request.headers.get('authorization')?.match(/^Basic\s+(.+)$/i)
  if (!basic) return false
  const credentials = Buffer.from(basic[1], 'base64').toString('utf8')
  const accepted = [
    basicUser && basicPassword ? `${basicUser}:${basicPassword}` : '',
    expected ? `owntracks:${expected}` : '',
  ].filter(Boolean)
  return accepted.some((candidate) => {
    const supplied = Buffer.from(credentials)
    const configured = Buffer.from(candidate)
    return supplied.length === configured.length && crypto.timingSafeEqual(supplied, configured)
  })
}
function json(body: unknown, status = 200): HttpResponseInit { return { status, jsonBody: body, headers: { 'Cache-Control': 'no-store' } } }
function isUK(country: string | undefined) { return /^(gb|uk|united kingdom|england|scotland|wales|northern ireland)$/i.test(country || '') }
function roundKm(value: number) { return Math.round(value * 100) / 100 }
function round100Km(value: number) { return Math.round(value) }
const duplicateCoordinateDelta = 0.01

function locationTimestamp(entity: LocationEntity) {
  if (entity.eventTimestamp) return entity.eventTimestamp
  const match = entity.rowKey.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})-/)
  return match ? `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${match[7]}Z` : undefined
}

async function latestLocation() {
  let latest: LocationEntity | undefined
  for await (const entity of client.listEntities<LocationEntity>({ queryOptions: { filter: "PartitionKey eq 'location'" } })) {
    const entityTime = locationTimestamp(entity)
    const latestTime = latest && locationTimestamp(latest)
    if (entityTime && (!latestTime || Date.parse(entityTime) > Date.parse(latestTime))) latest = entity
  }
  return latest
}

function isSameDayNearbyLocation(location: LocationEntity | undefined, newTimestamp: string, latitude: number, longitude: number) {
  if (!location) return false
  const timestamp = locationTimestamp(location)
  if (!timestamp) return false
  const isSameDay = timestamp.slice(0, 10) === newTimestamp.slice(0, 10)
  const isNearby = Math.abs(location.latitude - latitude) <= duplicateCoordinateDelta &&
    Math.abs(location.longitude - longitude) <= duplicateCoordinateDelta
  return isSameDay && isNearby
}

async function reverseGeocode(latitude: number, longitude: number) {
  const key = process.env.AZURE_MAPS_KEY
  if (!key) return {}
  const params = new URLSearchParams({
    'api-version': '1.0',
    query: `${latitude},${longitude}`,
    language: 'en-GB',
    'subscription-key': key,
  })
  const response = await fetch(`https://atlas.microsoft.com/search/address/reverse/json?${params}`)
  if (!response.ok) return {}
  const result = await response.json() as { addresses?: Array<{ address?: { municipality?: string; countryCode?: string } }> }
  const address = result.addresses?.[0]?.address
  return { city: address?.municipality, country: address?.countryCode }
}

async function receive(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const contentType = request.headers.get('content-type') || '[missing]'
  const authorization = request.headers.get('authorization')
  const tokenHeader = request.headers.get('x-location-token')
  const rawBody = await request.text()
  context.log(`OwnTracks request: content-type=${contentType}, basic-auth=${authorization?.startsWith('Basic ') ? 'present' : 'absent'}, token-header=${tokenHeader ? 'present' : 'absent'}`)
  context.log(`OwnTracks body: ${rawBody || '[empty]'}`)
  if (!authorized(request, process.env.OWNTRACKS_TOKEN, process.env.OWNTRACKS_USER, process.env.OWNTRACKS_PASSWORD)) return json({ error: 'Unauthorized' }, 401)
  let body: OwnTracksLocation
  try {
    body = JSON.parse(rawBody) as OwnTracksLocation
  } catch {
    context.log('OwnTracks payload is not valid JSON.')
    return json({ error: 'Request body must be valid JSON.' }, 400)
  }
  if (body._type && body._type !== 'location') {
    context.log(`Ignoring OwnTracks ${body._type} event; only location events are stored.`)
    return json([], 200)
  }
  if (!Number.isFinite(body.lat) || !Number.isFinite(body.lon)) return json({ error: 'lat and lon are required.' }, 400)
  await client.createTable()
  const timestamp = new Date((body.tst || Math.floor(Date.now() / 1000)) * 1000).toISOString()
  if (isSameDayNearbyLocation(await latestLocation(), timestamp, body.lat!, body.lon!)) {
    context.log('Ignoring recent nearby OwnTracks location.')
    return json([], 200)
  }
  const geocode = await reverseGeocode(body.lat!, body.lon!)
  const entity: LocationEntity = {
    partitionKey: 'location', rowKey: `${timestamp.replace(/\D/g, '')}-${crypto.randomUUID()}`,
    eventTimestamp: timestamp, latitude: roundKm(body.lat!), longitude: roundKm(body.lon!), accuracy: body.acc, tracker: body.tid, battery: body.batt,
    city: isUK(geocode.country) ? undefined : geocode.city, country: isUK(geocode.country) ? 'UK' : geocode.country,
  }
  await client.upsertEntity(entity, 'Replace')
  context.log(`Stored OwnTracks point ${timestamp}`)
  return json([], 200)
}

async function exportLocations(request: HttpRequest): Promise<HttpResponseInit> {
  if (!authorized(request, process.env.EXPORT_TOKEN)) return json({ error: 'Unauthorized' }, 401)
  await client.createTable()
  const points: Array<Record<string, unknown>> = []
  for await (const entity of client.listEntities<LocationEntity>()) {
    const timestamp = locationTimestamp(entity)
    if (!timestamp) continue
    const isUnitedKingdom = entity.country === 'UK'
    points.push({ time: timestamp, city: isUnitedKingdom ? undefined : entity.city, country: entity.country, place: isUnitedKingdom ? 'UK' : entity.city || 'adventure', accuracyKm: isUnitedKingdom ? 100 : 1, lat: isUnitedKingdom ? round100Km(entity.latitude) : entity.latitude, lng: isUnitedKingdom ? round100Km(entity.longitude) : entity.longitude })
  }
  points.sort((a, b) => String(b.time).localeCompare(String(a.time)))
  return json({ syncedAt: new Date().toISOString(), points: points.map((point) => Object.fromEntries(Object.entries(point).filter(([, value]) => value !== undefined))) })
}

app.http('owntracks', { methods: ['POST'], authLevel: 'anonymous', route: 'owntracks', handler: receive })
app.http('exportLocations', { methods: ['GET'], authLevel: 'anonymous', route: 'locations', handler: exportLocations })
