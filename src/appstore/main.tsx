// src/appstore/main.tsx
// Entry point for the Even Hub App Store browser.
// Waits for EvenAppBridge, initialises the lens manager, then mounts React.

import React from 'react'
import { createRoot } from 'react-dom/client'
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'
import { AppStoreLensManager } from './AppStoreLensManager'
import { AppStoreApp } from './AppStoreApp'

async function main() {
  const root = createRoot(document.getElementById('root')!)
  root.render(<Splash message="Connecting to glasses…" />)

  try {
    const bridge = await waitForEvenAppBridge()
    const lens   = new AppStoreLensManager(bridge)
    await lens.init()

    root.render(
      <React.StrictMode>
        <AppStoreApp lens={lens} />
      </React.StrictMode>
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    root.render(<Splash message={`Failed to connect: ${msg}`} isError />)
    console.error('[appstore/main] Bridge init failed:', err)
  }
}

function Splash({ message, isError = false }: { message: string; isError?: boolean }) {
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
      background: '#0a0a0a',
      color: isError ? '#f87171' : '#888',
    }}>
      {!isError && (
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '3px solid #1e1e1e',
          borderTopColor: '#2563eb',
          animation: 'spin 0.8s linear infinite',
        }} />
      )}
      <p style={{ fontSize: 15, maxWidth: 280, lineHeight: 1.5 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

main()
