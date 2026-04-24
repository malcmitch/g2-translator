// src/AIProcessor.ts
// Online: single GPT-4o call → translation + 3 Spanish suggestions (JSON)
// Offline: placeholder translation + TemplateSuggestionEngine suggestions

import type { PipelineResult, ConversationTurn } from './types.js'
import { TemplateSuggestionEngine } from './TemplateSuggestionEngine.js'
import { NetworkMonitor } from './NetworkMonitor.js'

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions'

interface OpenAIMessage { role: string; content: string }
interface OpenAIChoice { message: { content: string } }
interface OpenAIResponse { choices: OpenAIChoice[] }

interface ProcessedResult {
  translation: string
  suggestions: string[]
}

export class AIProcessor {
  private templateEngine = new TemplateSuggestionEngine()
  private apiKey: string
  private network: NetworkMonitor

  constructor(apiKey?: string, network?: NetworkMonitor) {
    this.apiKey = apiKey ?? (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY ?? '' : '')
    this.network = network ?? NetworkMonitor.instance
  }

  async process(spokenSpanish: string, history: ConversationTurn[]): Promise<PipelineResult> {
    if (this.network.isOnline && this.apiKey) {
      try {
        const result = await this.processOnline(spokenSpanish, history)
        return { ...result, isOffline: false, sourceUtterance: spokenSpanish }
      } catch (err) {
        console.warn('[AIProcessor] Online call failed, falling back offline:', err)
      }
    }
    return { ...this.processOffline(spokenSpanish), sourceUtterance: spokenSpanish }
  }

  /**
   * Re-run suggestion generation for the same utterance, explicitly
   * excluding previously shown suggestions so the user gets fresh options.
   */
  async regenerate(
    spokenSpanish: string,
    history: ConversationTurn[],
    excludeSuggestions: string[],
  ): Promise<PipelineResult> {
    if (this.network.isOnline && this.apiKey) {
      try {
        const result = await this.processOnline(spokenSpanish, history, excludeSuggestions)
        return { ...result, isOffline: false, sourceUtterance: spokenSpanish }
      } catch (err) {
        console.warn('[AIProcessor] Regenerate failed, falling back offline:', err)
      }
    }
    return { ...this.processOffline(spokenSpanish), sourceUtterance: spokenSpanish }
  }

  /**
   * Translate an English phrase to natural spoken Spanish.
   * Used when Malcolm types a reply instead of selecting a suggestion.
   */
  async translateToSpanish(englishText: string): Promise<string> {
    if (!this.network.isOnline || !this.apiKey) {
      return englishText // fallback: speak the English text as-is
    }

    const messages: OpenAIMessage[] = [
      {
        role: 'system',
        content: [
          'Translate the following English phrase to natural, conversational Mexican Spanish.',
          'Return ONLY the Spanish translation — no quotes, no explanation, no extra text.',
          'Keep it concise and suitable for spoken conversation.',
        ].join(' '),
      },
      { role: 'user', content: englishText },
    ]

    const res = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-4o', temperature: 0.3, messages }),
    })

    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)
    const data = (await res.json()) as OpenAIResponse
    return data.choices?.[0]?.message?.content?.trim() ?? englishText
  }

  // ── Online: GPT-4o ────────────────────────────────────────────────────────

  async processOnline(
    spokenSpanish: string,
    history: ConversationTurn[],
    excludeSuggestions: string[] = [],
  ): Promise<ProcessedResult> {
    const historyContext = history
      .slice(-4)
      .map((t) =>
        t.speakerIsUser
          ? `You replied (Spanish): ${t.originalText}`
          : `They said: ${t.originalText} → "${t.translatedText}"`
      )
      .join('\n')

    const systemPrompt = [
      'You are a real-time translation assistant for an English speaker in a Spanish conversation.',
      'Return ONLY valid JSON matching this shape exactly:',
      '{ "translation": "<English, max 12 words>", "suggestions": ["<Spanish 1, max 8 words>", "<Spanish 2, max 8 words>", "<Spanish 3, max 8 words>"] }',
      'Suggestions must be natural, contextually varied, and display-safe (no special chars).',
      'Word limits are strict — text renders on smart glasses lens.',
      excludeSuggestions.length > 0
        ? `Do NOT repeat these previous suggestions: ${excludeSuggestions.map((s) => `"${s}"`).join(', ')}. Generate entirely different options.`
        : '',
    ].filter(Boolean).join('\n')

    const userPrompt = historyContext
      ? `Conversation so far:\n${historyContext}\n\nThey just said (Spanish): "${spokenSpanish}"`
      : `They just said (Spanish): "${spokenSpanish}"`

    const messages: OpenAIMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const body = {
      model: 'gpt-4o',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages,
    }

    const res = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`)

    const data = (await res.json()) as OpenAIResponse
    const content = data.choices?.[0]?.message?.content ?? '{}'
    const parsed = JSON.parse(content) as { translation?: string; suggestions?: string[] }

    const translation = parsed.translation ?? '...'
    const suggestions = (parsed.suggestions ?? []).slice(0, 3)

    if (!translation || suggestions.length === 0) throw new Error('Invalid response shape')

    return { translation, suggestions }
  }

  // ── Offline: template engine ──────────────────────────────────────────────

  processOffline(spokenSpanish: string): PipelineResult {
    const suggestions = this.templateEngine.suggest(spokenSpanish)
    // Translation is unavailable without network in this offline mode.
    // Apple Translation framework wires in via the SwiftUI host — see docs/sdk-architecture-note.md
    return {
      translation: '(Translation unavailable offline)',
      suggestions,
      isOffline: true,
    }
  }
}
