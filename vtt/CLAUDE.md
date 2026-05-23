# VTT Sub-project — Claude Context

## Overview
A lightweight Virtual Tabletop (VTT) desktop application built as a Tauri v2 + PixiJS v8 + React sub-project inside the DM Toolkit monorepo.

## Prerequisites
- Rust toolchain (`rustup`, `cargo`)
- pnpm
- Tauri CLI: `cargo install tauri-cli --version "^2"`

## Architecture
- **Controller window** (`index.html`): React UI for the DM. Opens/closes the Player window, sends scene/map data over IPC.
- **Player window** (`player.html`): PixiJS v8 canvas fills the entire window. Receives data from Controller and renders the VTT scene.
- Both windows are separate Vite entry points with their own React roots.

## Key Patterns

### IPC
All cross-window communication uses Tauri events (`emit` / `listen`), never Tauri commands. Event names and payload types live in `src/shared/types/ipc.ts`.

### Monitor detection
`availableMonitors()` returns physical pixel coordinates. Divide by `scaleFactor` before passing to `WebviewWindow` options (which use logical pixels).

### PixiJS canvas
`PlayerView` appends the PixiJS canvas directly to `<body>` — it renders `null` from React. Destroy the app in the `useEffect` cleanup to avoid double-init in StrictMode.

### Theme
`ThemeContext` mirrors the webapp pattern. Controller syncs theme to Player via `VTT_EVENTS.THEME_CHANGED` after `PLAYER_READY` is received.

## Development
```bash
cd vtt
pnpm install
pnpm tauri dev      # starts Vite dev server + Tauri
```

## Build
```bash
pnpm tauri build
```

## Releasing

Releases are triggered by pushing a git tag matching `v*.*.*`:
```bash
git tag v0.2.0
git push origin v0.2.0
```

GitHub Actions (`.github/workflows/build-vtt.yml`) will:
1. Create a draft GitHub Release with auto-generated notes
2. Build macOS universal binary and Windows x64 installer in parallel
3. Upload both installers to the release
4. Publish the release

The `frontend/src/pages/DownloadPage.tsx` page fetches the latest release from the GitHub API and shows platform download buttons.

## Code Signing Setup

### Tauri updater signing (required for auto-updater)

Generate a key pair once:
```bash
cargo tauri signer generate -w ~/.tauri/vtt.key
```

This prints a public key. Copy it into `src-tauri/tauri.conf.json`:
```json
"plugins": {
  "updater": {
    "pubkey": "PASTE_PUBLIC_KEY_HERE",
    ...
  }
}
```

Add the private key (contents of `~/.tauri/vtt.key`) as a GitHub repository secret:
- `TAURI_SIGNING_PRIVATE_KEY` — the private key file contents
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — if you set a password during generation

### macOS code signing (optional, removes security warning)

Requires Apple Developer Program ($99/year). Without signing, users see an
"unidentified developer" warning and must right-click → Open.

Add these GitHub secrets:
| Secret | How to get it |
|---|---|
| `APPLE_CERTIFICATE` | Export Developer ID Application cert from Keychain as .p12, then `base64 -i cert.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | The password you set when exporting |
| `APPLE_SIGNING_IDENTITY` | Run `security find-identity -v -p codesigning` |
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | 10-char team ID from developer.apple.com/account |

### Windows SmartScreen (optional, removes security warning)

Requires an Extended Validation (EV) code signing certificate from a CA
like DigiCert or Sectigo (~$300+/year). Without it, Windows shows a
"Windows protected your PC" SmartScreen warning on first install — users
dismiss it with "More info → Run anyway". For internal/DM use this is fine.

## Updater endpoint

The auto-updater checks:
```
https://github.com/sven-johnson/DM-Toolkit/releases/latest/download/latest.json
```

GitHub's `/releases/latest/download/` redirect always points to the
most recent release's `latest.json` asset. This file is generated and
uploaded automatically by `tauri-apps/tauri-action` when
`TAURI_SIGNING_PRIVATE_KEY` is set and `createUpdaterArtifacts` is
configured in `tauri.conf.json`.

If the repo is renamed or transferred, update the endpoint URL in
`src-tauri/tauri.conf.json` and re-release.
