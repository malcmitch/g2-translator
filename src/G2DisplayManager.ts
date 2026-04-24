// src/G2DisplayManager.ts
// Pushes translation + suggestions to Even Realities G2 lens
// Uses @evenrealities/even_hub_sdk — verified against SDK v0.0.10 type definitions

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
import type { PipelineResult } from './types.js'

// Stable container IDs — used for in-place updates
const CONTAINER_ID = {
  TRANSLATION: 1,
  SUGGESTIONS: 2,
} as const

// Fixed action items always appended after suggestions
const ACTION_ITEMS = {
  REGEN: '↻  More options',
  TYPE:  '✏  Type reply',
} as const

export type SuggestionSelectHandler  = (index: number, text: string) => void
export type RegenerateRequestHandler = () => void
export type TypeReplyRequestHandler  = () => void

export class G2DisplayManager {
  private bridge: EvenAppBridge
  private initialized = false
  private onSuggestionSelect?: SuggestionSelectHandler
  private onRegenerateRequest?: RegenerateRequestHandler
  private onTypeReplyRequest?: TypeReplyRequestHandler
  /** Tracks how many real suggestions are in the current list */
  private currentSuggestionCount = 0

  constructor(bridge?: EvenAppBridge) {
    this.bridge = bridge ?? EvenAppBridge.getInstance()
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Call once on app start — sets up the lens layout and wires event listeners.
   */
  async init(
    onSuggestionSelect?: SuggestionSelectHandler,
    onRegenerateRequest?: RegenerateRequestHandler,
    onTypeReplyRequest?: TypeReplyRequestHandler,
  ): Promise<void> {
    this.onSuggestionSelect  = onSuggestionSelect
    this.onRegenerateRequest = onRegenerateRequest
    this.onTypeReplyRequest  = onTypeReplyRequest
    this.listenForGlassesEvents()

    const page = new CreateStartUpPageContainer({
      textObject: [
        new TextContainerProperty({
          containerID: CONTAINER_ID.TRANSLATION,
          containerName: 'translation',
          content: 'Listening…',
          xPosition: 0,
          yPosition: 0,
          width: 488,
          height: 40,
        }),
      ],
      listObject: [
        new ListContainerProperty({
          containerID: CONTAINER_ID.SUGGESTIONS,
          containerName: 'suggestions',
          xPosition: 0,
          yPosition: 50,
          width: 488,
          height: 120,
          isEventCapture: 1,
          itemContainer: new ListItemContainerProperty({
            itemCount: 2,
            itemWidth: 488,
            isItemSelectBorderEn: 1,
            itemName: [ACTION_ITEMS.REGEN, ACTION_ITEMS.TYPE],
          }),
        }),
      ],
    })

    await this.bridge.createStartUpPageContainer(page)
    this.initialized = true
  }

  // ── Update lens content ───────────────────────────────────────────────────

  /**
   * Push a full pipeline result to the lens.
   * Uses textContainerUpgrade (fast) for translation text.
   * Uses rebuildPageContainer for the suggestions list (required by SDK for list updates).
   */
  async show(result: PipelineResult): Promise<void> {
    if (!this.initialized) await this.init()
    await Promise.all([
      this.updateTranslation(result),
      this.updateSuggestions(result.suggestions),
    ])
  }

  async setStatus(message: string): Promise<void> {
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: CONTAINER_ID.TRANSLATION,
        content: message,
      })
    )
  }

  async setIdle(message = 'Listening…'): Promise<void> {
    await this.setStatus(message)
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async updateTranslation(result: PipelineResult): Promise<void> {
    const badge = result.isOffline ? ' · offline' : ''
    const content = `"${truncate(result.translation, 38)}"${badge}`
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: CONTAINER_ID.TRANSLATION, content })
    )
  }

  private async updateSuggestions(suggestions: string[]): Promise<void> {
    const capped = suggestions.slice(0, 3)
    this.currentSuggestionCount = capped.length

    // Suggestion items: "1  text", "2  text", ...
    const suggestionItems = capped.map((s, i) => `${i + 1}  ${truncate(s, 26)}`)
    // Always append the two action items
    const allItems = [...suggestionItems, ACTION_ITEMS.REGEN, ACTION_ITEMS.TYPE]

    // List updates require rebuildPageContainer (textContainerUpgrade is text-only)
    await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: 2,
        listObject: [
          new ListContainerProperty({
            containerID: CONTAINER_ID.SUGGESTIONS,
            containerName: 'suggestions',
            xPosition: 0,
            yPosition: 50,
            width: 488,
            height: 120,
            isEventCapture: 1,
            itemContainer: new ListItemContainerProperty({
              itemCount: allItems.length,
              itemWidth: 488,
              isItemSelectBorderEn: 1,
              itemName: allItems,
            }),
          }),
        ],
      })
    )
  }

  // ── G2 hardware event listener ────────────────────────────────────────────

  /**
   * Routes tap events from the glasses list:
   *   index < currentSuggestionCount  →  user wants to use that suggestion
   *   index === currentSuggestionCount     →  ↻ More options
   *   index === currentSuggestionCount + 1 →  ✏ Type reply
   */
  private listenForGlassesEvents(): void {
    if (typeof document === 'undefined') return

    document.addEventListener(BridgeEvent.EvenHubEvent, (e: Event) => {
      const event = e as CustomEvent<EvenHubEvent>
      const payload = event.detail

      if (payload?.listEvent) {
        const listEvent = List_ItemEvent.fromJson(payload.listEvent)
        if (
          listEvent.containerID === CONTAINER_ID.SUGGESTIONS &&
          listEvent.eventType === OsEventTypeList.CLICK_EVENT
        ) {
          const index = listEvent.currentSelectItemIndex ?? 0
          const name  = listEvent.currentSelectItemName ?? ''
          this.routeTap(index, name)
        }
      }
    })
  }

  private routeTap(index: number, name: string): void {
    const regenIndex = this.currentSuggestionCount
    const typeIndex  = this.currentSuggestionCount + 1

    if (index < this.currentSuggestionCount) {
      this.onSuggestionSelect?.(index, name)
    } else if (index === regenIndex) {
      this.onRegenerateRequest?.()
    } else if (index === typeIndex) {
      this.onTypeReplyRequest?.()
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function truncate(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : text.slice(0, maxChars - 1) + '…'
}

export function padTo3(arr: string[]): string[] {
  const out = arr.slice(0, 3)
  while (out.length < 3) out.push('')
  return out
}
