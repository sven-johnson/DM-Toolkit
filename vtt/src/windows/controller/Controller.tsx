import { useEffect, useRef, useState } from 'react'
import { check as checkUpdate } from '@tauri-apps/plugin-updater'
import { emit, listen } from '@tauri-apps/api/event'
import { toAssetUrl } from '../../lib/assetUrl'
import { availableMonitors } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { useTheme } from '../../context/ThemeContext'
import type {
  AoeRemovePayload,
  BackgroundLoadedPayload,
  EffectRemovePayload,
  ErrorReportedPayload,
  GridConfigPayload,
  LayerName,
  LayerVisibilityPayload,
  PlayerReadyPayload,
  ShowAffectedAreaPayload,
  TestMessagePayload,
  ThemeChangedPayload,
  TokenRemovePayload,
} from '../../shared/types/ipc'
import type { EffectDef, TokenDef } from '../../shared/types/tokens'
import { VTT_EVENTS } from '../../shared/types/ipc'
import { useVttStore } from '../../store/vttStore'
import type { AoeConfig } from '../../shared/types/aoe'
import type { ShowcaseSetPayload } from '../../shared/types/ipc'
import { loadManifest, saveManifest } from '../../lib/vttPersistence'
import type { ScenePresetData } from '../../lib/vttDatabase'
import { AoePanel } from './AoePanel'
import { ScenePresetsPanel } from './ScenePresetsPanel'
import { ShowcasePanel } from './ShowcasePanel'
import { CalibrationPanel } from './CalibrationPanel'
import { ImageTools } from './ImageTools'
import { StageMap } from './StageMap'
import { TokenPanel } from './TokenPanel'

type Tab = 'stage' | 'tools' | 'events' | 'errors'

interface ErrorEntry {
  time: string
  source: 'player' | 'controller'
  context: string
  message: string
}

const LAYER_LABELS: Record<LayerName, string> = {
  background: 'Background',
  effects: 'Effects',
  tokens: 'Tokens',
  grid: 'Grid',
}
const LAYER_NAMES: LayerName[] = ['background', 'effects', 'tokens', 'grid']

