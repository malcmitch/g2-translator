// tests/AIProcessor.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { AIProcessor } from '../src/AIProcessor'
import { NetworkMonitor } from '../src/NetworkMonitor'

// ── Shared mock network ────────────────────────────────────────────────────

function makeNetwork(online: boolean): NetworkMonitor {
  const n = new NetworkMonitor()
  n.setOnline(online)
  return n
}

// ── Online mode ────────────────────────────────────────────────────────────

describe('AIProcessor (online mode)', () => {
  const mockApiKey = 'sk-test-key'

  it('parses valid GPT-4o JSON response correctly', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            translation: 'Can you sign here please?',
            suggestions: ['Sí, con gusto', '¿Dónde firmo?', 'Un momento'],
          }),
        },
      }],
    }

    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => ({
      ok: true,
      json: async () => mockResponse,
    })) as any

    const processor = new AIProcessor(mockApiKey, makeNetwork(true))
    const result = await processor.process('¿Puede firmar aquí?', [])

    expect(result.translation).toBe('Can you sign here please?')
    expect(result.suggestions).toHaveLength(3)
    expect(result.suggestions[0]).toBe('Sí, con gusto')
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
          choices: [{ message: { content: JSON.stringify({ translation: 'Hi', suggestions: ['Hola', 'Buenos días', 'Qué tal'] }) } }],
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
  it('returns offline result with 3 template suggestions', async () => {
    const processor = new AIProcessor('', makeNetwork(false))
    const result = await processor.process('¿Cuánto cuesta esto?', [])

    expect(result.isOffline).toBe(true)
    expect(result.suggestions).toHaveLength(3)
    result.suggestions.forEach((s) => expect(s.length).toBeGreaterThan(0))
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

    expect(result.suggestions.some((s) =>
      s.includes('Cuánto') || s.includes('acepto') || s.includes('descuento')
    )).toBe(true)
  })
})

// ── processOnline unit (direct call) ──────────────────────────────────────

describe('AIProcessor.processOnline', () => {
  it('throws on invalid JSON response shape', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = mock(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ wrong_key: 'oops' }) } }],
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
              suggestions: ['S1', 'S2', 'S3', 'S4', 'S5'],
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
})
