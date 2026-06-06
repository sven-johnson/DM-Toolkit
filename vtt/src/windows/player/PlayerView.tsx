import { useEffect, useRef, useState } from 'react'
import { emit, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Application } from 'pixi.js'
import { useTheme } from '../../context/ThemeContext'
import type {
  AoeRemovePayload,
  BackgroundLoadedPayload,
  EffectRemovePayload,
  ErrorReportedPayload,
  GhostAoePayload,
  GhostTokenPayload,
  GridConfigPayload,
  LayerVisibilityPayload,
  PlayerReadyPayload,
  ShowAffectedAreaPayload,
  ShowcaseSetPayload,
  TestMessagePayload,
  ThemeChangedPayload,
  TokenRemovePayload,
} from '../../shared/types/ipc'
import { VTT_EVENTS } from '../../shared/types/ipc'
import type { AoeMarker } from '../../shared/types/aoe'
import type { Effect, Token } from '../../shared/types/tokens'
import { StageManager } from '../../engine/StageManager'
import { useVttStore } from '../../store/vttStore'

function reportError(context: string, message: string) {
  const payload: ErrorReportedPayload = { context, message }
  void emit(VTT_EVENTS.ERROR_REPORTED, payload)
}

function computeFullscreenScale(tvW: number, tvH: number) {
  const scale = Math.min(window.innerWidth / tvW, window.innerHeight / tvH)
  const offsetX = (window.innerWidth - tvW * scale) / 2
  const offsetY = (window.innerHeight - tvH * scale) / 2
  return { scale, offsetX, offsetY }
}

