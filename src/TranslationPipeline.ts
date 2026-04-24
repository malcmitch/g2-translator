// src/TranslationPipeline.ts
// Main orchestrator: speech → AI → G2 lens + TTS reply
//
// Reply flow (bidirectional):
//   1. They speak Spanish → translate → show on lens + suggest 2–3 Spanish replies
//   2. Malcolm taps a suggestion → phone speaks it (TTS) + records in history
//   3. Malcolm taps "↻ More options" → AI regenerates with different suggestions
//   4. Malcolm taps "✏ Type reply" → onTypeReplyRequest fires → App shows text input
//   5. Malcolm submits typed English → translated to Spanish → TTS speaks it

import type { PipelineResult, ConversationTurn } from './types.js'
import { AIProcessor } from './AIProcessor.js'
import { SpeechService } from './SpeechService.js'
import { G2DisplayManager } from './G2DisplayManager.js'
import { TTSService } from './TTSService.js'
import { NetworkMonitor } from './NetworkMonitor.js'

export interface PipelineConfig {
  openAiKey?: string
  language?: string           // STT language, default 'es'
  maxHistoryTurns?: number    // context window size, default 6
}

export class TranslationPipeline {
  private speech:  SpeechService
  private ai:      AIProcessor
  private display: G2DisplayManager
  private tts:     TTSService
  private history: ConversationTurn[] = []
  private maxHistoryTurns: number
  private language: string
  private _isRunning = false
  private lastResult?: PipelineResult
  private selectedIndex = 0

  // ── Public callback hooks — set before calling start() ───────────────────

  /** Fires when the user taps "✏ Type reply" on the glasses. App should show text input. */
  onTypeReplyRequest?: () => void

  /** Fires when TTS starts or stops speaking. Pass `speaking=true` with the text being spoken. */
  onSpeakingChange?: (speaking: boolean, text?: string) => void

  get isRunning(): boolean { return this._isRunning }

  constructor(config: PipelineConfig = {}, deps?: {
    speech?:  SpeechService
    ai?:      AIProcessor
    display?: G2DisplayManager
    tts?:     TTSService
  }) {
    this.language       = config.language ?? 'es'
    this.maxHistoryTurns = config.maxHistoryTurns ?? 6

    const network = NetworkMonitor.instance
    const key = config.openAiKey ?? ''
    this.speech  = deps?.speech  ?? new SpeechService(key, network)
    this.ai      = deps?.ai      ?? new AIProcessor(key, network)
    this.display = deps?.display ?? new G2DisplayManager()
    this.tts     = deps?.tts     ?? new TTSService(key)
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async start(): Promise<void> {
    if (this._isRunning) return
    this._isRunning = true

    await this.display.init(
      (index, _text) => this.onSuggestionSelected(index),
      ()             => this.onRegenerateRequested(),
      ()             => this.onTypeReplyRequested(),
    )

    await this.speech.start(this.language, (transcript) => {
      this.onSpeech(transcript)
    })
  }

  stop(): void {
    this._isRunning = false
    this.tts.stop()
    this.speech.stop()
  }

  // ── Event Handlers ────────────────────────────────────────────────────────

  private onSpeech(spokenSpanish: string): void {
    this.processUtterance(spokenSpanish).catch((err) => {
      console.error('[TranslationPipeline] Error processing utterance:', err)
    })
  }

  private async processUtterance(spokenSpanish: string): Promise<void> {
    const result = await this.ai.process(spokenSpanish, [...this.history])
    this.lastResult  = result
    this.selectedIndex = 0

    this.addToHistory({
      speakerIsUser: false,
      originalText:  spokenSpanish,
      translatedText: result.translation,
    })

    await this.display.show(result)
  }

  /**
   * User tapped a suggestion on the glasses.
   * Phone speaks it via TTS; the selection is recorded in history.
   */
  private onSuggestionSelected(index: number): void {
    const suggestion = this.lastResult?.suggestions[index]
    if (!suggestion) return

    this.selectedIndex = index

    // Speak the suggestion — fire and forget; update UI status via callback
    this.speakSuggestion(suggestion).catch((err) => {
      console.error('[TranslationPipeline] TTS error:', err)
      this.onSpeakingChange?.(false)
    })

    // Record in history immediately (don't wait for TTS to finish)
    this.addToHistory({
      speakerIsUser:  true,
      originalText:   suggestion,
      translatedText: suggestion,
    })
  }

  private async speakSuggestion(text: string): Promise<void> {
    await this.display.setStatus(`Speaking: ${text}`)
    this.onSpeakingChange?.(true, text)
    await this.tts.speak(text)
    this.onSpeakingChange?.(false)
    // Restore the translation text after speaking
    if (this.lastResult) await this.display.show(this.lastResult)
  }

  /**
   * User tapped "↻ More options" — fetch different suggestions for the same utterance.
   */
  private onRegenerateRequested(): void {
    const source      = this.lastResult?.sourceUtterance
    const prevSuggest = this.lastResult?.suggestions ?? []
    if (!source) return

    this.regenerateSuggestions(source, prevSuggest).catch((err) => {
      console.error('[TranslationPipeline] Regenerate error:', err)
    })
  }

  private async regenerateSuggestions(
    sourceUtterance: string,
    excludeSuggestions: string[],
  ): Promise<void> {
    await this.display.setStatus('Finding more options…')
    const result = await this.ai.regenerate(
      sourceUtterance,
      [...this.history],
      excludeSuggestions,
    )
    this.lastResult = result
    await this.display.show(result)
  }

  /**
   * User tapped "✏ Type reply" — notify the App to open the text input.
   */
  private onTypeReplyRequested(): void {
    this.onTypeReplyRequest?.()
  }

  /**
   * Called by App when Malcolm submits a typed English reply.
   * Translates to Spanish and speaks it via TTS.
   */
  async submitTypedReply(englishText: string): Promise<void> {
    await this.display.setStatus('Translating…')
    this.onSpeakingChange?.(true)

    try {
      const spanish = await this.ai.translateToSpanish(englishText)
      await this.display.setStatus(`Speaking: ${spanish}`)
      this.onSpeakingChange?.(true, spanish)
      await this.tts.speak(spanish)
      this.onSpeakingChange?.(false)

      // Record the exchange in history
      this.addToHistory({
        speakerIsUser:  true,
        originalText:   spanish,
        translatedText: englishText,
      })

      // Restore previous translation display
      if (this.lastResult) await this.display.show(this.lastResult)
    } catch (err) {
      console.error('[TranslationPipeline] Typed reply error:', err)
      this.onSpeakingChange?.(false)
      await this.display.setIdle()
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private addToHistory(turn: ConversationTurn): void {
    this.history.push(turn)
    if (this.history.length > this.maxHistoryTurns) {
      this.history.splice(0, this.history.length - this.maxHistoryTurns)
    }
  }

  // ── Accessors (for testing + polling) ────────────────────────────────────

  getHistory():     ConversationTurn[]       { return [...this.history] }
  getLastResult():  PipelineResult | undefined { return this.lastResult }
  getSelectedIndex(): number                 { return this.selectedIndex }
  isSpeaking():     boolean                  { return this.tts.speaking }
}
