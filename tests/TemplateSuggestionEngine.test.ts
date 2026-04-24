// tests/TemplateSuggestionEngine.test.ts
import { describe, it, expect } from 'bun:test'
import { TemplateSuggestionEngine } from '../src/TemplateSuggestionEngine'
import type { SuggestionPair } from '../src/types'

const engine = new TemplateSuggestionEngine()

function spains(pairs: SuggestionPair[]): string[] {
  return pairs.map((p) => p.spanish)
}

describe('TemplateSuggestionEngine', () => {
  it('returns exactly 3 suggestion pairs for any input', () => {
    const result = engine.suggest('hola cómo estás')
    expect(result).toHaveLength(3)
    result.forEach((p) => {
      expect(typeof p.english).toBe('string')
      expect(typeof p.spanish).toBe('string')
    })
  })

  it('returns 3 pairs for empty input', () => {
    const result = engine.suggest('')
    expect(result).toHaveLength(3)
  })

  it('every pair has non-empty english and spanish', () => {
    const inputs = ['firmar', 'precio', 'dirección', 'ayuda', 'gracias', 'sí', 'tesla', '']
    for (const input of inputs) {
      engine.suggest(input).forEach((p) => {
        expect(p.english.length).toBeGreaterThan(0)
        expect(p.spanish.length).toBeGreaterThan(0)
      })
    }
  })

  it('matches "firmar" trigger → signing suggestions', () => {
    const result = engine.suggest('puede firmar aquí por favor')
    const sp = spains(result)
    expect(sp.some((s) => s.toLowerCase().includes('fir') || s.toLowerCase().includes('sí'))).toBe(true)
  })

  it('matches "precio" trigger → price suggestions', () => {
    const result = engine.suggest('cuál es el precio de esto')
    const sp = spains(result)
    expect(sp.some((s) => s.includes('total') || s.includes('acepto') || s.includes('descuento'))).toBe(true)
  })

  it('matches "gracias" trigger → polite response in Spanish', () => {
    const result = engine.suggest('muchas gracias por su ayuda')
    const sp = spains(result)
    expect(sp).toContain('De nada')
  })

  it('matches "gracias" trigger → includes English gloss', () => {
    const result = engine.suggest('muchas gracias por su ayuda')
    const en = result.map((p) => p.english)
    expect(en.some((g) => g.toLowerCase().includes('welcome') || g.toLowerCase().includes('pleasure'))).toBe(true)
  })

  it('falls back to default suggestions for unknown input', () => {
    const result = engine.suggest('xyzzy blorp florb')
    const sp = spains(result)
    expect(sp).toContain('Sí, entiendo')
    expect(sp).toContain('Un momento')
  })

  it('uses translated text as fallback for matching', () => {
    const result = engine.suggest('aquí por favor', 'sign here')
    const sp = spains(result)
    expect(sp.some((s) => s.includes('fir') || s.includes('Sí'))).toBe(true)
  })

  it('no pair has empty strings', () => {
    const result = engine.suggest('whatever random text')
    result.forEach((p) => {
      expect(p.english.length).toBeGreaterThan(0)
      expect(p.spanish.length).toBeGreaterThan(0)
    })
  })

  it('all Spanish suggestions are under 50 chars', () => {
    const inputs = ['firmar', 'precio', 'dirección', 'ayuda', 'gracias', 'sí', 'no ', 'tesla']
    for (const input of inputs) {
      engine.suggest(input).forEach((p) => {
        expect(p.spanish.length).toBeLessThanOrEqual(50)
        expect(p.english.length).toBeLessThanOrEqual(50)
      })
    }
  })

  it('matches tesla/car scenario', () => {
    const result = engine.suggest('entrega del tesla lista')
    const sp = spains(result)
    expect(sp.some((s) => s.includes('documentos') || s.includes('representante') || s.includes('listo'))).toBe(true)
  })
})
