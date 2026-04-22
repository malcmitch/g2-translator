// tests/TemplateSuggestionEngine.test.ts
import { describe, it, expect } from 'bun:test'
import { TemplateSuggestionEngine } from '../src/TemplateSuggestionEngine'

const engine = new TemplateSuggestionEngine()

describe('TemplateSuggestionEngine', () => {
  it('returns exactly 3 suggestions for any input', () => {
    const result = engine.suggest('hola cómo estás')
    expect(result).toHaveLength(3)
    result.forEach((s) => expect(typeof s).toBe('string'))
  })

  it('returns 3 suggestions for empty input', () => {
    const result = engine.suggest('')
    expect(result).toHaveLength(3)
  })

  it('matches "firmar" trigger → signing suggestions', () => {
    const result = engine.suggest('puede firmar aquí por favor')
    expect(result.some((s) => s.toLowerCase().includes('fir') || s.toLowerCase().includes('sí'))).toBe(true)
  })

  it('matches "precio" trigger → price suggestions', () => {
    const result = engine.suggest('cuál es el precio de esto')
    expect(result.some((s) => s.includes('¿Cuánto') || s.includes('acepto') || s.includes('descuento'))).toBe(true)
  })

  it('matches "gracias" trigger → polite response suggestions', () => {
    const result = engine.suggest('muchas gracias por su ayuda')
    expect(result).toContain('De nada')
  })

  it('falls back to default suggestions for unknown input', () => {
    const result = engine.suggest('xyzzy blorp florb')
    expect(result).toContain('Sí, entiendo')
    expect(result).toContain('Un momento')
  })

  it('uses translated text as fallback for matching', () => {
    // "sign here" in translation should match the signing scenario
    const result = engine.suggest('aquí por favor', 'sign here')
    expect(result.some((s) => s.includes('fir') || s.includes('Sí'))).toBe(true)
  })

  it('does not include empty strings in suggestions', () => {
    const result = engine.suggest('whatever random text')
    result.forEach((s) => expect(s.length).toBeGreaterThan(0))
  })

  it('all suggestions are under 50 chars', () => {
    const inputs = ['firmar', 'precio', 'dirección', 'ayuda', 'gracias', 'sí', 'no ', 'tesla']
    for (const input of inputs) {
      const result = engine.suggest(input)
      result.forEach((s) => {
        expect(s.length).toBeLessThanOrEqual(50)
      })
    }
  })

  it('matches tesla/car scenario', () => {
    const result = engine.suggest('entrega del tesla lista')
    expect(result.some((s) => s.includes('documentos') || s.includes('representante') || s.includes('listo'))).toBe(true)
  })
})
