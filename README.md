# whereisREMI

A privacy-aware GitHub Pages location journal. The site reads `public/location-history.json`; it never receives an OwnTracks or Azure token.

## OwnTracks + Azure setup

1. Create an Azure Storage account and an Azure Functions app using the Node.js 24 model. In the Function App configuration, add `AzureWebJobsStorage`, `OWNTRACKS_TOKEN`, `EXPORT_TOKEN`, and `LOCATION_TABLE_NAME=LocationPoints`. Add `AZURE_MAPS_KEY` if you want reverse-geocoded city names; without it, the app falls back to `adventure`. You can use `OWNTRACKS_USER` and `OWNTRACKS_PASSWORD` instead of the token header if your OwnTracks client is configured for Basic Auth.
2. Create `backend/package-lock.json` with `cd backend; npm install`, then add `AZURE_FUNCTIONAPP_NAME` and `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` as GitHub Actions secrets. The `Deploy Azure Functions API` workflow deploys changes under `backend/`.
3. Configure OwnTracks HTTP mode with the deployed URL `https://YOUR_FUNCTION_APP.azurewebsites.net/api/owntracks`, method `POST`, and JSON/Webhook payload mode. Use the `x-location-token` header with `OWNTRACKS_TOKEN`, or the OwnTracks username/password fields with `OWNTRACKS_USER` and `OWNTRACKS_PASSWORD`. OwnTracks sends its `_type=location`, `lat`, `lon`, `tst`, `acc`, and `tid` fields to the Function.
4. Add `AZURE_LOCATION_API_URL` as `https://YOUR_FUNCTION_APP.azurewebsites.net/api/locations` and `AZURE_LOCATION_API_TOKEN` set to the same value as `EXPORT_TOKEN`. The `Sync Azure location history` workflow copies the sanitized export to the Pages site every 15 minutes.

The Function stores location points in Azure Table Storage and rounds coordinates before export. Azure Maps supplies city/country names when configured; UK results use `UK` as the country while retaining the city name when available. Keep `OWNTRACKS_TOKEN` and `EXPORT_TOKEN` different, long, and random.

## Setup

1. Add repository Actions secrets named `SMARTTHINGS_TOKEN` and `SMARTTHINGS_LOCATION_ID`. Add `SMARTTHINGS_HISTORY_URL` only when your approved SmartThings integration uses a different endpoint.
2. Enable GitHub Pages with **GitHub Actions** as the source.
3. Run **Sync location history** once, or wait for the 15-minute schedule.

The workflow fetches history server-side and publishes city-level locations. It intentionally does not publish exact coordinates. Edit `public/location-notes.json` to attach a `note` and YouTube `video` URL keyed by the exact point timestamp; the next sync carries those fields into the public history.

Location history is public. Review the generated JSON before publishing and remove anything you do not want friends and family to see.

## Test the location pipeline

Copy `secrets/location.test.example.json` to `secrets/location.test.json` and fill in the deployed OwnTracks URL, locations export URL, and both tokens. The secrets folder is ignored by Git. Run `npm test` to submit test points from six regions and verify that UK exports as `place: "UK"` while other locations use their city names. Test posts identify themselves with `tid: "test"`.
