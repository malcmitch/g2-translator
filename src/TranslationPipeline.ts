// src/TranslationPipeline.ts
// Main orchestrator: speech → AI → G2 lens
// Wires together SpeechService, AIProcessor, G2DisplayManager, and conversation history

import type { PipelineResult, ConversationTurn } from './types.js'
import { AIProcessor } from './AIProcessor.js'
import { SpeechService } from './SpeechService.js'
import { G2DisplayManager } from './G2DisplayManager.js'
import { NetworkMonitor } from './NetworkMonitor.js'

export interface PipelineConfig {
  openAiKey?: string
  language?: string           // STT language, default 'es'
  maxHistoryTurns?: number    // context window size, default 6
}

export class TranslationPipeline {
  private speech: SpeechService
  private ai: AIProcessor
  private display: G2DisplayManager
  private history: ConversationTurn[] = []
  private maxHistoryTurns: number
  private language: string
  private _isRunning = false
  private lastResult?: PipelineResult
  private selectedIndex = 0

  get isRunning(): boolean { return this._isRunning }

  constructor(config: PipelineConfig = {}, deps?: {
    speech?: SpeechService
    ai?: AIProcessor
    display?: G2DisplayManager
  }) {
    this.language = config.language ?? 'es'
    this.maxHistoryTurns = config.maxHistoryTurns ?? 6

    const network = NetworkMonitor.instance
    this.speech = deps?.speech ?? new SpeechService(config.openAiKey, network)
    this.ai = deps?.ai ?? new AIProcessor(config.openAiKey, network)
    this.display = deps?.display ?? new G2DisplayManager()
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this._isRunning) return
    this._isRunning = true

    await this.display.init((index, text) => {
      this.onSuggestionSelected(index, text)
    })

    await this.speech.start(this.language, (transcript) => {
      this.onSpeech(transcript)
    })
  }

  stop(): void {
    this._isRunning = false
    this.speech.stop()
  }

  // ── Event Handlers ────────────────────────────────────────────────────────

  private onSpeech(spokenSpanish: string): void {
    // Fire-and-forget — update display as soon as result arrives
    this.processUtterance(spokenSpanish).catch((err) => {
      console.error('[TranslationPipeline] Error processing utterance:', err)
    })
  }

  private async processUtterance(spokenSpanish: string): Promise<void> {
    const result = await this.ai.process(spokenSpanish, [...this.history]) // snapshot — avoid mock ref capture & mid-flight mutation
    this.lastResult = result
    this.selectedIndex = 0

    // Append to conversation history
    this.history.push({
      speakerIsUser: false,
      originalText: spokenSpanish,
      translatedText: result.translation,
    })
    if (this.history.length > this.maxHistoryTurns) {
      this.history.splice(0, this.history.length - this.maxHistoryTurns)
    }

    await this.display.show(result)
  }

  /**
   * Called when the user selects a suggestion from the glasses lens.
   * Records the choice in conversation history for context continuity.
   */
  private onSuggestionSelected(index: number, _rawText: string): void {
    const suggestion = this.lastResult?.suggestions[index]
    if (!suggestion) return

    this.selectedIndex = index
    this.history.push({
      speakerIsUser: true,
      originalText: suggestion,
      translatedText: suggestion,
    })
    if (this.history.length > this.maxHistoryTurns) {
      this.history.splice(0, this.history.length - this.maxHistoryTurns)
    }
  }

  // ── Accessors (for testing) ───────────────────────────────────────────────

  getHistory(): ConversationTurn[] { return [...this.history] }
  getLastResult(): PipelineResult | undefined { return this.lastResult }
  getSelectedIndex(): number { return this.selectedIndex }
}
