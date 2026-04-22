// src/App.tsx
// Phone-side companion UI shown inside Even Hub's app panel.
// The glasses lens is driven entirely by G2DisplayManager — this screen
// is just a status/control panel for the user's phone.

import React, { useEffect, useRef, useState } from 'react'
import { TranslationPipeline } from './TranslationPipeline'
import type { PipelineResult } from './types'

interface AppProps {
  pipeline: TranslationPipeline
  apiKey: string
}

type AppStatus = 'idle' | 'listening' | 'processing' | 'error'

export function App({ pipeline, apiKey }: AppProps) {
  const [status, setStatus] = useState<AppStatus>('idle')
  const [lastResult, setLastResult] = useState<PipelineResult | null>(null)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    startPipeline()
    return () => {
      pipeline.stop()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function startPipeline() {
    try {
      setStatus('listening')
      await pipeline.start()

      // Poll pipeline state every 500ms to update the companion UI
      pollRef.current = setInterval(() => {
        const result = pipeline.getLastResult()
        if (result) {
          setLastResult(result)
          setIsOfflineMode(result.isOffline)
          setStatus('listening')
        }
      }, 500)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const statusLabel: Record<AppStatus, string> = {
    idle: 'Starting…',
    listening: 'Listening',
    processing: 'Processing…',
    error: 'Error',
  }

  const statusColor: Record<AppStatus, string> = {
    idle: '#888',
    listening: '#4ade80',
    processing: '#facc15',
    error: '#f87171',
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.appName}>G2 Translator</span>
        <span style={{ ...styles.statusBadge, background: statusColor[status] }}>
          {statusLabel[status]}
        </span>
        {isOfflineMode && (
          <span style={styles.offlineBadge}>Offline</span>
        )}
      </div>

      {/* API key warning */}
      {!apiKey && (
        <div style={styles.warning}>
          No OpenAI API key — running in offline mode only.
          Set <code>VITE_OPENAI_API_KEY</code> in your <code>.env</code> file.
        </div>
      )}

      {/* Last translation */}
      {lastResult ? (
        <div style={styles.card}>
          <div style={styles.cardLabel}>They said</div>
          <div style={styles.translationText}>{lastResult.translation}</div>

          <div style={styles.cardLabel} className="mt">Your replies (shown on lens)</div>
          {lastResult.suggestions.map((s, i) => (
            <div key={i} style={styles.suggestion}>
              <span style={styles.suggestionNum}>{i + 1}</span>
              {s}
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.empty}>
          Waiting for speech…
          <br />
          <span style={styles.hint}>Speak Spanish near the mic</span>
        </div>
      )}

      {/* History count */}
      <div style={styles.footer}>
        {pipeline.getHistory().length} turns in context
      </div>

      {/* Error display */}
      {status === 'error' && errorMsg && (
        <div style={styles.errorBox}>{errorMsg}</div>
      )}
    </div>
  )
}

// ── Inline styles (no CSS framework dependency) ───────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: 420,
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minHeight: '100dvh',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  appName: {
    fontSize: 20,
    fontWeight: 700,
    flex: 1,
    letterSpacing: '-0.3px',
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 20,
    color: '#000',
  },
  offlineBadge: {
    fontSize: 12,
    fontWeight: 600,
    padding: '3px 10px',
    borderRadius: 20,
    background: '#854d0e',
    color: '#fef9c3',
  },
  warning: {
    background: '#451a03',
    border: '1px solid #92400e',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13,
    lineHeight: 1.5,
    color: '#fde68a',
  },
  card: {
    background: '#1a1a1a',
    borderRadius: 14,
    padding: '18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#666',
    marginTop: 6,
  },
  translationText: {
    fontSize: 22,
    fontWeight: 600,
    lineHeight: 1.3,
    color: '#f0f0f0',
  },
  suggestion: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#252525',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 16,
    color: '#e0e0e0',
  },
  suggestionNum: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#3b3b3b',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#999',
    flexShrink: 0,
    textAlign: 'center',
    lineHeight: '22px',
  },
  empty: {
    textAlign: 'center',
    color: '#555',
    fontSize: 17,
    padding: '60px 0',
    lineHeight: 1.8,
  },
  hint: {
    fontSize: 13,
    color: '#444',
  },
  footer: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: 12,
  },
  errorBox: {
    background: '#3f0f0f',
    border: '1px solid #7f1d1d',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13,
    color: '#fca5a5',
  },
}
