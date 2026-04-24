// tests/TranslationPipeline.test.ts
import { describe, it, expect, mock } from 'bun:test'
import { TranslationPipeline } from '../src/TranslationPipeline'
import type { PipelineResult, SuggestionPair } from '../src/types'

// ── Helpers ────────────────────────────────────────────────────────────────

function makePairs(n = 3): SuggestionPair[] {
  const all: SuggestionPair[] = [
    { english: 'How much is it?',     spanish: '¿Cuánto es?' },
    { english: "That's fine",         spanish: 'Está bien' },
    { english: 'Is there a discount?', spanish: '¿Descuento?' },
  ]
  return all.slice(0, n)
}

// ── Mock dependencies ──────────────────────────────────────────────────────

function makeMockSpeech() {
  let _handler: ((text: string) => void) | undefined
  return {
    start: mock(async (_lang: string, handler: (t: string) => void) => { _handler = handler }),
    stop: mock(() => {}),
    emit: (text: string) => _handler?.(text),
  }
}

function makeMockTTS() {
  return {
    speak: mock(async (_text: string) => {}),
    stop: mock(() => {}),
    speaking: false,
  }
}

function makeMockAI(result: Partial<PipelineResult> = {}) {
  return {
    process: mock(async () => ({
      translation: result.translation ?? 'How much is it?',
      suggestions: result.suggestions ?? makePairs(),
      isOffline: result.isOffline ?? false,
      sourceUtterance: 'test',
    })),
    regenerate: mock(async () => ({
      translation: 'How much is it?',
      suggestions: makePairs(),
      isOffline: false,
      sourceUtterance: 'test',
    })),
    translateToSpanish: mock(async (english: string) => `ES:${english}`),
  }
}

