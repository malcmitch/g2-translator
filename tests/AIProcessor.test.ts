// tests/AIProcessor.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { AIProcessor } from '../src/AIProcessor'
import { NetworkMonitor } from '../src/NetworkMonitor'
import type { SuggestionPair } from '../src/types'

// ── Shared helpers ─────────────────────────────────────────────────────────

function makeNetwork(online: boolean): NetworkMonitor {
  const n = new NetworkMonitor()
  n.setOnline(online)
  return n
}

function makePairs(count = 3): SuggestionPair[] {
  return Array.from({ length: count }, (_, i) => ({
    english: `Option ${i + 1}`,
    spanish: `Opción ${i + 1}`,
  }))
}

function mockFetchWith(pairs: SuggestionPair[], translation = 'Test translation') {
  return mock(async () => ({
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({ translation, suggestions: pairs }),
        },
      }],
    }),
  })) as any
}

// ── Online mode ────────────────────────────────────────────────────────────

describe('AIProcessor (online mode)', () => {
  const mockApiKey = 'sk-test-key'

  it('parses valid GPT-4o JSON response correctly — returns SuggestionPair[]', async () => {
    const pairs: SuggestionPair[] = [
      { english: 'Yes, of course',    spanish: 'Sí, con gusto' },
      { english: 'Where do I sign?',  spanish: '¿Dónde firmo?' },
      { english: 'One moment',        spanish: 'Un momento' },
    ]

    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetchWith(pairs, 'Can you sign here please?')

    const processor = new AIProcessor(mockApiKey, makeNetwork(true))
    const result = await processor.process('¿Puede firmar aquí?', [])

    expect(result.translation).toBe('Can you sign here please?')
    expect(result.suggestions).toHaveLength(3)
    expect(result.suggestions[0]).toEqual({ english: 'Yes, of course', spanish: 'Sí, con gusto' })
    expect(result.suggestions[0].english).toBeTruthy()
    expect(result.suggestions[0].spanish).toBeTruthy()
    expect(result.isOffline).toBe(false)

    globalThis.fetch = originalFetch
  })

  it('falls back to offline mode when fetch throws', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => { throw new Error('Network error') }) as any

    const processor = new AIProcessor(mockApiKey, makeNetwork(true))
    const result = await processor.process('¿Cuánto cuesta?', [])

    expect(result.isOffline).toBe(true)
    expect(result.suggestions).toHaveLength(3)
    result.suggestions.forEach((p) => {
      expect(p.english).toBeTruthy()
      expect(p.spanish).toBeTruthy()
    })

    globalThis.fetch = originalFetch
  })

  it('falls back to offline when API returns non-ok status', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => ({ ok: false, status: 429 })) as any

    const processor = new AIProcessor(mockApiKey, makeNetwork(true))
    const result = await processor.process('Hola', [])

    expect(result.isOffline).toBe(true)

    globalThis.fetch = originalFetch
  })

  it('includes conversation history in the prompt (integration check)', async () => {
    let capturedBody: any

    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({
            translation: 'Hi',
            suggestions: makePairs(),
          }) } }],
        }),
      }
    }) as any

    const processor = new AIProcessor(mockApiKey, makeNetwork(true))
    await processor.process('Hola de nuevo', [
      { speakerIsUser: false, originalText: 'Hola', translatedText: 'Hello' },
    ])

    const userMsg = capturedBody.messages.find((m: any) => m.role === 'user').content
    expect(userMsg).toContain('Hola')
    expect(userMsg).toContain('Hello')

    globalThis.fetch = originalFetch
  })
})

// ── Offline mode ───────────────────────────────────────────────────────────

describe('AIProcessor (offline mode)', () => {
  it('returns offline result with 3 bilingual pairs', async () => {
    const processor = new AIProcessor('', makeNetwork(false))
    const result = await processor.process('¿Cuánto cuesta esto?', [])

    expect(result.isOffline).toBe(true)
    expect(result.suggestions).toHaveLength(3)
    result.suggestions.forEach((p) => {
      expect(p.english.length).toBeGreaterThan(0)
      expect(p.spanish.length).toBeGreaterThan(0)
    })
  })

  it('does not call fetch in offline mode', async () => {
    let fetchCalled = false
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => { fetchCalled = true; return {} }) as any

    const processor = new AIProcessor('sk-test', makeNetwork(false))
    await processor.process('Hola', [])

    expect(fetchCalled).toBe(false)
    globalThis.fetch = originalFetch
  })

  it('uses template engine for contextual offline suggestions', async () => {
    const processor = new AIProcessor('', makeNetwork(false))
    const result = await processor.process('cuánto cuesta', [])

    // Price scenario should fire — check English glosess for price-related content
    const englishGlosses = result.suggestions.map((p) => p.english.toLowerCase())
    const hasPrice = englishGlosses.some((g) =>
      g.includes('total') || g.includes('fine') || g.includes('discount') || g.includes('price')
    )
    expect(hasPrice).toBe(true)
  })
})

// ── processOnline unit (direct call) ──────────────────────────────────────

describe('AIProcessor.processOnline', () => {
  it('throws when suggestions array is empty after filtering', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ translation: 'Hi', suggestions: [] }) } }],
      }),
    })) as any

    const processor = new AIProcessor('sk-test', makeNetwork(true))
    await expect(processor.processOnline('Hola', [])).rejects.toThrow()

    globalThis.fetch = originalFetch
  })

  it('limits suggestions to 3 even if API returns more', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              translation: 'Hello',
              suggestions: makePairs(5),
            }),
          },
        }],
      }),
    })) as any

    const processor = new AIProcessor('sk-test', makeNetwork(true))
    const result = await processor.processOnline('Hola', [])
    expect(result.suggestions).toHaveLength(3)

    globalThis.fetch = originalFetch
  })

  it('each suggestion pair has non-empty english and spanish', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mockFetchWith(makePairs(3), 'Test')

    const processor = new AIProcessor('sk-test', makeNetwork(true))
    const result = await processor.processOnline('Hola', [])

    result.suggestions.forEach((p) => {
      expect(p.english).toBeTruthy()
      expect(p.spanish).toBeTruthy()
    })

    globalThis.fetch = originalFetch
  })
})
