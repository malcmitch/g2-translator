// src/G2DisplayManager.ts
// Pushes translation + bilingual suggestions to Even Realities G2 lens
// Uses @evenrealities/even_hub_sdk — verified against SDK v0.0.10 type definitions
//
// Lens list layout (3 suggestions = 8 items total):
//   "  Sure, one moment"         ← English label (index 0) — tapping speaks suggestion 0
//   "1 Un momento, por favor"    ← Spanish (index 1)        — tapping speaks suggestion 0
//   "  I need to review it"      ← English label (index 2) — tapping speaks suggestion 1
//   "2 Necesito revisarlo"       ← Spanish (index 3)        — tapping speaks suggestion 1
//   "  We can change that"       ← English label (index 4) — tapping speaks suggestion 2
//   "3 Podemos modificar eso"    ← Spanish (index 5)        — tapping speaks suggestion 2
//   "↻  More options"            ← action (index 6)
//   "✏  Type reply"              ← action (index 7)
//
// Tap routing: index < pairCount*2 → Math.floor(index/2) = suggestion index
//              index === pairCount*2   → regenerate
//              index === pairCount*2+1 → type reply

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
import type { PipelineResult, SuggestionPair } from './types.js'

const CONTAINER_ID = {
  TRANSLATION: 1,
  SUGGESTIONS: 2,
} as const

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
  /** Number of suggestion pairs currently in the list (max 3) */
  private currentPairCount = 0

  constructor(bridge?: EvenAppBridge) {
    this.bridge = bridge ?? EvenAppBridge.getInstance()
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

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
          height: 140,
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

  /**
   * Builds the interleaved English/Spanish list:
   *   [English label, Spanish item, English label, Spanish item, …, ↻, ✏]
   *
   * Both the English line and the Spanish line for a suggestion share the
   * same logical index (floor(tapIndex / 2)), so either line can be tapped
   * to select that suggestion.
   */
  private async updateSuggestions(suggestions: SuggestionPair[]): Promise<void> {
    const capped = suggestions.slice(0, 3)
    this.currentPairCount = capped.length

    const pairItems: string[] = []
    capped.forEach((pair, i) => {
      pairItems.push(`  ${truncate(pair.english, 28)}`)          // English label (no number)
      pairItems.push(`${i + 1} ${truncate(pair.spanish, 26)}`)   // Numbered Spanish
    })

    const allItems = [...pairItems, ACTION_ITEMS.REGEN, ACTION_ITEMS.TYPE]

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
            height: 140,
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

  /**
   * Tap routing with interleaved pair layout:
   *   Pairs occupy indices 0..(pairCount*2 - 1)
   *   Tapping either English (even) or Spanish (odd) within a pair → same suggestion
   *   Regen = pairCount*2
   *   Type  = pairCount*2 + 1
   */
  private routeTap(index: number, name: string): void {
    const actionStart = this.currentPairCount * 2

    if (index < actionStart) {
      const suggestionIndex = Math.floor(index / 2)
      this.onSuggestionSelect?.(suggestionIndex, name)
    } else if (index === actionStart) {
      this.onRegenerateRequest?.()
    } else if (index === actionStart + 1) {
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
