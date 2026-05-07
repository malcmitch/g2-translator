// src/appstore/AppStoreLensManager.ts
// Drives the G2 lens for Even Hub App Store browsing.
//
// Layout — two SDK containers:
//   Text ID 1  (y=0,  h=40):  Current screen title
//   List ID 2  (y=50, h=140): Scrollable grid / detail list
//
// Three screens:
//   HOME     → 2-column category grid  (6 tiles)
//   CATEGORY → 2-column app card grid
//   APP      → full-width detail list
//
// Glasses controls:
//   Swipe forward / back  →  move selector across row, then down / up
//   Single tap            →  select highlighted tile / action
//   Double-tap            →  go back  (OsEventTypeList.DOUBLE_CLICK_EVENT = 3)

import {
  EvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerUpgrade,
  TextContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  BridgeEvent,
  OsEventTypeList,
  type EvenHubEvent,
  List_ItemEvent,
} from '@evenrealities/even_hub_sdk'
import {
  CATEGORIES,
  APPS,
  type StoreApp,
  getCategory,
  getAppsInCategory,
  getFeaturedApps,
  formatRating,
  formatReviewCount,
} from './catalog.js'

const C      = { HEADER: 1, LIST: 2 } as const
const LENS_W = 488
const GRID_W = 244   // half of 488 → SDK flex-rows fit exactly 2 tiles per row

// ── Navigation state ──────────────────────────────────────────────────────────

export type ViewState =
  | { screen: 'home' }
  | { screen: 'category'; categoryId: string }
  | { screen: 'featured' }
  | { screen: 'app'; appId: string; fromScreen: 'category' | 'featured'; fromCategoryId?: string }

// ── Callbacks ─────────────────────────────────────────────────────────────────

export type StateChangeHandler   = (state: ViewState) => void
export type InstallToggleHandler = (app: StoreApp, nowInstalled: boolean) => void

// ── Manager ───────────────────────────────────────────────────────────────────

export class AppStoreLensManager {
  private bridge: EvenAppBridge
  private initialized = false
  private state: ViewState = { screen: 'home' }
  private installedIds = new Set<string>(APPS.filter(a => a.installed).map(a => a.id))
  private listCount = 0

  onStateChange?: StateChangeHandler
  onInstallToggle?: InstallToggleHandler

  constructor(bridge?: EvenAppBridge) {
    this.bridge = bridge ?? EvenAppBridge.getInstance()
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    this.listenForGlassesEvents()

    const page = new CreateStartUpPageContainer({
      textObject: [
        new TextContainerProperty({
          containerID: C.HEADER,
          containerName: 'header',
          content: 'Even Hub Store',
          xPosition: 0,
          yPosition: 0,
          width: LENS_W,
          height: 40,
        }),
      ],
      listObject: [
        new ListContainerProperty({
          containerID: C.LIST,
          containerName: 'list',
          xPosition: 0,
          yPosition: 50,
          width: LENS_W,
          height: 140,
          isEventCapture: 1,
          itemContainer: new ListItemContainerProperty({
            itemCount: 1,
            itemWidth: GRID_W,
            isItemSelectBorderEn: 1,
            itemName: ['Loading…'],
          }),
        }),
      ],
    })

    await this.bridge.createStartUpPageContainer(page)
    this.initialized = true
    await this.renderHome()
  }

  // ── Public navigation ─────────────────────────────────────────────────────

  async goHome(): Promise<void> {
    await this.navigate({ screen: 'home' })
  }

  async goBack(): Promise<void> {
    const s = this.state
    if (s.screen === 'home') return
    if (s.screen === 'featured' || s.screen === 'category') {
      await this.navigate({ screen: 'home' })
    } else if (s.screen === 'app') {
      await this.navigate(
        s.fromScreen === 'featured'
          ? { screen: 'featured' }
          : { screen: 'category', categoryId: s.fromCategoryId! }
      )
    }
  }

  async goToCategory(categoryId: string): Promise<void> {
    await this.navigate({ screen: 'category', categoryId })
  }

  async goToFeatured(): Promise<void> {
    await this.navigate({ screen: 'featured' })
  }

  async goToApp(appId: string, fromScreen: 'category' | 'featured', fromCategoryId?: string): Promise<void> {
    await this.navigate({ screen: 'app', appId, fromScreen, fromCategoryId })
  }

  getCurrentState(): ViewState { return this.state }
  isInstalled(appId: string):  boolean { return this.installedIds.has(appId) }

  // ── Private navigation ────────────────────────────────────────────────────

  private async navigate(next: ViewState): Promise<void> {
    if (!this.initialized) return
    this.state = next
    this.onStateChange?.(next)

    switch (next.screen) {
      case 'home':     await this.renderHome();                     break
      case 'featured': await this.renderFeatured();                 break
      case 'category': await this.renderCategory(next.categoryId); break
      case 'app':      await this.renderApp(next.appId);           break
    }
  }

  // ── Screens ───────────────────────────────────────────────────────────────

  private async renderHome(): Promise<void> {
    // 6 category tiles → 3 rows × 2 columns
    const items = CATEGORIES.map(cat => {
      const n = APPS.filter(a => a.category === cat.id).length
      return `${cat.icon}  ${cat.name}  (${n})`
    })
    await Promise.all([
      this.setHeader('Even Hub Store'),
      this.setGrid(items),
    ])
  }

