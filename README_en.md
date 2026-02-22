# Box Direct Link Copy

A Chrome extension that lets you copy Box direct links (not temporary shared links) directly from list and grid views.

- Folder: `https://<tenant>.app.box.com/folder/{id}`
- File: `https://<tenant>.app.box.com/file/{id}`

## What It Does

- Adds a direct-link copy icon next to item names in list view
- Adds a direct-link copy icon at the top-left of cards in grid view
- Adds `Copy direct link` to the `...` (more options) menu for rows/cards
- Shows a toast message near the clicked icon after copy
- Auto-switches UI messages by locale (`ja`: Japanese / others: English)

## Usage

### List View

- Click the chain icon next to the file/folder name
- Or open `...` menu and click `Copy direct link`

### Grid View

- Click the chain icon at the top-left of each card
- Or open `...` menu and click `Copy direct link`

## Installation (Developer Mode)

1. Open `chrome://extensions` in Chrome
2. Enable `Developer mode` (top right)
3. Click `Load unpacked`
4. Select this repository directory
5. Open a Box listing page and verify behavior

## Known Limitations

- Targets Box Web list/grid UI only (`https://app.box.com/*`, `https://*.app.box.com/*`)
- Behavior may require updates if Box changes its DOM/UI
- Copied URLs are direct links for users who already have Box access permissions
