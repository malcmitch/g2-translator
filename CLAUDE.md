# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

**G2 Translator** — a bidirectional Spanish ↔ English translation app for the
**Even Realities G2** smart glasses. It listens to speech, translates it, shows
the translation plus tap-able reply suggestions on the glasses' lens, and speaks
the chosen reply aloud (TTS). It degrades gracefully to offline templates when
there's no connectivity.

The app runs as a web app loaded inside **Even Hub's WKWebView on iOS**. The
phone is the companion UI; the glasses are the display + input surface.

## Tech stack

| Concern | Choice |
|---------|--------|
| Language | TypeScript (strict), ES2022, ESM (`"type": "module"`) |
| UI | React 19 (companion phone screen only) |
| Bundler / dev server | Vite 8 (`@vitejs/plugin-react`) |
| Test runner | **Bun** (`bun:test`) |
| Glasses SDK | `@evenrealities/even_hub_sdk` + `@evenrealities/evenhub-cli` |
| Online STT | OpenAI Whisper |
| Online AI | GPT-4o (translation + suggestions in one call) |
| Online TTS | OpenAI TTS |
| Offline STT | `webkitSpeechRecognition` (Web Speech API) |
| Offline AI | `TemplateSuggestionEngine` (11 hardcoded scenarios) |

## Commands

```bash
npm install          # install deps
npm run dev          # Vite dev server on http://localhost:3000 (host:true for simulator)
npm run build        # tsc --noEmit && vite build → dist/
npm test             # bun test — 42 unit tests, must stay green
npm run typecheck    # tsc --noEmit
npm run sim          # evenhub-simulator against the dev server
npm run qr           # evenhub QR to load on a physical device
```

`npm test` uses **Bun**, not Vitest/Jest — write tests against `bun:test`
(`import { describe, it, expect, mock } from 'bun:test'`). Run `npm run build`
or `npm run typecheck` before considering work done; `strict` is on.

## Configuration

- Copy `.env.example` → `.env` and set `VITE_OPENAI_API_KEY=sk-...`.
  The key is read via `import.meta.env.VITE_OPENAI_API_KEY` in `src/main.tsx`.
  **Never commit a real key.**
- `app.json` is the Even Hub package manifest (`package_id`, version, permissions,
  `entrypoint: index.html`, supported languages `en`/`es`). The `network`
  permission whitelists only `https://api.openai.com` — if you add an external
  host, update this whitelist or the call will be blocked on-device.
- `vite.config.ts` forces a single-file-friendly bundle (`manualChunks: undefined`)
  so the WebView can load it cleanly. Keep that constraint in mind before adding
  code-splitting.

## Architecture

Entry point `src/main.tsx` waits for the Even Hub bridge
(`waitForEvenAppBridge()`), constructs the pipeline + display manager, then
mounts the React companion UI. The bridge is injected by Even Hub before the page
loads; the pipeline is started inside `App`'s `useEffect` so hot-reload works.

Data flow:

```
SpeechService ──text──▶ TranslationPipeline ──▶ AIProcessor ──▶ { translation, suggestions[] }
                              │                                          │
                              ├──▶ G2DisplayManager (lens: translation + tap-able replies)
                              └──▶ TTSService (speaks the selected reply)
```

| File | Responsibility |
|------|----------------|
| `src/types.ts` | Shared interfaces — `SuggestionPair`, `PipelineResult`, `ConversationTurn`, action types. Start here to understand the data model. |
| `src/TranslationPipeline.ts` | **Main orchestrator.** Owns history, the reply flow (speak / regenerate / type-reply), and the public callback hooks (`onTypeReplyRequest`, `onSpeakingChange`). Takes injectable deps for testing. |
| `src/AIProcessor.ts` | GPT-4o call + offline fallback to the template engine. |
| `src/SpeechService.ts` | Whisper (online) + Web Speech (offline) STT. |
| `src/TTSService.ts` | Speaks selected/translated replies. |
| `src/G2DisplayManager.ts` | All SDK lens calls (`textContainerUpgrade`, `rebuildPageContainer`, tap events via `BridgeEvent.EvenHubEvent`). |
| `src/TemplateSuggestionEngine.ts` | Offline suggestion templates. |
| `src/NetworkMonitor.ts` | `navigator.onLine` online/offline detection (singleton). |
| `src/App.tsx` | React companion phone UI. |
| `src/main.tsx` | Bridge bootstrap + React mount. |

## Conventions

- **Dependency injection for testability.** `TranslationPipeline` and other
  classes accept their collaborators via an optional `deps` argument so tests
  inject mocks. Follow this pattern rather than `new`-ing collaborators inline.
- ESM imports use explicit `.js` extensions on local files (e.g.
  `from './types.js'`) — required because `moduleResolution` is `bundler`/ESM.
  Keep this when adding imports.
- Suggestions are **bilingual pairs** (`{ english, spanish }`): Malcolm reads the
  short English gloss to decide, the Spanish is what gets spoken. Keep English
  ≤ ~6 words, Spanish ≤ ~8 words.
- Every behavioral change should keep the 42 tests green and add coverage for new
  logic. Tests live in `tests/*.test.ts` mirroring `src/`.

## Git workflow

- Develop on branch **`claude/claude-md-docs-4sgny2`**; create it if missing.
- Never push directly to `main`. Push your branch, then open a **draft PR**.
- Repo: `malcmitch/g2-translator` (private).
