import { useEffect, useRef, useState } from 'react'
import { check as checkUpdate } from '@tauri-apps/plugin-updater'
import { emit, listen } from '@tauri-apps/api/event'
import { availableMonitors } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
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
import { ScenePresetsPanel } from './ScenePresetsPanel'
import { StageMap } from './StageMap'
import { ImageTools } from './ImageTools'
import { StageMenuBar } from './StageMenuBar'
import type { StageModalId } from './StageMenuBar'
import { TokenModal } from './TokenModal'
import { EffectsModal } from './EffectsModal'
import { AoeModal } from './AoeModal'
import { ShowcaseModal } from './ShowcaseModal'
import { BackgroundModal } from './BackgroundModal'
import { ViewModal } from './ViewModal'
import { SettingsModal } from './SettingsModal'

type Tab = 'stage' | 'tools' | 'events' | 'errors'

interface ErrorEntry {
  time: string
  source: 'player' | 'controller'
  context: string
  message: string
}

export function Controller() {
  const { theme, setTheme } = useTheme()
  const [playerOpen, setPlayerOpen] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('stage')
  const [activeDef, setActiveDef] = useState<TokenDef | EffectDef | null>(null)
  const [activeType, setActiveType] = useState<'token' | 'effect' | null>(null)
  const [activeAoe, setActiveAoe] = useState<AoeConfig | null>(null)
  const [menuExpanded, setMenuExpanded] = useState(true)
  const [activeStageModal, setActiveStageModal] = useState<StageModalId | null>(null)
  const [placingFrom, setPlacingFrom] = useState<StageModalId | null>(null)
  const [stageRotation, setStageRotation] = useState<0 | 90 | 180 | 270>(0)

  function handleDefSelect(def: TokenDef | EffectDef, type: 'token' | 'effect') {
    setActiveAoe(null)
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

    if (playerReady) {
      current.tokens.forEach((t) => void emit(VTT_EVENTS.TOKEN_REMOVE, { id: t.id } satisfies TokenRemovePayload))
      current.effects.forEach((e) => void emit(VTT_EVENTS.EFFECT_REMOVE, { id: e.id } satisfies EffectRemovePayload))
      current.aoeMarkers.forEach((a) => void emit(VTT_EVENTS.AOE_REMOVE, { id: a.id } satisfies AoeRemovePayload))
    }

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

    setLayers(data.layers)
    bgSrcRef.current = data.backgroundSrc

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

  useEffect(() => {
    loadManifest().then((data) => {
      const s = useVttStore.getState()
      data.tokenDefs?.forEach(s.addTokenDef)
      data.effectDefs?.forEach(s.addEffectDef)
      data.tokens?.forEach(s.upsertToken)
      data.effects?.forEach(s.upsertEffect)
      data.aoeMarkers?.forEach(s.upsertAoeMarker)
      data.showcaseDefs?.forEach(s.addShowcaseDef)
      data.backgroundDefs?.forEach(s.addBackgroundDef)
      if (data.activeShowcase !== undefined) s.setActiveShowcase(data.activeShowcase ?? null)
      if (data.backgroundSrc) {
        s.setBackgroundSrc(data.backgroundSrc)
        bgSrcRef.current = data.backgroundSrc
      }
    })
  }, [])

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
          backgroundDefs: state.backgroundDefs,
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

  // Escape closes the active stage modal
  useEffect(() => {
    if (!activeStageModal) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveStageModal(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeStageModal])

  // Escape cancels placement and reopens the originating modal
  useEffect(() => {
    if (!activeDef && !activeAoe) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        deactivateDef()
        setActiveAoe(null)
        if (placingFrom) {
          setActiveStageModal(placingFrom)
          setPlacingFrom(null)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDef, activeAoe, placingFrom])

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
    void emit(VTT_EVENTS.GRID_CONFIG, s.grid satisfies GridConfigPayload)
    Object.entries(s.layers).forEach(([layer, visible]) =>
      void emit(VTT_EVENTS.LAYER_VISIBILITY, { layer: layer as LayerName, visible } satisfies LayerVisibilityPayload),
    )
    const src = bgSrcRef.current || s.backgroundSrc
    if (src) void emit(VTT_EVENTS.BACKGROUND_LOADED, { src } satisfies BackgroundLoadedPayload)
    s.tokens.forEach((t) => void emit(VTT_EVENTS.TOKEN_UPSERT, t))
    s.effects.forEach((e) => void emit(VTT_EVENTS.EFFECT_UPSERT, e))
    s.aoeMarkers.forEach((a) => void emit(VTT_EVENTS.AOE_UPSERT, a))
    void emit(VTT_EVENTS.SHOW_AFFECTED_AREA, { enabled: s.showAffectedArea } satisfies ShowAffectedAreaPayload)
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
  }

  async function handleSelectBackground(src: string) {
    bgSrcRef.current = src
    useVttStore.getState().setBackgroundSrc(src)
    if (playerReady) {
      const payload: BackgroundLoadedPayload = { src }
      await emit(VTT_EVENTS.BACKGROUND_LOADED, payload)
    }
    appendLog(`Background loaded: ${src.split(/[\\/]/).pop() ?? 'image'}`)
  }

  // ── Modal-initiated placement handlers ────────────────────────────────────

  function handleTokenSelect(def: TokenDef) {
    handleDefSelect(def, 'token')
    setActiveStageModal(null)
    setPlacingFrom('tokens')
  }

  function handleEffectSelect(def: EffectDef) {
    handleDefSelect(def, 'effect')
    setActiveStageModal(null)
    setPlacingFrom('effects')
  }

  function handleAoeModalPlace(config: AoeConfig) {
    handlePlaceAoe(config)
    setActiveStageModal(null)
    setPlacingFrom('aoe')
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

      <main className={`controller-main${activeTab === 'stage' ? ' controller-main--stage' : ''}`}>
        {/* ── Tab bar ── */}
        <div className="tab-bar">
          <div className="tab-bar-tabs">
            {(['stage', 'tools', 'events', 'errors'] as Tab[]).map((tab) => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'tab-btn--active' : ''} ${tab === 'errors' && errorCount > 0 ? 'tab-btn--has-errors' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'stage'  && 'Stage'}
                {tab === 'tools'  && 'Image Tools'}
                {tab === 'events' && 'Event Log'}
                {tab === 'errors' && <>Dev Tools{errorCount > 0 && <span className="tab-badge">{errorCount}</span>}</>}
              </button>
            ))}
          </div>
          <div className="tab-bar-actions">
            <span className="player-status-inline">
              <span className={`status-dot${playerOpen ? ' status-dot--open' : ''}`} />
              {!playerOpen ? 'Closed' : playerReady ? 'Ready' : 'Opening…'}
            </span>
            {!playerOpen ? (
              <button
                className="btn btn-primary"
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
                onClick={handleOpenPlayer}
              >
                Open Player
              </button>
            ) : (
              <button
                className="btn btn-danger"
                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
                onClick={handleClosePlayer}
              >
                Close Player
              </button>
            )}
          </div>
        </div>

        {/* ── Stage tab ── */}
        {activeTab === 'stage' && (
          <div className="stage-view">
            <StageMenuBar
              activeModal={activeStageModal}
              onOpenModal={(id) => setActiveStageModal((prev) => (prev === id ? null : id))}
              expanded={menuExpanded}
              onToggleExpand={() => setMenuExpanded((e) => !e)}
            />
            <div className="stage-content">
              <div className="stage-map-rotation-bar">
                <button
                  className="stage-rotate-btn"
                  onClick={() => setStageRotation((r) => ((r - 90 + 360) % 360) as 0 | 90 | 180 | 270)}
                  title="Rotate view 90° counterclockwise"
                >↺</button>
                <span className="stage-rotate-label">
                  {stageRotation > 0 ? `${stageRotation}°` : 'Map View'}
                </span>
                <button
                  className="stage-rotate-btn"
                  onClick={() => setStageRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)}
                  title="Rotate view 90° clockwise"
                >↻</button>
              </div>
              <div className="stage-map-container">
                <StageMap
                  playerReady={playerReady}
                  activeDef={activeDef}
                  activeType={activeType}
                  onDeactivate={deactivateDef}
                  activeAoe={activeAoe}
                  onAoeDeactivate={() => setActiveAoe(null)}
                  stageRotation={stageRotation}
                />
              </div>

              <section className="control-section">
                <h2>Scene Presets</h2>
                <ScenePresetsPanel onLoad={handleLoadScenePreset} />
              </section>

              {/* ── Modal overlays ── */}
              {activeStageModal === 'tokens' && (
                <TokenModal onSelectToken={handleTokenSelect} onClose={() => setActiveStageModal(null)} />
              )}
              {activeStageModal === 'effects' && (
                <EffectsModal onSelectEffect={handleEffectSelect} onClose={() => setActiveStageModal(null)} />
              )}
              {activeStageModal === 'aoe' && (
                <AoeModal
                  onPlace={handleAoeModalPlace}
                  isPlacing={!!activeAoe}
                  onClose={() => setActiveStageModal(null)}
                />
              )}
              {activeStageModal === 'showcase' && (
                <ShowcaseModal
                  onSet={handleShowcaseSet}
                  onClear={handleShowcaseClear}
                  onClose={() => setActiveStageModal(null)}
                />
              )}
              {activeStageModal === 'background' && (
                <BackgroundModal onSelect={handleSelectBackground} onClose={() => setActiveStageModal(null)} />
              )}
              {activeStageModal === 'view' && (
                <ViewModal
                  layers={layers}
                  showAffectedArea={showAffectedArea}
                  onLayerToggle={handleLayerToggle}
                  onAffectedAreaToggle={handleAffectedAreaToggle}
                  onClose={() => setActiveStageModal(null)}
                />
              )}
              {activeStageModal === 'settings' && (
                <SettingsModal
                  playerReady={playerReady}
                  onLog={appendLog}
                  onClose={() => setActiveStageModal(null)}
                />
              )}
            </div>
          </div>
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

        {/* ── Dev Tools tab ── */}
        {activeTab === 'errors' && (
          <section className="control-section log-section">
            <h2>Dev Tools</h2>
            <div style={{ marginBottom: '1rem' }}>
              <button
                className="btn btn-secondary"
                onClick={handleSendTest}
                disabled={!playerReady}
                title={!playerReady ? 'Waiting for PlayerView to be ready' : undefined}
              >
                Send Test Message
              </button>
            </div>
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
