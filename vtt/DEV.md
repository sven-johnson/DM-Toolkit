# VTT — Local Development Guide

Run and build the VTT desktop app locally without touching GitHub.

---

## Prerequisites

### All platforms

| Tool | Version | Install |
|---|---|---|
| Rust | stable | [rustup.rs](https://rustup.rs) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) or `nvm` |
| pnpm | 9+ | `npm install -g pnpm` |
| Tauri CLI | v2 | `cargo install tauri-cli --version "^2"` |

### macOS only

```bash
xcode-select --install
```

### Windows only

- **Visual Studio C++ Build Tools** — install from
  [visualstudio.microsoft.com/visual-cpp-build-tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
  Select "Desktop development with C++" workload.
- **WebView2** — pre-installed on Windows 11. If on Windows 10, download from
  [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

---

## First-time setup

```bash
cd vtt
pnpm install                                          # install JS dependencies
cargo fetch --manifest-path src-tauri/Cargo.toml     # pre-fetch Rust crates (optional, speeds up first build)
```

**Note on `cargo` commands:** The Rust manifest lives at `src-tauri/Cargo.toml`,
not at the `vtt/` root. Any bare `cargo` command run from `vtt/` needs the
flag `--manifest-path src-tauri/Cargo.toml`, or you must `cd src-tauri` first.
The `pnpm tauri` commands handle this automatically.

**First Rust compile is slow** (5–15 min) because it compiles Tauri, PixiJS,
and the `photon-rs` image processing crate from scratch. Every subsequent
build is fast thanks to incremental compilation.

---

## Running in dev mode

All commands below must be run from the `vtt/` directory (not the repo root).

```powershell
# Windows
cd "C:\Users\svend\Documents\Coding Projects\DM-Toolkit\vtt"
pnpm tauri dev
```

```bash
# macOS / Linux
cd path/to/DM-Toolkit/vtt
pnpm tauri dev
```

This starts two things simultaneously:

- **Vite dev server** on `http://localhost:5173` (hot-reload for React)
- **Tauri app** (the Controller window) pointing at that dev server

The app reloads the frontend instantly on file changes. Rust changes restart
the whole process (~10–30 sec recompile).

The **Player window** opens when you click "Open Player View" inside the
Controller — it is not a separate process you need to start.

---

## Building a release binary

> **All `pnpm` and `cargo tauri` commands must be run from inside the `vtt/`
> directory**, not the monorepo root. The monorepo root has no `package.json`,
> so `pnpm` will fail immediately if run there.

### ⚠️ Set the signing key first — in the same shell

`tauri.conf.json` has `"createUpdaterArtifacts": true`, so the build signs
the updater `.zip` files at the very end. The signing step runs **after** the
installer is produced — if the key is missing the build exits with an error
even though the `.msi` / `.exe` are already written to disk.

The env vars must be set **in the same terminal session** where you run the
build command; setting them in a different shell has no effect.

**Windows (PowerShell):**
```powershell
cd "C:\Users\svend\Documents\Coding Projects\DM-Toolkit\vtt"   # ← must be vtt/, not repo root

$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content "C:\Users\svend\Documents\Coding Projects\DM-Toolkit\~\.tauri\vtt.key" -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "yourpassword"   # omit line if no password

pnpm tauri build
```

> **Note:** The key lives at the path above because it was generated while
> inside the `DM-Toolkit/` directory, causing `~` to be treated as a literal
> folder name instead of your home directory. If you ever regenerate the key,
> run `cargo tauri signer generate` from outside the repo — or pass an
> absolute path: `cargo tauri signer generate -w "$env:USERPROFILE\.tauri\vtt.key"`

**macOS / Linux:**
```bash
export TAURI_SIGNING_PRIVATE_KEY=$(cat /path/to/vtt.key)   # use the full path to your key
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=yourpassword     # omit if no password

cd path/to/DM-Toolkit/vtt
pnpm tauri build
```

The private key path depends on where you ran `cargo tauri signer generate`.
Use the full absolute path — avoid `~` shorthand as it may not expand if you
are in a project subdirectory.

### Skip updater signing (quick test build)

To produce the installer without signing updater artifacts, temporarily
remove `createUpdaterArtifacts` from the `bundle` section of
`tauri.conf.json`. Don't commit that change — CI relies on it.

### Output locations

| Platform | Output |
|---|---|
| macOS | `src-tauri/target/release/bundle/dmg/*.dmg` |
| macOS (app only) | `src-tauri/target/release/bundle/macos/*.app` |
| Windows | `src-tauri/target/release/bundle/msi/*.msi` |
| Windows (exe) | `src-tauri/target/release/bundle/nsis/*.exe` |

---

## Building the universal macOS binary (Intel + Apple Silicon)

The CI produces a universal binary. To do the same locally:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/vtt.key) \
  pnpm tauri build --target universal-apple-darwin
```

Output: `src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg`

---

## Running the frontend Vite server alone

If you just want to work on Controller UI in a browser (no Rust):

```bash
cd vtt
pnpm dev
```

Open `http://localhost:5173`. Tauri-specific APIs (`invoke`, `emit`, etc.)
will throw at runtime, but layout and styling work fine.

---

## Project structure reminder

```
vtt/
├── src/                         # React / TypeScript frontend
│   ├── windows/controller/      # Controller window
│   ├── windows/player/          # Player window (PixiJS)
│   ├── engine/                  # PixiJS layers / StageManager
│   ├── store/                   # Zustand store
│   └── shared/types/            # IPC event types shared between windows
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs               # Tauri builder + command registration
│   │   ├── main.rs              # Entry point
│   │   └── image_processing.rs  # Rust image ops (photon-rs)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/default.json
├── index.html                   # Controller entry point
├── player.html                  # Player entry point
└── vite.config.ts               # Two rollup inputs
```

---

## Troubleshooting

### `error: linking with cc failed` (macOS)
Xcode command line tools are missing or outdated:
```bash
xcode-select --install
# or
sudo xcode-select --reset
```

### `TAURI_SIGNING_PRIVATE_KEY` not set error
See the [Signing key required](#️-signing-key-required-for-local-builds)
section above.

### `photon-rs` fails to compile
Try cleaning the Rust cache for this workspace:
```bash
cd src-tauri
cargo clean
cd ..
pnpm tauri build
```

### Port 5173 already in use
Kill whatever is on 5173, or change `devUrl` in `tauri.conf.json` and
`server.port` in `vite.config.ts` to match.

### WebView2 missing (Windows)
Download and install from the Microsoft link in Prerequisites above.
WebView2 is bundled in the `.msi` installer for end-users but not for dev.

### `pnpm: command not found`
```bash
npm install -g pnpm
```
Then close and reopen your terminal.