export function PlayerView() {
  const { setTheme } = useTheme()
  const pixiApp = useRef<Application | null>(null)
  const stageManager = useRef<StageManager | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const isFullscreenRef = useRef(false)

  // Scale all entities to fit window whenever it resizes (TV dimensions define the virtual canvas)
  useEffect(() => {
    function onResize() {
      const sm = stageManager.current
      if (!sm) return
      const { width: tvW, height: tvH } = useVttStore.getState().tvDimensions
      const { scale, offsetX, offsetY } = computeFullscreenScale(tvW, tvH)
      sm.applyFullscreenScale(scale, offsetX, offsetY, tvW, tvH)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Initialise PixiJS, wire up all IPC listeners, then signal readiness.
  // Order matters: StageManager must exist before PLAYER_READY is emitted so
  // the controller's sync burst lands on a fully-initialised canvas.
  useEffect(() => {
    let app: Application | null = null
    let sm: StageManager | null = null
    const cleanups: Array<() => void> = []

    async function run() {
      // ── 1. Init PixiJS ───────────────────────────────────────────────────
      try {
        app = new Application()
        await app.init({
          background: 0x111318,
          resizeTo: window,
          preference: 'webgpu',
          antialias: true,
        })
        document.body.appendChild(app.canvas)
        pixiApp.current = app

        sm = new StageManager(app, reportError)
        stageManager.current = sm

        const alreadyFs = await getCurrentWindow().isFullscreen()
        if (alreadyFs) {
          isFullscreenRef.current = true
          setIsFullscreen(true)
        }
        // Always apply TV-based scale-to-fit, regardless of fullscreen state
        const { width: tvW0, height: tvH0 } = useVttStore.getState().tvDimensions
        const init = computeFullscreenScale(tvW0, tvH0)
        sm.applyFullscreenScale(init.scale, init.offsetX, init.offsetY, tvW0, tvH0)
      } catch (err) {
        reportError('PlayerView.init', err instanceof Error ? err.message : String(err))
        return
      }

      // ── 2. Register IPC listeners ────────────────────────────────────────
      cleanups.push(await listen<TestMessagePayload>(
        VTT_EVENTS.TEST_MESSAGE,
        (event) => { console.log('[PlayerView] test message:', event.payload) },
      ))

      cleanups.push(await listen<ThemeChangedPayload>(
        VTT_EVENTS.THEME_CHANGED,
        (event) => { setTheme(event.payload.theme) },
      ))

      cleanups.push(await listen<LayerVisibilityPayload>(
        VTT_EVENTS.LAYER_VISIBILITY,
        (event) => {
          try {
            const { layer, visible } = event.payload
            useVttStore.getState().setLayerVisible(layer, visible)
            stageManager.current?.setLayerVisible(layer, visible)
          } catch (err) {
            reportError('PlayerView.layerVisibility', err instanceof Error ? err.message : String(err))
          }
        },
      ))

      cleanups.push(await listen<BackgroundLoadedPayload>(
        VTT_EVENTS.BACKGROUND_LOADED,
        (event) => {
          useVttStore.getState().setBackgroundSrc(event.payload.src)
          stageManager.current?.loadBackground(event.payload.src)
            .catch((err: unknown) => {
              reportError('PlayerView.loadBackground', err instanceof Error ? err.message : String(err))
            })
        },
      ))

      cleanups.push(await listen<GridConfigPayload>(
        VTT_EVENTS.GRID_CONFIG,
        (event) => {
          try {
            useVttStore.getState().setGridConfig(event.payload)
            const sm = stageManager.current
            if (!sm) return
            // Read the fully-merged GridConfig from the store (setGridConfig already
            // merged the payload), then update lastGridConfig so applyFullscreenScale
            // redraws with the new color, lineWidth, opacity, and origin.
            sm.updateGridConfig(useVttStore.getState().grid)
            const { width: tvW, height: tvH } = useVttStore.getState().tvDimensions
            const { scale, offsetX, offsetY } = computeFullscreenScale(tvW, tvH)
            sm.applyFullscreenScale(scale, offsetX, offsetY, tvW, tvH)
          } catch (err) {
            reportError('PlayerView.gridConfig', err instanceof Error ? err.message : String(err))
          }
        },
      ))

      cleanups.push(await listen<Token>(
        VTT_EVENTS.TOKEN_UPSERT,
        (event) => {
          try {
            const token = event.payload
            useVttStore.getState().upsertToken(token)
            const sm = stageManager.current
            if (sm) sm.upsertToken(token, useVttStore.getState().grid)
          } catch (err) {
            reportError('PlayerView.tokenUpsert', err instanceof Error ? err.message : String(err))
          }
        },
      ))

      cleanups.push(await listen<TokenRemovePayload>(
        VTT_EVENTS.TOKEN_REMOVE,
        (event) => {
          try {
            useVttStore.getState().removeToken(event.payload.id)
            stageManager.current?.removeToken(event.payload.id)
          } catch (err) {
            reportError('PlayerView.tokenRemove', err instanceof Error ? err.message : String(err))
          }
        },
      ))

      cleanups.push(await listen<Effect>(
        VTT_EVENTS.EFFECT_UPSERT,
        (event) => {
          try {
            const effect = event.payload
            useVttStore.getState().upsertEffect(effect)
            const sm = stageManager.current
            if (sm) sm.upsertEffect(effect, useVttStore.getState().grid)
          } catch (err) {
            reportError('PlayerView.effectUpsert', err instanceof Error ? err.message : String(err))
          }
        },
      ))

      cleanups.push(await listen<EffectRemovePayload>(
        VTT_EVENTS.EFFECT_REMOVE,
        (event) => {
          try {
            useVttStore.getState().removeEffect(event.payload.id)
            stageManager.current?.removeEffect(event.payload.id)
          } catch (err) {
            reportError('PlayerView.effectRemove', err instanceof Error ? err.message : String(err))
          }
        },
      ))

      cleanups.push(await listen<AoeMarker>(
        VTT_EVENTS.AOE_UPSERT,
        (event) => {
          try {
            const aoe = event.payload
            useVttStore.getState().upsertAoeMarker(aoe)
            const sm = stageManager.current
            if (sm) sm.upsertAoe(aoe, useVttStore.getState().grid)
          } catch (err) {
            reportError('PlayerView.aoeUpsert', err instanceof Error ? err.message : String(err))
          }
        },
      ))

      cleanups.push(await listen<AoeRemovePayload>(
        VTT_EVENTS.AOE_REMOVE,
        (event) => {
          try {
            useVttStore.getState().removeAoeMarker(event.payload.id)
            stageManager.current?.removeAoe(event.payload.id)
          } catch (err) {
            reportError('PlayerView.aoeRemove', err instanceof Error ? err.message : String(err))
          }
        },
      ))

      cleanups.push(await listen<ShowAffectedAreaPayload>(
        VTT_EVENTS.SHOW_AFFECTED_AREA,
        (event) => {
          try {
            useVttStore.getState().setShowAffectedArea(event.payload.enabled)
            stageManager.current?.setShowAffectedArea(event.payload.enabled, useVttStore.getState().grid)
          } catch (err) {
            reportError('PlayerView.showAffectedArea', String(err))
          }
        },
      ))

      cleanups.push(await listen<GhostTokenPayload>(
        VTT_EVENTS.GHOST_TOKEN,
        (event) => {
          stageManager.current?.showGhostToken(event.payload, useVttStore.getState().grid)
            .catch((err: unknown) => reportError('PlayerView.ghostToken', String(err)))
        },
      ))

      cleanups.push(await listen(
        VTT_EVENTS.GHOST_TOKEN_CLEAR,
        () => { stageManager.current?.hideGhostToken() },
      ))

      cleanups.push(await listen<GhostAoePayload>(
        VTT_EVENTS.GHOST_AOE,
        (event) => {
          try {
            stageManager.current?.showGhostAoe(event.payload, useVttStore.getState().grid)
          } catch (err) {
            reportError('PlayerView.ghostAoe', String(err))
          }
        },
      ))

      cleanups.push(await listen(
        VTT_EVENTS.GHOST_AOE_CLEAR,
        () => { stageManager.current?.hideGhostAoe() },
      ))

      cleanups.push(await listen<ShowcaseSetPayload>(
        VTT_EVENTS.SHOWCASE_SET,
        (event) => {
          stageManager.current?.showShowcase(event.payload)
            .catch((err: unknown) => reportError('PlayerView.showcase', String(err)))
        },
      ))

      cleanups.push(await listen(
        VTT_EVENTS.SHOWCASE_CLEAR,
        () => { stageManager.current?.hideShowcase() },
      ))

      // ── 3. Signal ready — PixiJS and all listeners are fully up ──────────
      const payload: PlayerReadyPayload = { windowLabel: 'player' }
      await emit(VTT_EVENTS.PLAYER_READY, payload)
    }

    run().catch((err: unknown) => {
      reportError('PlayerView.run', err instanceof Error ? err.message : String(err))
    })

    return () => {
      cleanups.forEach((fn) => fn())
      sm?.destroy()
      stageManager.current = null
      app?.destroy(true, { children: true })
      pixiApp.current = null
    }
  }, [setTheme])

  async function handleToggleFullscreen() {
    const win = getCurrentWindow()
    const entering = !isFullscreenRef.current
    isFullscreenRef.current = entering
    setIsFullscreen(entering)
    await win.setFullscreen(entering)
    // Apply scale eagerly; onResize will fire too but that's harmless
    const sm = stageManager.current
    if (sm) {
      const { width: tvW, height: tvH } = useVttStore.getState().tvDimensions
      const { scale, offsetX, offsetY } = computeFullscreenScale(tvW, tvH)
      sm.applyFullscreenScale(scale, offsetX, offsetY, tvW, tvH)
    }
  }

  return (
    <>
      {!isFullscreen && (
        <button
          className="player-fullscreen-btn"
          onClick={() => { void handleToggleFullscreen() }}
          title="Enter fullscreen"
          aria-label="Enter fullscreen"
        >
          ⛶
        </button>
      )}
    </>
  )
}
