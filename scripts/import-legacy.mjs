import { readFile } from 'node:fs/promises'

const config = JSON.parse(
  await readFile(new URL('../secrets/location.test.json', import.meta.url), 'utf8'),
)

const locations = [
  ['2022-06-03', 'Marrakech', 31.63, -8.00],
  ['2022-06-09', 'Casablanca', 33.57, -7.59],
  ['2022-06-12', 'Tangier', 35.76, -5.83],
  ['2022-07-01', 'Ibiza', 38.91, 1.43],
  ['2022-08-28', 'Amsterdam', 52.37, 4.90],

  ['2023-03-10', 'Berlin', 52.52, 13.41],
  ['2023-05-10', 'Cairo', 30.04, 31.24],
  ['2023-05-14', 'Luxor', 25.69, 32.64],
  ['2023-06-01', 'Santander', 43.46, -3.81],
  ['2023-07-01', 'Ibiza', 38.91, 1.43],
  ['2023-08-30', 'Dortmund', 51.51, 7.47],
  ['2023-10-05', 'Perpignan', 42.69, 2.89],

  ['2024-07-05', 'Barcelona', 41.39, 2.17],
  ['2024-09-22', 'Split', 43.51, 16.44],
  ['2024-11-15', 'Bangkok', 13.76, 100.50],
  ['2024-11-20', 'Chiang Mai', 18.79, 98.99],
  ['2024-11-26', 'Phi Phi', 7.74, 98.78],

  ['2025-02-27', 'Zakopane', 49.30, 19.95],  
  ['2025-03-15', 'Hong Kong', 22.32, 114.17],
  ['2025-03-17', 'Fukuoka', 33.59, 130.40],
  ['2025-03-21', 'Osaka', 34.69, 135.50],
  ['2025-03-27', 'Tokyo', 35.68, 139.69],
  ['2025-04-01', 'Hanoi', 21.03, 105.85],
  ['2025-04-28', 'Lagos', 6.52, 3.38],
  ['2025-06-27', 'Berlin', 52.52, 13.41],
  ['2025-08-04', 'Normandy', 49.18, -0.37],
  ['2025-08-17', 'Paris', 48.86, 2.35],
  ['2025-08-21', 'Interlaken', 46.69, 7.86],
  ['2025-08-24', 'Stuttgart', 48.78, 9.18],
  ['2025-08-25', 'Luxembourg', 49.61, 6.13],
  ['2025-08-26', 'Brussels', 50.85, 4.35],
  ['2025-09-14', 'Antalya', 36.90, 30.70],

  ['2026-01-30', 'Reykjavik', 64.15, -21.94],
  ['2026-04-13', 'Tenerife', 28.46, -16.25],
  ['2026-04-20', 'Cape Town', -33.92, 18.42],
  ['2026-04-29', 'Geberha', -33.96, 25.60],
  ['2026-05-04', 'Johannesburg', -26.20, 28.05],
  ['2026-05-27', 'Paris', 48.86, 2.35],
  ['2026-06-01', 'Clermont-Ferrand', 45.78, 3.09],
  ['2026-06-03', 'Nice', 43.71, 7.26],
  ['2026-06-04', 'Monaco', 43.74, 7.42],
  ['2026-06-08', 'La Spezia', 44.10, 9.82],
  ['2026-06-14', 'Lake Garda', 45.60, 10.65],
  ['2026-06-15', 'Lienz', 46.83, 12.77],
  ['2026-06-16', 'Ljubljana', 46.06, 14.51],
  ['2026-06-20', 'Venice', 45.44, 12.32],
  ['2026-07-18', 'Parma', 44.80, 10.33],
]

for (const [date, place, lat, lon] of locations) {
  const timestamp = Math.floor(new Date(`${date}T12:00:00Z`).getTime() / 1000)

  const response = await fetch(config.owntracksUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-location-token': config.owntracksToken,
    },
    body: JSON.stringify({
      _type: 'location',
      lat,
      lon,
      acc: 1,
      tid: 'legacy',
      tst: timestamp,
    }),
  })

  const body = await response.text()

  if (!response.ok) {
    throw new Error(`${date} ${place} failed: ${response.status} ${body}`)
  }

  console.log(`${date} ${place}: imported`)
}