export function Controller() {
  const { theme, setTheme } = useTheme()
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('stage')
  const [activeDef, setActiveDef] = useState<TokenDef | EffectDef | null>(null)
  const [activeType, setActiveType] = useState<'token' | 'effect' | null>(null)
  const [activeAoe, setActiveAoe] = useState<AoeConfig | null>(null)

  function handleDefSelect(def: TokenDef | EffectDef, type: 'token' | 'effect') {
    setActiveAoe(null)  // cancel AOE placement
    if (activeDef?.id === def.id && activeType === type) {
      setActiveDef(null); setActiveType(null)
    } else {
      setActiveDef(def); setActiveType(type)
    }
  }

  function deactivateDef() { setActiveDef(null); setActiveType(null) }

  function handlePlaceAoe(config: AoeConfig) {
    deactivateDef()
    setActiveAoe(config)
  }

  function handleShowcaseSet(src: string, rotation: number, darkenAmount: number) {
    if (playerReady) {
      void emit(VTT_EVENTS.SHOWCASE_SET, { src, rotation, darkenAmount } satisfies ShowcaseSetPayload)
    }
  }

  function handleShowcaseClear() {
    if (playerReady) void emit(VTT_EVENTS.SHOWCASE_CLEAR, null)
  }

  const showAffectedArea = useVttStore((s) => s.showAffectedArea)

  function handleAffectedAreaToggle(enabled: boolean) {
    useVttStore.getState().setShowAffectedArea(enabled)
    if (playerReady) {
      const payload: ShowAffectedAreaPayload = { enabled }
      void emit(VTT_EVENTS.SHOW_AFFECTED_AREA, payload)
    }
  }

  function handleLoadScenePreset(data: ScenePresetData) {
    const current = useVttStore.getState()

    // Remove all current entities from PlayerView before replacing
    if (playerReady) {
      current.tokens.forEach((t) => void emit(VTT_EVENTS.TOKEN_REMOVE, { id: t.id } satisfies TokenRemovePayload))
      current.effects.forEach((e) => void emit(VTT_EVENTS.EFFECT_REMOVE, { id: e.id } satisfies EffectRemovePayload))
      current.aoeMarkers.forEach((a) => void emit(VTT_EVENTS.AOE_REMOVE, { id: a.id } satisfies AoeRemovePayload))
    }

    // Replace store state in one shot
    useVttStore.setState({
      backgroundSrc: data.backgroundSrc,
      tokenDefs: data.tokenDefs,
      tokens: data.tokens,
      effectDefs: data.effectDefs,
      effects: data.effects,
      aoeMarkers: data.aoeMarkers,
      grid: data.grid,
      layers: data.layers,
      showAffectedArea: data.showAffectedArea,
    })

    // Sync local layer toggle state in Controller
    setLayers(data.layers)

    // Update background ref used by player-ready sync
    bgSrcRef.current = data.backgroundSrc

    // Push new scene to PlayerView
    if (playerReady) {
      data.tokens.forEach((t) => void emit(VTT_EVENTS.TOKEN_UPSERT, t))
      data.effects.forEach((e) => void emit(VTT_EVENTS.EFFECT_UPSERT, e))
      data.aoeMarkers.forEach((a) => void emit(VTT_EVENTS.AOE_UPSERT, a))
      void emit(VTT_EVENTS.SHOW_AFFECTED_AREA, { enabled: data.showAffectedArea } satisfies ShowAffectedAreaPayload)
      if (data.backgroundSrc) {
        void emit(VTT_EVENTS.BACKGROUND_LOADED, { src: data.backgroundSrc } satisfies BackgroundLoadedPayload)
      }
      Object.entries(data.layers).forEach(([layer, visible]) =>
        void emit(VTT_EVENTS.LAYER_VISIBILITY, { layer: layer as LayerName, visible } satisfies LayerVisibilityPayload),
      )
      void emit(VTT_EVENTS.GRID_CONFIG, data.grid satisfies GridConfigPayload)
    }
  }

  const bgSrcRef = useRef('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Persistence: load manifest on startup ────────────────────────────────
  useEffect(() => {
    loadManifest().then((data) => {
      const s = useVttStore.getState()
      data.tokenDefs?.forEach(s.addTokenDef)
      data.effectDefs?.forEach(s.addEffectDef)
      data.tokens?.forEach(s.upsertToken)
      data.effects?.forEach(s.upsertEffect)
      data.aoeMarkers?.forEach(s.upsertAoeMarker)
      data.showcaseDefs?.forEach(s.addShowcaseDef)
      if (data.activeShowcase !== undefined) s.setActiveShowcase(data.activeShowcase ?? null)
      if (data.backgroundSrc) {
        s.setBackgroundSrc(data.backgroundSrc)
        bgSrcRef.current = data.backgroundSrc
      }
    })
  }, [])

  // ── Persistence: auto-save on state changes (debounced 600 ms) ──────────
  useEffect(() => {
    const unsub = useVttStore.subscribe((state) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        void saveManifest({
          tokenDefs: state.tokenDefs,
          effectDefs: state.effectDefs,
          tokens: state.tokens,
          effects: state.effects,
          aoeMarkers: state.aoeMarkers,
          backgroundSrc: state.backgroundSrc,
          showcaseDefs: state.showcaseDefs,
          activeShowcase: state.activeShowcase,
        })
      }, 600)
    })
    return () => {
      unsub()
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])
  const [log, setLog] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)

  const [errorLog, setErrorLog] = useState<ErrorEntry[]>([])
  const errEndRef = useRef<HTMLDivElement>(null)

  const [layers, setLayers] = useState<Record<LayerName, boolean>>({
    background: true, effects: true, tokens: true, grid: true,
  })

  // Escape key cancels active placement
  useEffect(() => {
    if (!activeDef && !activeAoe) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { deactivateDef(); setActiveAoe(null) }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDef, activeAoe])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [log])
  useEffect(() => { errEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [errorLog])

  function appendLog(entry: string) {
    const time = new Date().toLocaleTimeString()
    setLog((prev) => [...prev, `[${time}] ${entry}`])
  }

  function appendError(context: string, message: string, source: ErrorEntry['source'] = 'controller') {
    const time = new Date().toLocaleTimeString()
    setErrorLog((prev) => [...prev, { time, source, context, message }])
  }

  // ── IPC listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<PlayerReadyPayload>(VTT_EVENTS.PLAYER_READY, () => {
      setPlayerReady(true)
      appendLog('PlayerView ready.')
    }).then((fn) => { unlisten = fn })
    return () => unlisten?.()
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    listen<ErrorReportedPayload>(VTT_EVENTS.ERROR_REPORTED, (event) => {
      const { context, message } = event.payload
      setErrorLog((prev) => [
        ...prev,
        { time: new Date().toLocaleTimeString(), source: 'player', context, message },
      ])
    }).then((fn) => { unlisten = fn })
    return () => unlisten?.()
  }, [])

  useEffect(() => {
    if (!playerReady) return
    const payload: ThemeChangedPayload = { theme }
    emit(VTT_EVENTS.THEME_CHANGED, payload)
  }, [theme, playerReady])

  useEffect(() => {
    if (!playerReady) return
    const s = useVttStore.getState()

    // Grid config and layer visibility first so entities render in the right positions
    void emit(VTT_EVENTS.GRID_CONFIG, s.grid satisfies GridConfigPayload)
    Object.entries(s.layers).forEach(([layer, visible]) =>
      void emit(VTT_EVENTS.LAYER_VISIBILITY, { layer: layer as LayerName, visible } satisfies LayerVisibilityPayload),
    )

    // Background
    const src = bgSrcRef.current || s.backgroundSrc
    if (src) void emit(VTT_EVENTS.BACKGROUND_LOADED, { src } satisfies BackgroundLoadedPayload)

    // Entities
    s.tokens.forEach((t) => void emit(VTT_EVENTS.TOKEN_UPSERT, t))
    s.effects.forEach((e) => void emit(VTT_EVENTS.EFFECT_UPSERT, e))
    s.aoeMarkers.forEach((a) => void emit(VTT_EVENTS.AOE_UPSERT, a))
    void emit(VTT_EVENTS.SHOW_AFFECTED_AREA, { enabled: s.showAffectedArea } satisfies ShowAffectedAreaPayload)

    // Showcase
    if (s.activeShowcase) {
      const def = s.showcaseDefs.find((d) => d.id === s.activeShowcase!.defId)
      if (def) {
        void emit(VTT_EVENTS.SHOWCASE_SET, {
          src: def.src,
          rotation: s.activeShowcase.rotation,
          darkenAmount: s.activeShowcase.darkenAmount,
        } satisfies ShowcaseSetPayload)
      }
    }
  }, [playerReady])

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleOpenPlayer() {
    try {
      const monitors = await availableMonitors()
      const secondary = monitors.length >= 2 ? monitors[1] : null

      const options = secondary
        ? {
            fullscreen: true,
            x: Math.round(secondary.position.x / secondary.scaleFactor),
            y: Math.round(secondary.position.y / secondary.scaleFactor),
            width: Math.round(secondary.size.width / secondary.scaleFactor),
            height: Math.round(secondary.size.height / secondary.scaleFactor),
            decorations: false,
          }
        : { width: 1280, height: 720, center: true, resizable: true }

      const win = new WebviewWindow('player', { url: 'player.html', title: 'Player View', ...options })

      win.once('tauri://created', () => {
        setPlayerOpen(true)
        appendLog(`PlayerView opened (${secondary ? 'fullscreen on monitor 2' : 'windowed on primary'}).`)
      })
      win.once('tauri://destroyed', () => {
        setPlayerOpen(false)
        setPlayerReady(false)
        appendLog('PlayerView closed.')
      })
      win.once('tauri://error', (e) => {
        const msg = `PlayerView error: ${String(e.payload)}`
        appendLog(msg)
        appendError('Controller.openPlayer', msg)
      })
    } catch (err) {
      appendError('Controller.openPlayer', err instanceof Error ? err.message : String(err))
    }
  }

  async function handleCheckUpdate() {
    try {
      const update = await checkUpdate()
      if (!update) { appendLog('App is up to date.'); return }
      appendLog(`Update available: v${update.version}. Downloading…`)
      await update.downloadAndInstall()
      appendLog('Update installed. Restart the app to apply.')
    } catch (e) {
      const msg = `Update check failed: ${String(e)}`
      appendLog(msg)
      appendError('Controller.checkUpdate', String(e))
    }
  }

  async function handleClosePlayer() {
    const win = await WebviewWindow.getByLabel('player')
    await win?.close()
  }

  async function handleSendTest() {
    const payload: TestMessagePayload = { message: 'Hello from Controller!', timestamp: Date.now() }
    await emit(VTT_EVENTS.TEST_MESSAGE, payload)
    appendLog(`Sent test message: "${payload.message}"`)
  }

  async function handleLayerToggle(layer: LayerName, visible: boolean) {
    setLayers((prev) => ({ ...prev, [layer]: visible }))
    if (!playerReady) return
    const payload: LayerVisibilityPayload = { layer, visible }
    await emit(VTT_EVENTS.LAYER_VISIBILITY, payload)
    appendLog(`Layer "${LAYER_LABELS[layer]}" ${visible ? 'shown' : 'hidden'}.`)
  }

  async function handleLoadBackground() {
    try {
      const path = await openDialog({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
      })
      if (!path || typeof path !== 'string') return
      const src = toAssetUrl(path)
      bgSrcRef.current = src
      useVttStore.getState().setBackgroundSrc(src)
      if (playerReady) {
        const payload: BackgroundLoadedPayload = { src }
        await emit(VTT_EVENTS.BACKGROUND_LOADED, payload)
      }
      appendLog(`Background loaded: ${path.split(/[\\/]/).pop()}`)
    } catch (err) {
      appendError('Controller.loadBackground', err instanceof Error ? err.message : String(err))
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const errorCount = errorLog.length

  return (
    <div className="controller">
      <header className="controller-header">
        <h1 className="controller-brand">DM Toolkit <span>VTT</span></h1>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button className="theme-toggle" type="button" onClick={handleCheckUpdate} title="Check for updates">↑</button>
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
        </div>
      </header>

      <main className="controller-main">
        {/* ── Tab bar ── */}
        <div className="tab-bar">
          {(['stage', 'tools', 'events', 'errors'] as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? 'tab-btn--active' : ''} ${tab === 'errors' && errorCount > 0 ? 'tab-btn--has-errors' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'stage'  && 'Stage'}
              {tab === 'tools'  && 'Image Tools'}
              {tab === 'events' && 'Event Log'}
              {tab === 'errors' && <>Error Log{errorCount > 0 && <span className="tab-badge">{errorCount}</span>}</>}
            </button>
          ))}
        </div>

        {/* ── Stage tab ── */}
        {activeTab === 'stage' && (
          <>
            <section className="control-section">
              <h2>Player View</h2>
              <div className="status-row">
                <span className={`status-dot ${playerOpen ? 'status-dot--open' : ''}`} />
                <span className="status-label">
                  {!playerOpen ? 'Closed' : playerReady ? 'Open & Ready' : 'Opening…'}
                </span>
              </div>
              <div className="button-row">
                {!playerOpen ? (
                  <button className="btn btn-primary" onClick={handleOpenPlayer}>Open Player View</button>
                ) : (
                  <button className="btn btn-danger" onClick={handleClosePlayer}>Close Player View</button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={handleSendTest}
                  disabled={!playerReady}
                  title={!playerReady ? 'Waiting for PlayerView to be ready' : undefined}
                >
                  Send Test Message
                </button>
              </div>
            </section>

            <section className="control-section">
              <h2>Scene Presets</h2>
              <ScenePresetsPanel onLoad={handleLoadScenePreset} />
            </section>

            <section className="control-section">
              <h2>Stage</h2>
              <div className="subsection">
                <h3>Layers</h3>
                {LAYER_NAMES.map((layer) => (
                  <div key={layer} className="layer-row">
                    <span className="layer-label">{LAYER_LABELS[layer]}</span>
                    <label className="toggle">
                      <input type="checkbox" checked={layers[layer]} onChange={(e) => handleLayerToggle(layer, e.target.checked)} />
                      <span className="toggle-track" />
                    </label>
                  </div>
                ))}
                <div className="layer-row" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                  <span className="layer-label">Show Affected Area</span>
                  <label className="toggle">
                    <input type="checkbox" checked={showAffectedArea} onChange={(e) => handleAffectedAreaToggle(e.target.checked)} />
                    <span className="toggle-track" />
                  </label>
                </div>
              </div>
              <div className="subsection">
                <h3>Background</h3>
                <button
                  className="btn btn-secondary"
                  onClick={handleLoadBackground}
                >
                  Load Image…
                </button>
              </div>
              <div className="subsection">
                <h3>Stage Map</h3>
                <p className="cal-hint">Drag tokens onto the map to place them. Right-click to edit.</p>
                <StageMap
                  playerReady={playerReady}
                  activeDef={activeDef}
                  activeType={activeType}
                  onDeactivate={deactivateDef}
                  activeAoe={activeAoe}
                  onAoeDeactivate={() => setActiveAoe(null)}
                />
              </div>
            </section>

            <section className="control-section">
              <h2>Assets</h2>
              <TokenPanel
                activeDef={activeDef}
                activeType={activeType}
                onDefSelect={handleDefSelect}
              />
            </section>

            <section className="control-section">
              <h2>AOE Markers</h2>
              <AoePanel onPlace={handlePlaceAoe} isPlacing={!!activeAoe} />
            </section>

            <section className="control-section">
              <h2>Visual Showcase</h2>
              <p className="cal-hint">Displays full-screen art on the player view above all other visuals.</p>
              <ShowcasePanel onSet={handleShowcaseSet} onClear={handleShowcaseClear} />
            </section>

            <section className="control-section">
              <h2>Grid Calibration</h2>
              <CalibrationPanel playerReady={playerReady} onLog={appendLog} />
            </section>
          </>
        )}

        {/* ── Image Tools tab ── */}
        {activeTab === 'tools' && (
          <ImageTools playerReady={playerReady} onError={appendError} />
        )}

        {/* ── Event Log tab ── */}
        {activeTab === 'events' && (
          <section className="control-section log-section">
            <h2>Event Log</h2>
            <div className="log">
              {log.length === 0 && <p className="log-empty">No events yet.</p>}
              {log.map((entry, i) => <div key={i} className="log-entry">{entry}</div>)}
              <div ref={logEndRef} />
            </div>
          </section>
        )}

        {/* ── Error Log tab ── */}
        {activeTab === 'errors' && (
          <section className="control-section log-section">
            <h2>Error Log</h2>
            <div className="log error-log">
              {errorLog.length === 0 && <p className="log-empty">No errors recorded.</p>}
              {errorLog.map((entry, i) => (
                <div key={i} className="error-entry">
                  <span className="error-entry-meta">[{entry.time}] [{entry.source}]</span>
                  <span className="error-entry-context">{entry.context}</span>
                  <span className="error-entry-message">{entry.message}</span>
                </div>
              ))}
              <div ref={errEndRef} />
            </div>
            {errorLog.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{ marginTop: '0.75rem' }}
                onClick={() => setErrorLog([])}
              >
                Clear
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