function makeMockDisplay() {
  let _onSelect: ((i: number, t: string) => void) | undefined
  let _onRegen: (() => void) | undefined
  let _onType: (() => void) | undefined
  return {
    init: mock(async (
      onSelect?: (i: number, t: string) => void,
      onRegen?: () => void,
      onType?: () => void,
    ) => {
      _onSelect = onSelect
      _onRegen = onRegen
      _onType = onType
    }),
    show: mock(async () => {}),
    setIdle: mock(async () => {}),
    setStatus: mock(async () => {}),
    // Test helpers to simulate glass events
    tapSuggestion: (i: number, t = '') => _onSelect?.(i, t),
    tapRegen: () => _onRegen?.(),
    tapType: () => _onType?.(),
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('TranslationPipeline', () => {
  it('starts speech and display on start()', async () => {
    const speech  = makeMockSpeech()
    const ai      = makeMockAI()
    const display = makeMockDisplay()
    const tts     = makeMockTTS()

    const pipeline = new TranslationPipeline({}, { speech: speech as any, ai: ai as any, display: display as any, tts: tts as any })
    await pipeline.start()

    expect(speech.start).toHaveBeenCalledTimes(1)
    expect(display.init).toHaveBeenCalledTimes(1)
    expect(pipeline.isRunning).toBe(true)
  })

  it('stop() sets isRunning to false', async () => {
    const speech = makeMockSpeech()
    const ai     = makeMockAI()
    const display = makeMockDisplay()
    const tts    = makeMockTTS()

    const pipeline = new TranslationPipeline({}, { speech: speech as any, ai: ai as any, display: display as any, tts: tts as any })
    await pipeline.start()
    pipeline.stop()

    expect(pipeline.isRunning).toBe(false)
    expect(speech.stop).toHaveBeenCalledTimes(1)
  })

  it('does not double-start if already running', async () => {
    const speech  = makeMockSpeech()
    const ai      = makeMockAI()
    const display = makeMockDisplay()
    const tts     = makeMockTTS()

    const pipeline = new TranslationPipeline({}, { speech: speech as any, ai: ai as any, display: display as any, tts: tts as any })
    await pipeline.start()
    await pipeline.start()

    expect(speech.start).toHaveBeenCalledTimes(1)
  })

  it('processes speech and updates display', async () => {
    const speech  = makeMockSpeech()
    const ai      = makeMockAI({ translation: 'Can you sign here?', suggestions: makePairs() })
    const display = makeMockDisplay()
    const tts     = makeMockTTS()

    const pipeline = new TranslationPipeline({}, { speech: speech as any, ai: ai as any, display: display as any, tts: tts as any })
    await pipeline.start()

    speech.emit('¿Puede firmar aquí?')
    await new Promise((r) => setTimeout(r, 20))

    expect(ai.process).toHaveBeenCalledWith('¿Puede firmar aquí?', [])
    expect(display.show).toHaveBeenCalledTimes(1)
    const showArg = (display.show.mock.calls[0] as any[])[0] as PipelineResult
    expect(showArg.translation).toBe('Can you sign here?')
  })

  it('appends utterances to conversation history', async () => {
    const speech  = makeMockSpeech()
    const ai      = makeMockAI()
    const display = makeMockDisplay()
    const tts     = makeMockTTS()

    const pipeline = new TranslationPipeline({}, { speech: speech as any, ai: ai as any, display: display as any, tts: tts as any })
    await pipeline.start()

    speech.emit('primera frase')
    await new Promise((r) => setTimeout(r, 20))
    speech.emit('segunda frase')
    await new Promise((r) => setTimeout(r, 20))

    const history = pipeline.getHistory()
    expect(history.length).toBe(2)
    expect(history[0].originalText).toBe('primera frase')
    expect(history[1].originalText).toBe('segunda frase')
  })

  it('trims history when it exceeds maxHistoryTurns', async () => {
    const speech  = makeMockSpeech()
    const ai      = makeMockAI()
    const display = makeMockDisplay()
    const tts     = makeMockTTS()

    const pipeline = new TranslationPipeline({ maxHistoryTurns: 3 }, { speech: speech as any, ai: ai as any, display: display as any, tts: tts as any })
    await pipeline.start()

    for (let i = 0; i < 5; i++) {
      speech.emit(`frase ${i}`)
      await new Promise((r) => setTimeout(r, 10))
    }

    expect(pipeline.getHistory().length).toBeLessThanOrEqual(3)
  })

  it('passes history to AI processor on subsequent calls', async () => {
    const speech  = makeMockSpeech()
    const ai      = makeMockAI()
    const display = makeMockDisplay()
    const tts     = makeMockTTS()

    const pipeline = new TranslationPipeline({}, { speech: speech as any, ai: ai as any, display: display as any, tts: tts as any })
    await pipeline.start()

    speech.emit('primera frase')
    await new Promise((r) => setTimeout(r, 20))
    speech.emit('segunda frase')
    await new Promise((r) => setTimeout(r, 20))

    const secondCallHistory = (ai.process.mock.calls[1] as any[])[1]
    expect(secondCallHistory.length).toBe(1)
    expect(secondCallHistory[0].originalText).toBe('primera frase')
  })

  it('stores last result accessibly', async () => {
    const speech  = makeMockSpeech()
    const ai      = makeMockAI({ translation: 'Test translation', suggestions: makePairs() })
    const display = makeMockDisplay()
    const tts     = makeMockTTS()

    const pipeline = new TranslationPipeline({}, { speech: speech as any, ai: ai as any, display: display as any, tts: tts as any })
    await pipeline.start()

    speech.emit('alguna frase')
    await new Promise((r) => setTimeout(r, 20))

    expect(pipeline.getLastResult()?.translation).toBe('Test translation')
  })

  it('tapping suggestion speaks the Spanish text via TTS', async () => {
    const speech  = makeMockSpeech()
    const ai      = makeMockAI({ suggestions: makePairs() })
    const display = makeMockDisplay()
    const tts     = makeMockTTS()

    const pipeline = new TranslationPipeline({}, { speech: speech as any, ai: ai as any, display: display as any, tts: tts as any })
    await pipeline.start()

    speech.emit('¿Cuánto cuesta?')
    await new Promise((r) => setTimeout(r, 20))

    // Tap suggestion 0 — should speak the Spanish of pair 0
    display.tapSuggestion(0)
    await new Promise((r) => setTimeout(r, 20))

    expect(tts.speak).toHaveBeenCalledTimes(1)
    const spokenText = (tts.speak.mock.calls[0] as any[])[0]
    expect(spokenText).toBe('¿Cuánto es?') // pair 0's Spanish
  })

  it('tapping suggestion records English translation in history', async () => {
    const speech  = makeMockSpeech()
    const ai      = makeMockAI({ suggestions: makePairs() })
    const display = makeMockDisplay()
    const tts     = makeMockTTS()

    const pipeline = new TranslationPipeline({}, { speech: speech as any, ai: ai as any, display: display as any, tts: tts as any })
    await pipeline.start()

    speech.emit('¿Cuánto cuesta?')
    await new Promise((r) => setTimeout(r, 20))

    display.tapSuggestion(1) // "That's fine" / "Está bien"
    await new Promise((r) => setTimeout(r, 10))

    const history = pipeline.getHistory()
    const userTurn = history.find((h) => h.speakerIsUser)
    expect(userTurn?.originalText).toBe('Está bien')
    expect(userTurn?.translatedText).toBe("That's fine")
  })
})
