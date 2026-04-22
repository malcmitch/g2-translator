// tests/G2DisplayManager.test.ts
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { G2DisplayManager, truncate, padTo3 } from '../src/G2DisplayManager'

// ── Utility functions (pure, no SDK dependency) ────────────────────────────

describe('truncate()', () => {
  it('returns string unchanged if within limit', () => {
    expect(truncate('Hello', 10)).toBe('Hello')
    expect(truncate('Hello', 5)).toBe('Hello')
  })

  it('truncates and appends ellipsis when over limit', () => {
    const result = truncate('Hello World', 8)
    expect(result).toHaveLength(8)
    expect(result.endsWith('…')).toBe(true)
  })

  it('handles exact boundary', () => {
    expect(truncate('12345', 5)).toBe('12345')
    expect(truncate('123456', 5)).toHaveLength(5)
  })
})

describe('padTo3()', () => {
  it('pads empty array to 3 empty strings', () => {
    expect(padTo3([])).toEqual(['', '', ''])
  })

  it('pads 1-item array', () => {
    expect(padTo3(['a'])).toEqual(['a', '', ''])
  })

  it('pads 2-item array', () => {
    expect(padTo3(['a', 'b'])).toEqual(['a', 'b', ''])
  })

  it('returns exactly 3 items for 3-item array', () => {
    expect(padTo3(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('truncates at 3 for oversized arrays', () => {
    expect(padTo3(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c'])
  })
})

// ── G2DisplayManager with mocked bridge ───────────────────────────────────

function makeMockBridge() {
  return {
    createStartUpPageContainer: mock(async () => 0),  // StartUpPageCreateResult.success = 0
    textContainerUpgrade: mock(async () => true),
    rebuildPageContainer: mock(async () => true),
  }
}

describe('G2DisplayManager', () => {
  it('calls createStartUpPageContainer on init()', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()
    expect(bridge.createStartUpPageContainer).toHaveBeenCalledTimes(1)
  })

  it('show() calls textContainerUpgrade for translation', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()

    await dm.show({
      translation: 'Can you sign here?',
      suggestions: ['Sí, claro', '¿Dónde firmo?', 'Un momento'],
      isOffline: false,
    })

    expect(bridge.textContainerUpgrade).toHaveBeenCalled()
    const upgradeCall = (bridge.textContainerUpgrade.mock.calls as any[][])[0]?.[0] as any
    expect(upgradeCall.content).toContain('Can you sign here')
  })

  it('show() calls rebuildPageContainer for suggestions list', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()

    await dm.show({
      translation: 'How are you?',
      suggestions: ['Bien, gracias', 'Muy bien', 'Regular'],
      isOffline: false,
    })

    expect(bridge.rebuildPageContainer).toHaveBeenCalledTimes(1)
    const rebuild = (bridge.rebuildPageContainer.mock.calls as any[][])[0]?.[0] as any
    expect(rebuild.listObject?.[0]?.itemContainer?.itemName).toContain('1  Bien, gracias')
  })

  it('appends " · offline" badge when result.isOffline is true', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()

    await dm.show({
      translation: 'What is the price?',
      suggestions: ['¿Cuánto es?', 'Está bien', '¿Descuento?'],
      isOffline: true,
    })

    const upgradeCall = (bridge.textContainerUpgrade.mock.calls as any[][])[0]?.[0] as any
    expect(upgradeCall.content).toContain('· offline')
  })

  it('setIdle() updates translation container with idle message', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()
    await dm.setIdle('Ready…')

    const call = (bridge.textContainerUpgrade.mock.calls as any[][])[0]?.[0] as any
    expect(call.content).toBe('Ready…')
  })

  it('auto-inits on first show() call if not yet initialized', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)

    await dm.show({
      translation: 'Hello',
      suggestions: ['Hola', 'Buenos días', 'Qué tal'],
      isOffline: false,
    })

    expect(bridge.createStartUpPageContainer).toHaveBeenCalledTimes(1)
  })

  it('suggestion item names include numbering prefix', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()

    await dm.show({
      translation: 'Where is the office?',
      suggestions: ['No sé', 'Busco la dirección', 'Muéstrame el mapa'],
      isOffline: false,
    })

    const rebuild = (bridge.rebuildPageContainer.mock.calls as any[][])[0]?.[0] as any
    const names = rebuild.listObject?.[0]?.itemContainer?.itemName
    expect(names[0]).toMatch(/^1\s+/)
    expect(names[1]).toMatch(/^2\s+/)
    expect(names[2]).toMatch(/^3\s+/)
  })
})
