# G2 Translator

Bidirectional Spanish ↔ English translation app for the **Even Realities G2** smart glasses.

Displays real-time translation + 3 proactive Spanish reply suggestions on the lens.  
Falls back to offline templates when there's no connectivity.

## Quick Start

```bash
# 1. Install deps
npm install

# 2. Add your OpenAI key
cp .env.example .env
# Edit .env and set VITE_OPENAI_API_KEY=sk-...

# 3. Run dev server
npm run dev
# → opens on http://localhost:3000

# 4. In Even Hub on your iPhone:
#    Developer Settings → WebView URL → http://<your-mac-ip>:3000
```

## How it works

1. **Listen** — mic captures Spanish speech (Whisper API online / Web Speech API offline)  
2. **Translate** — GPT-4o returns `{ translation, suggestions[] }` in one call  
3. **Display on lens** — `textContainerUpgrade` shows translation; `rebuildPageContainer` shows 3 tap-able reply options  
4. **Tap to select** — `BridgeEvent.EvenHubEvent` fires when you tap a suggestion  

## Tech Stack

| Layer | Online | Offline |
|-------|--------|---------|
| STT | OpenAI Whisper | `webkitSpeechRecognition` |
| AI | GPT-4o | Template engine (11 scenarios) |
| Network | `navigator.onLine` | same |

## Project Structure

```
src/
  types.ts                  — shared interfaces
  TemplateSuggestionEngine.ts — offline suggestion templates
  NetworkMonitor.ts          — online/offline detection
  AIProcessor.ts             — GPT-4o + offline fallback
  G2DisplayManager.ts        — SDK lens display calls
  SpeechService.ts           — Whisper + Web Speech
  TranslationPipeline.ts     — main orchestrator
  App.tsx                    — phone companion UI
  main.tsx                   — entry point (waitForEvenAppBridge)
tests/                       — 42 tests, 100% passing
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # type-check + Vite bundle → dist/
npm test           # run 42 unit tests (Bun)
npm run typecheck  # tsc --noEmit
```

## Phase 2 (coming)

- TTS playback of selected suggestion  
- "Speak mode" — you speak English, translated Spanish plays out loud  
- Full offline translation via native WKWebView bridge injection  
