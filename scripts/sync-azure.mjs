import { mkdir, writeFile } from 'node:fs/promises'

const url = process.env.AZURE_LOCATION_API_URL
const token = process.env.AZURE_LOCATION_API_TOKEN
if (!url || !token) throw new Error('AZURE_LOCATION_API_URL and AZURE_LOCATION_API_TOKEN are required.')
const response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
if (!response.ok) throw new Error(`Azure location export failed: ${response.status} ${response.statusText}`)
const payload = await response.json()
await mkdir('public', { recursive: true })
await writeFile('public/location-history.json', `${JSON.stringify(payload, null, 2)}\n`)
console.log(`Wrote ${payload.points?.length || 0} location points from Azure.`)
