// tests/G2DisplayManager.test.ts
import { describe, it, expect, mock } from 'bun:test'
import { G2DisplayManager, truncate, padTo3 } from '../src/G2DisplayManager'
import type { SuggestionPair } from '../src/types'

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
    createStartUpPageContainer: mock(async () => 0),
    textContainerUpgrade: mock(async () => true),
    rebuildPageContainer: mock(async () => true),
  }
}

function makePairs(n = 3): SuggestionPair[] {
  const items: SuggestionPair[] = [
    { english: 'Yes of course',          spanish: 'Sí, con gusto' },
    { english: 'Where do I sign?',       spanish: '¿Dónde firmo?' },
    { english: 'One moment please',      spanish: 'Un momento, por favor' },
  ]
  return items.slice(0, n)
}

function getListItems(bridge: ReturnType<typeof makeMockBridge>): string[] {
  const rebuild = (bridge.rebuildPageContainer.mock.calls as any[][])[0]?.[0] as any
  return rebuild?.listObject?.[0]?.itemContainer?.itemName ?? []
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

    await dm.show({ translation: 'Can you sign here?', suggestions: makePairs(), isOffline: false })

    expect(bridge.textContainerUpgrade).toHaveBeenCalled()
    const upgradeCall = (bridge.textContainerUpgrade.mock.calls as any[][])[0]?.[0] as any
    expect(upgradeCall.content).toContain('Can you sign here')
  })

  it('show() calls rebuildPageContainer for suggestions list', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()

    await dm.show({ translation: 'How are you?', suggestions: makePairs(), isOffline: false })

    expect(bridge.rebuildPageContainer).toHaveBeenCalledTimes(1)
  })

  it('appends " · offline" badge when result.isOffline is true', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()

    await dm.show({ translation: 'What is the price?', suggestions: makePairs(), isOffline: true })

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

    await dm.show({ translation: 'Hello', suggestions: makePairs(), isOffline: false })

    expect(bridge.createStartUpPageContainer).toHaveBeenCalledTimes(1)
  })

  // ── Bilingual interleaved layout ────────────────────────────────────────

  it('English label appears before each numbered Spanish line', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()

    await dm.show({ translation: 'Sign here', suggestions: makePairs(), isOffline: false })

    const names = getListItems(bridge)
    // index 0: English label for suggestion 0
    expect(names[0]).toMatch(/Yes of course/)
    // index 1: Spanish numbered for suggestion 0
    expect(names[1]).toMatch(/^1\s+Sí, con gusto/)
    // index 2: English label for suggestion 1
    expect(names[2]).toMatch(/Where do I sign\?/)
    // index 3: Spanish numbered for suggestion 1
    expect(names[3]).toMatch(/^2\s+¿Dónde firmo\?/)
  })

  it('action items are always last two entries', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()

    await dm.show({ translation: 'Hello', suggestions: makePairs(3), isOffline: false })

    const names = getListItems(bridge)
    // 3 pairs × 2 = 6 items, then 2 action items = 8 total
    expect(names).toHaveLength(8)
    expect(names[6]).toBe('↻  More options')
    expect(names[7]).toBe('✏  Type reply')
  })

  it('works with 1 suggestion pair — 4 total items', async () => {
    const bridge = makeMockBridge()
    const dm = new G2DisplayManager(bridge as any)
    await dm.init()

    await dm.show({ translation: 'Hello', suggestions: makePairs(1), isOffline: false })

    const names = getListItems(bridge)
    expect(names).toHaveLength(4) // 1 pair × 2 + 2 action items
  })

  // ── Tap routing ────────────────────────────────────────────────────────

  it('tapping Spanish item (odd index) fires onSuggestionSelect with correct pair index', async () => {
    // This test simulates the routeTap logic directly via a real G2DisplayManager
    // instance with a mock select handler — no DOM event needed.
    const bridge = makeMockBridge()
    const selected: number[] = []
    const dm = new G2DisplayManager(bridge as any)
    await dm.init(
      (index, _text) => selected.push(index),
      () => {},
      () => {},
    )

    // Load suggestions so currentPairCount is set
    await dm.show({ translation: 'Test', suggestions: makePairs(3), isOffline: false })

    // Simulate internal routing: tapping index 1 (Spanish of pair 0) should yield pair 0
    // tapping index 2 (English of pair 1) should yield pair 1
    // tapping index 3 (Spanish of pair 1) should yield pair 1
    ;(dm as any).routeTap(1, 'Sí, con gusto')
    ;(dm as any).routeTap(2, '  Where do I sign?')
    ;(dm as any).routeTap(3, '¿Dónde firmo?')

    expect(selected).toEqual([0, 1, 1])
  })

  it('tapping regen item fires onRegenerateRequest', async () => {
    const bridge = makeMockBridge()
    let regenerated = false
    const dm = new G2DisplayManager(bridge as any)
    await dm.init(undefined, () => { regenerated = true }, undefined)
    await dm.show({ translation: 'T', suggestions: makePairs(3), isOffline: false })

    // regen is at index 6 (3 pairs × 2)
    ;(dm as any).routeTap(6, '↻  More options')
    expect(regenerated).toBe(true)
  })

  it('tapping type-reply item fires onTypeReplyRequest', async () => {
    const bridge = makeMockBridge()
    let typeRequested = false
    const dm = new G2DisplayManager(bridge as any)
    await dm.init(undefined, undefined, () => { typeRequested = true })
    await dm.show({ translation: 'T', suggestions: makePairs(3), isOffline: false })

    // type reply is at index 7 (3 pairs × 2 + 1)
    ;(dm as any).routeTap(7, '✏  Type reply')
    expect(typeRequested).toBe(true)
  })
})
