# Quest Forge — Electron App

A minimal desktop app to post quests to Quest Hall.

## Requirements

- Node.js 18+
- npm

## Setup

```bash
cd electron-quest-app
npm install
```

## Run (development)

```bash
npm start
```

## Build distributables

```bash
# All platforms (requires cross-compile tooling)
npm run build

# Windows only
npm run build:win

# macOS only (run on macOS)
npm run build:mac

# Linux only
npm run build:linux
```

Built files are output to `dist/`.

## Configuration

On first launch Quest Forge opens the Settings tab automatically.

Fill in:
- **Server URL** — your Quest Hall server (e.g. `http://187.77.139.247:3001`)
- **API Key** — your API key

Settings are saved locally and persist across sessions.

## Usage

1. Fill in **Quest Title** (required)
2. Optionally add a **Description**
3. Select **Priority** (low / medium / high)
4. Tick one or more **Categories** (multi-select checkboxes)
5. Check **Human Input Required** if Leon needs to be involved
6. Click **Post Quest**

On success the form clears and shows the new quest ID.
The quest appears immediately on the Quest Hall Quest Board.
