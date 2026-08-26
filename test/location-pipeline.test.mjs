import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const configPath = new URL('../secrets/location.test.json', import.meta.url)

async function loadConfig() {
  let config
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'))
  } catch {
    throw new Error('Create secrets/location.test.json from secrets/location.test.example.json before running npm test.')
  }
  for (const key of ['owntracksUrl', 'locationsUrl', 'owntracksToken', 'exportToken']) {
    if (!config[key] || config[key].startsWith('replace-')) throw new Error(`Set ${key} in secrets/location.test.json.`)
  }
  return config
}

test('international test locations are exported with the expected privacy labels', async () => {
  const config = await loadConfig()
  const locations = [
    { lat: 51.47, lon: -2.58, expectedCountry: 'UK', expectedPlace: 'UK' },
    { lat: 48.86, lon: 2.35, expectedCountry: 'FR', expectedPlace: 'Paris' },
    { lat: 40.71, lon: -74.01, expectedCountry: 'US', expectedPlace: 'New York' },
    { lat: 35.68, lon: 139.69, expectedCountry: 'JP', expectedPlace: 'Tokyo' },
    { lat: -33.87, lon: 151.21, expectedCountry: 'AU', expectedPlace: 'Sydney' },
    { lat: -33.92, lon: 18.42, expectedCountry: 'ZA', expectedPlace: 'Cape Town' },
  ]
  const firstTimestamp = Math.floor(Date.now() / 1000)

  for (const [index, location] of locations.entries()) {
    const receive = await fetch(config.owntracksUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-location-token': config.owntracksToken },
      body: JSON.stringify({ _type: 'location', lat: location.lat, lon: location.lon, acc: 1, tid: 'test', tst: firstTimestamp + index }),
    })
    const receiveBody = await receive.text()
    assert.equal(receive.ok, true, `OwnTracks request failed: ${receive.status} ${receiveBody}`)
  }

  const exportResponse = await fetch(config.locationsUrl, {
    headers: { Authorization: `Bearer ${config.exportToken}`, Accept: 'application/json' },
  })
  const exportBody = await exportResponse.text()
  assert.equal(exportResponse.ok, true, `Location export failed: ${exportResponse.status} ${exportBody}`)

  const payload = JSON.parse(exportBody)
  for (const [index, location] of locations.entries()) {
    const roundedLat = Math.round(location.lat * 100) / 100
    const roundedLng = Math.round(location.lon * 100) / 100
    const expectedLat = location.expectedCountry === 'UK' ? Math.round(roundedLat) : roundedLat
    const expectedLng = location.expectedCountry === 'UK' ? Math.round(roundedLng) : roundedLng
    const expectedAccuracy = location.expectedCountry === 'UK' ? 100 : 1
    const point = payload.points?.find((candidate) => candidate.lat === expectedLat && candidate.lng === expectedLng && candidate.place === location.expectedPlace)
    assert.ok(point, `No exported point found for ${location.lat}, ${location.lon}`)
    assert.equal(point.country, location.expectedCountry)
    assert.equal(point.place, location.expectedPlace)
    assert.equal(point.accuracyKm, expectedAccuracy)
    assert.equal(point.lat, expectedLat)
    assert.equal(point.lng, expectedLng)
  }
})