  private async renderFeatured(): Promise<void> {
    const apps  = getFeaturedApps()
    const items = apps.map(a => cardLabel(a, this.installedIds.has(a.id)))
    await Promise.all([
      this.setHeader('⭐ Featured  ·  double-tap = back'),
      this.setGrid(items),
    ])
  }

  private async renderCategory(categoryId: string): Promise<void> {
    const cat   = getCategory(categoryId)
    const apps  = getAppsInCategory(categoryId)
    const items = apps.map(a => cardLabel(a, this.installedIds.has(a.id)))
    await Promise.all([
      this.setHeader(`${cat?.icon ?? ''} ${cat?.name ?? ''}  ·  double-tap = back`),
      this.setGrid(items),
    ])
  }

  private async renderApp(appId: string): Promise<void> {
    const app = APPS.find(a => a.id === appId)
    if (!app) { await this.renderHome(); return }

    const installed = this.installedIds.has(appId)
    const lines = [
      `${app.icon}  ${app.name}`,
      `⭐ ${formatRating(app.rating)}  ·  ${formatReviewCount(app.reviewCount)} reviews`,
      installed ? '✓  Installed' : '📥  Tap to install',
      `${truncate(app.developer, 22)}  ·  v${app.version}`,
      ...wrapText(app.description, 36),
      '',
      'double-tap to go back',
    ]
    await Promise.all([
      this.setHeader(truncate(app.name, 30)),
      this.setList(lines),
    ])
  }

  // ── Container primitives ──────────────────────────────────────────────────

  private async setHeader(text: string): Promise<void> {
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: C.HEADER, content: text })
    )
  }

  /** 2-column grid: itemWidth = GRID_W (244) = half of 488 */
  private async setGrid(items: string[]): Promise<void> {
    this.listCount = items.length
    await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 2,
        listObject: [
          new ListContainerProperty({
            containerID: C.LIST,
            containerName: 'list',
            xPosition: 0,
            yPosition: 50,
            width: LENS_W,
            height: 140,
            isEventCapture: 1,
            itemContainer: new ListItemContainerProperty({
              itemCount: items.length,
              itemWidth: GRID_W,
              isItemSelectBorderEn: 1,
              itemName: items,
            }),
          }),
        ],
      })
    )
  }

  /** Full-width single-column list: itemWidth = LENS_W (488) */
  private async setList(items: string[]): Promise<void> {
    this.listCount = items.length
    await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 2,
        listObject: [
          new ListContainerProperty({
            containerID: C.LIST,
            containerName: 'list',
            xPosition: 0,
            yPosition: 50,
            width: LENS_W,
            height: 140,
            isEventCapture: 1,
            itemContainer: new ListItemContainerProperty({
              itemCount: items.length,
              itemWidth: LENS_W,
              isItemSelectBorderEn: 1,
              itemName: items,
            }),
          }),
        ],
      })
    )
  }

  // ── G2 event listener ─────────────────────────────────────────────────────

  private listenForGlassesEvents(): void {
    if (typeof document === 'undefined') return

    document.addEventListener(BridgeEvent.EvenHubEvent, (e: Event) => {
      const event   = e as CustomEvent<EvenHubEvent>
      const payload = event.detail
      if (!payload?.listEvent) return

      const le = List_ItemEvent.fromJson(payload.listEvent)
      if (le.containerID !== C.LIST) return

      if (le.eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        // Double-tap anywhere → back
        void this.goBack()
      } else if (le.eventType === OsEventTypeList.CLICK_EVENT) {
        this.routeTap(le.currentSelectItemIndex ?? 0)
      }
    })
  }

  // ── Tap routing ───────────────────────────────────────────────────────────

  private routeTap(index: number): void {
    const s = this.state

    if (s.screen === 'home') {
      if (index < CATEGORIES.length) {
        void this.navigate({ screen: 'category', categoryId: CATEGORIES[index].id })
      }
      return
    }

    if (s.screen === 'featured') {
      const app = getFeaturedApps()[index]
      if (app) void this.navigate({ screen: 'app', appId: app.id, fromScreen: 'featured' })
      return
    }

    if (s.screen === 'category') {
      const app = getAppsInCategory(s.categoryId)[index]
      if (app) void this.navigate({
        screen: 'app', appId: app.id,
        fromScreen: 'category', fromCategoryId: s.categoryId,
      })
      return
    }

    if (s.screen === 'app') {
      // Row 2 (index 2) = install action
      if (index === 2) {
        const app = APPS.find(a => a.id === s.appId)
        if (app && !this.installedIds.has(s.appId)) {
          this.installedIds.add(s.appId)
          this.onInstallToggle?.(app, true)
          void this.renderApp(s.appId)
        }
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

/** Format a single grid tile: icon + name + installed badge */
function cardLabel(app: StoreApp, installed: boolean): string {
  const badge = installed ? ' ✓' : ''
  return `${app.icon}  ${truncate(app.name, 12)}${badge}`
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + (line ? ' ' : '') + word).length <= maxChars) {
      line += (line ? ' ' : '') + word
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}
