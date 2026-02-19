# Security Review (2026-02-19)

## Scope

- `manifest.json`
- `src/content.js`
- `src/content.css`
- `scripts/build-webstore-zip.sh`

## Automated checks

1. JavaScript syntax

```bash
node --check src/content.js
```

- Result: pass

2. Dangerous API grep

```bash
rg -n "\\beval\\b|new Function|innerHTML\\s*=|outerHTML\\s*=|document\\.write|setTimeout\\(\\s*['\"]|setInterval\\(\\s*['\"]|postMessage\\(|fetch\\(|XMLHttpRequest|WebSocket" src manifest.json
```

- Result: no matches
- Notes: no dynamic code execution, no external network calls, no HTML string injection assignment

3. Package validation

```bash
./scripts/build-webstore-zip.sh
unzip -l dist/*.zip
```

- Result: package contains only manifest, source, icons, license, readme

## Permission review

- `permissions`: `clipboardWrite` only
- `host access`: limited by content script matches
  - `https://app.box.com/*`
  - `https://*.app.box.com/*`

## Data handling review

- No external API calls
- No storage API usage
- No background/service worker
- Reads Box DOM only to compose direct URL and copy to clipboard

## Remaining risks

- DOM selector breakage when Box UI changes (availability risk, not direct security risk)
- Overly broad host match across all `*.app.box.com` tenants may require policy justification in review notes

## Mitigation

- Keep selectors centralized in constants for fast patching
- Document single purpose clearly in store listing and privacy tab
- Avoid adding new permissions without explicit need
