// src/main.tsx
// Entry point — waits for EvenAppBridge, injects bridge into pipeline, mounts React UI.
// This runs inside Even Hub's WKWebView on iOS.

import React from 'react'
import { createRoot } from 'react-dom/client'
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { App } from './App'
import { TranslationPipeline } from './TranslationPipeline'
import { G2DisplayManager } from './G2DisplayManager'
import { NetworkMonitor } from './NetworkMonitor'

// ── Config ────────────────────────────────────────────────────────────────────
// Set VITE_OPENAI_API_KEY in .env (never commit the actual key)
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? ''

async function main() {
  // ── Mount React loading screen immediately ─────────────────────────────────
  const root = createRoot(document.getElementById('root')!)
  root.render(<LoadingScreen message="Connecting to glasses…" />)

  try {
    // ── Wait for Even Hub bridge ───────────────────────────────────────────
    // Even Hub injects the bridge into the WebView before the page loads.
    // waitForEvenAppBridge() resolves immediately if already ready,
    // or waits for the 'evenAppBridgeReady' event if not yet initialized.
    const bridge = await waitForEvenAppBridge()

    // ── Bootstrap pipeline ─────────────────────────────────────────────────
    const network = NetworkMonitor.instance
    const display = new G2DisplayManager(bridge)
    const pipeline = new TranslationPipeline(
      {
        openAiKey: OPENAI_API_KEY,
        language: 'es',
        maxHistoryTurns: 6,
      },
      { display }
    )

    // ── Mount companion UI ─────────────────────────────────────────────────
    // Pipeline is started inside App's useEffect — this keeps React
    // responsible for the lifecycle so hot-reload works in dev.
    root.render(
      <React.StrictMode>
        <App pipeline={pipeline} apiKey={OPENAI_API_KEY} />
      </React.StrictMode>
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    root.render(<LoadingScreen message={`Failed to connect: ${msg}`} isError />)
    console.error('[main] Bridge init failed:', err)
  }
}

// ── Splash / error screen (shown before React tree is ready) ─────────────────
function LoadingScreen({ message, isError = false }: { message: string; isError?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100dvh',
      gap: 16,
      padding: 24,
      textAlign: 'center',
    }}>
      {!isError && (
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '3px solid #333',
          borderTopColor: '#4ade80',
          animation: 'spin 0.8s linear infinite',
        }} />
      )}
      <p style={{
        color: isError ? '#f87171' : '#888',
        fontSize: 15,
        maxWidth: 280,
        lineHeight: 1.5,
      }}>
        {message}
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

main()
