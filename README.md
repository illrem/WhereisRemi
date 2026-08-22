# whereisREMI

The public Vite app reads `public/location-history.json`. GitHub Actions can refresh that file from SmartThings without exposing the SmartThings token to the browser.

## Local SmartThings sync

PowerShell:

```powershell
$env:SMARTTHINGS_TOKEN = 'your-personal-access-token'
$env:SMARTTHINGS_LOCATION_ID = 'your-location-id'
$env:SMARTTHINGS_HISTORY_URL = 'https://api.smartthings.com/v1/history/devices?locationId=your-location-id'
npm run sync-history
npm run dev
```

`SMARTTHINGS_HISTORY_URL` is optional and lets you use the exact history URL provided by your approved SmartThings integration. Tokens must only be passed as environment variables or GitHub Actions secrets.

## GitHub Actions setup

Add `SMARTTHINGS_TOKEN` and `SMARTTHINGS_LOCATION_ID` as repository Actions secrets. Add `SMARTTHINGS_HISTORY_URL` too if the default history URL is not the one provided by SmartThings. Then run **Actions > Sync SmartThings history > Run workflow**. The workflow in `.github/workflows/sync-history.yml` updates the public JSON every 15 minutes.

Location history written to `public/` is public. Remove exact addresses or reduce coordinate precision before publishing if the site is public.

If the workflow fails, open the failed **Validate SmartThings configuration** or **Fetch SmartThings history** step. A `401` usually means the token is invalid or expired, a `403` means the token does not have the required history permission, and a `404` means the history URL is not available for your SmartThings integration. In the last two cases, set `SMARTTHINGS_HISTORY_URL` to the exact approved endpoint or use SmartThings OAuth instead of a personal token.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
