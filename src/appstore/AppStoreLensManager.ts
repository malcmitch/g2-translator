// src/appstore/AppStoreLensManager.ts
// Drives the G2 lens display for the Even Hub App Store browser.
//
// Three-screen navigation:
//   HOME      → scrollable list of categories
//   CATEGORY  → apps in the chosen category
//   APP       → detail view with install action
//
// Lens layout (all screens):
//   Text ID 1  (y=0,  h=40):  Current screen title / breadcrumb
//   List ID 2  (y=50, h=140): Tappable navigation items

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

const C = { HEADER: 1, LIST: 2 } as const
const LENS_W = 488

// ── Navigation state ──────────────────────────────────────────────────────────

export type ViewState =
  | { screen: 'home' }
  | { screen: 'category'; categoryId: string }
  | { screen: 'featured' }
  | { screen: 'app';  appId: string; fromScreen: 'category' | 'featured'; fromCategoryId?: string }

// ── Callbacks ─────────────────────────────────────────────────────────────────

export type StateChangeHandler   = (state: ViewState) => void
export type InstallToggleHandler = (app: StoreApp, nowInstalled: boolean) => void

// ── Manager ───────────────────────────────────────────────────────────────────

export class AppStoreLensManager {
  private bridge: EvenAppBridge
  private initialized = false
  private state: ViewState = { screen: 'home' }
  private installedIds = new Set<string>(APPS.filter(a => a.installed).map(a => a.id))

  // Current list item count, needed to route taps correctly
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
            itemWidth: LENS_W,
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

  async goHome(): Promise<void>  { await this.navigate({ screen: 'home' }) }
  async goBack(): Promise<void>  {
    if (this.state.screen === 'home' || this.state.screen === 'featured') {
      await this.navigate({ screen: 'home' })
    } else if (this.state.screen === 'category') {
      await this.navigate({ screen: 'home' })
    } else if (this.state.screen === 'app') {
      if (this.state.fromScreen === 'featured') {
        await this.navigate({ screen: 'featured' })
      } else {
        await this.navigate({ screen: 'category', categoryId: this.state.fromCategoryId! })
      }
    }
  }

  getCurrentState(): ViewState { return this.state }
  isInstalled(appId: string): boolean { return this.installedIds.has(appId) }

  async goToCategory(categoryId: string): Promise<void> {
    await this.navigate({ screen: 'category', categoryId })
  }

  async goToFeatured(): Promise<void> {
    await this.navigate({ screen: 'featured' })
  }

  async goToApp(appId: string, fromScreen: 'category' | 'featured', fromCategoryId?: string): Promise<void> {
    await this.navigate({ screen: 'app', appId, fromScreen, fromCategoryId })
  }

  // ── Private navigation ────────────────────────────────────────────────────

  private async navigate(next: ViewState): Promise<void> {
    if (!this.initialized) return
    this.state = next
    this.onStateChange?.(next)

    switch (next.screen) {
      case 'home':     await this.renderHome();                          break
      case 'featured': await this.renderFeatured();                      break
      case 'category': await this.renderCategory(next.categoryId);      break
      case 'app':      await this.renderApp(next.appId);                 break
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  private async renderHome(): Promise<void> {
    const items: string[] = CATEGORIES.map(cat => {
      const count = APPS.filter(a => a.category === cat.id).length
      return `${cat.icon}  ${cat.name.padEnd(14)} (${count})`
    })
    items.push('⭐  Featured Apps')

    await Promise.all([
      this.setHeader('Even Hub Store'),
      this.setList(items),
    ])
  }

  private async renderFeatured(): Promise<void> {
    const apps = getFeaturedApps()
    const items: string[] = [
      '← Back',
      ...apps.map(a => appListRow(a, this.installedIds.has(a.id))),
    ]
    await Promise.all([
      this.setHeader('⭐ Featured Apps'),
      this.setList(items),
    ])
  }

  private async renderCategory(categoryId: string): Promise<void> {
    const cat   = getCategory(categoryId)
    const apps  = getAppsInCategory(categoryId)
    const items: string[] = [
      '← Back',
      ...apps.map(a => appListRow(a, this.installedIds.has(a.id))),
    ]
    await Promise.all([
      this.setHeader(`${cat?.icon ?? ''} ${cat?.name ?? categoryId}`),
      this.setList(items),
    ])
  }

  private async renderApp(appId: string): Promise<void> {
    const app     = APPS.find(a => a.id === appId)
    if (!app) { await this.renderHome(); return }
    const installed = this.installedIds.has(appId)

    // Detail rows shown in the lens list
    const items: string[] = [
      '← Back',
      `⭐ ${formatRating(app.rating)}  ·  ${formatReviewCount(app.reviewCount)} reviews`,
      installed ? '✓  Installed' : '📥  Install',
      `By ${truncate(app.developer, 22)}  ·  v${app.version}`,
      ...wrapText(app.description, 34),
    ]

    await Promise.all([
      this.setHeader(truncate(app.name, 30)),
      this.setList(items),
    ])
  }

  // ── Container update primitives ───────────────────────────────────────────

  private async setHeader(text: string): Promise<void> {
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: C.HEADER, content: text })
    )
  }

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

  // ── G2 tap routing ────────────────────────────────────────────────────────

  private listenForGlassesEvents(): void {
    if (typeof document === 'undefined') return

    document.addEventListener(BridgeEvent.EvenHubEvent, (e: Event) => {
      const event = e as CustomEvent<EvenHubEvent>
      const payload = event.detail
      if (!payload?.listEvent) return

      const listEvent = List_ItemEvent.fromJson(payload.listEvent)
      if (
        listEvent.containerID === C.LIST &&
        listEvent.eventType   === OsEventTypeList.CLICK_EVENT
      ) {
        this.routeTap(listEvent.currentSelectItemIndex ?? 0)
      }
    })
  }

  private routeTap(index: number): void {
    const s = this.state

    if (s.screen === 'home') {
      if (index < CATEGORIES.length) {
        void this.navigate({ screen: 'category', categoryId: CATEGORIES[index].id })
      } else {
        // Featured item (last row)
        void this.navigate({ screen: 'featured' })
      }
      return
    }

    if (s.screen === 'featured') {
      if (index === 0) { void this.goBack(); return }
      const apps = getFeaturedApps()
      const app  = apps[index - 1]
      if (app) void this.navigate({ screen: 'app', appId: app.id, fromScreen: 'featured' })
      return
    }

    if (s.screen === 'category') {
      if (index === 0) { void this.goBack(); return }
      const apps = getAppsInCategory(s.categoryId)
      const app  = apps[index - 1]
      if (app) void this.navigate({ screen: 'app', appId: app.id, fromScreen: 'category', fromCategoryId: s.categoryId })
      return
    }

    if (s.screen === 'app') {
      if (index === 0) { void this.goBack(); return }
      if (index === 2) {
        // Install / already-installed row
        const app = APPS.find(a => a.id === s.appId)
        if (app && !this.installedIds.has(s.appId)) {
          this.installedIds.add(s.appId)
          this.onInstallToggle?.(app, true)
          void this.renderApp(s.appId)  // re-render to show ✓ Installed
        }
      }
    }
  }
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…'
}

function appListRow(app: StoreApp, installed: boolean): string {
  const star    = `⭐${formatRating(app.rating)}`
  const tag     = installed ? '✓' : ''
  const nameMax = 18
  const name    = truncate(app.name, nameMax).padEnd(nameMax)
  return `${name}  ${star} ${tag}`.trimEnd()
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
