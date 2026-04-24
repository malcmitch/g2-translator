// src/App.tsx
// Phone-side companion UI shown inside Even Hub's app panel.
// The G2 lens is driven entirely by G2DisplayManager — this screen
// shows status, what was spoken, and the type-reply fallback input.

import React, { useEffect, useRef, useState } from 'react'
import { TranslationPipeline } from './TranslationPipeline'
import type { PipelineResult } from './types'

interface AppProps {
  pipeline: TranslationPipeline
  apiKey: string
}

type AppStatus = 'idle' | 'listening' | 'processing' | 'error'

export function App({ pipeline, apiKey }: AppProps) {
  const [status, setStatus]                 = useState<AppStatus>('idle')
  const [lastResult, setLastResult]         = useState<PipelineResult | null>(null)
  const [isOfflineMode, setIsOfflineMode]   = useState(false)
  const [errorMsg, setErrorMsg]             = useState<string | null>(null)
  const [speakingText, setSpeakingText]     = useState<string | null>(null)
  const [typeReplyActive, setTypeReplyActive] = useState(false)
  const [typedText, setTypedText]           = useState('')
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef  = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    // Wire pipeline callbacks before starting
    pipeline.onTypeReplyRequest = () => {
      setTypeReplyActive(true)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    pipeline.onSpeakingChange = (speaking, text) => {
      setSpeakingText(speaking ? (text ?? '…') : null)
    }

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

      pollRef.current = setInterval(() => {
        const result = pipeline.getLastResult()
        if (result) {
          setLastResult(result)
          setIsOfflineMode(result.isOffline)
          setStatus(pipeline.isSpeaking() ? 'processing' : 'listening')
        }
      }, 500)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  async function handleTypedSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!typedText.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      await pipeline.submitTypedReply(typedText.trim())
      setTypedText('')
      setTypeReplyActive(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const statusLabel: Record<AppStatus, string> = {
    idle:       'Starting…',
    listening:  'Listening',
    processing: 'Speaking…',
    error:      'Error',
  }

  const statusColor: Record<AppStatus, string> = {
    idle:       '#888',
    listening:  '#4ade80',
    processing: '#60a5fa',
    error:      '#f87171',
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.appName}>G2 Translator</span>
        <span style={{ ...styles.statusBadge, background: statusColor[status] }}>
          {statusLabel[status]}
        </span>
        {isOfflineMode && <span style={styles.offlineBadge}>Offline</span>}
      </div>

      {/* No API key warning */}
      {!apiKey && (
        <div style={styles.warning}>
          No OpenAI API key — running in offline mode only.
          Set <code>VITE_OPENAI_API_KEY</code> in your <code>.env</code> file.
        </div>
      )}

      {/* Speaking indicator */}
      {speakingText && (
        <div style={styles.speakingBanner}>
          <span style={styles.speakingIcon}>🔊</span>
          <span style={styles.speakingText}>{speakingText}</span>
        </div>
      )}

      {/* Main translation card */}
      {lastResult ? (
        <div style={styles.card}>
          <div style={styles.cardLabel}>They said</div>
          <div style={styles.translationText}>{lastResult.translation}</div>

          <div style={{ ...styles.cardLabel, marginTop: 8 }}>
            Suggestions on lens
          </div>
          {lastResult.suggestions.map((pair, i) => (
            <div key={i} style={styles.suggestion}>
              <span style={styles.suggestionNum}>{i + 1}</span>
              <span style={styles.suggestionTexts}>
                <span style={styles.suggestionEnglish}>{pair.english}</span>
                <span style={styles.suggestionSpanish}>{pair.spanish}</span>
              </span>
              <span style={styles.suggestionHint}>tap → speak</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.empty}>
          Waiting for speech…
          <br />
          <span style={styles.hint}>Point the G2 mic toward the speaker</span>
        </div>
      )}

      {/* Type reply panel */}
      <div style={{ ...styles.typePanel, ...(typeReplyActive ? styles.typePanelActive : {}) }}>
        <div style={styles.typePanelHeader}>
          <span style={styles.typePanelTitle}>Type your reply</span>
          <button
            style={styles.closeBtn}
            onClick={() => { setTypeReplyActive(false); setTypedText('') }}
          >
            ✕
          </button>
        </div>
        <div style={styles.typePanelHint}>
          Type in English — the app translates to Spanish and speaks it.
        </div>
        <form onSubmit={handleTypedSubmit} style={styles.typeForm}>
          <input
            ref={inputRef}
            style={styles.typeInput}
            type="text"
            placeholder="e.g. Let me check with my team"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            disabled={isSubmitting}
          />
          <button
            type="submit"
            style={{
              ...styles.speakBtn,
              opacity: (!typedText.trim() || isSubmitting) ? 0.4 : 1,
            }}
            disabled={!typedText.trim() || isSubmitting}
          >
            {isSubmitting ? '…' : '🔊 Speak'}
          </button>
        </form>
      </div>

      {/* Quick-open type reply button (always visible) */}
      {!typeReplyActive && (
        <button
          style={styles.typeReplyFab}
          onClick={() => {
            setTypeReplyActive(true)
            setTimeout(() => inputRef.current?.focus(), 100)
          }}
        >
          ✏️ Type reply
        </button>
      )}

      {/* Footer */}
      <div style={styles.footer}>
        {pipeline.getHistory().length} turns in context
      </div>

      {/* Error */}
      {status === 'error' && errorMsg && (
        <div style={styles.errorBox}>{errorMsg}</div>
      )}
    </div>
  )
}

// ── Inline styles ─────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: 420,
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    minHeight: '100dvh',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
    color: '#e0e0e0',
    background: '#111',
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
    transition: 'background 0.3s',
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
  speakingBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#1e3a5f',
    border: '1px solid #2563eb',
    borderRadius: 12,
    padding: '12px 14px',
    animation: 'pulse 1.5s infinite',
  },
  speakingIcon: {
    fontSize: 20,
    flexShrink: 0,
  },
  speakingText: {
    fontSize: 16,
    fontWeight: 600,
    color: '#93c5fd',
    lineHeight: 1.3,
  },
  card: {
    background: '#1a1a1a',
    borderRadius: 14,
    padding: '18px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: '#666',
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
    fontSize: 15,
    color: '#e0e0e0',
  },
  suggestionTexts: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
  },
  suggestionEnglish: {
    fontSize: 14,
    color: '#e0e0e0',
    fontWeight: 500,
  },
  suggestionSpanish: {
    fontSize: 12,
    color: '#666',
  },
  suggestionNum: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#3b3b3b',
    fontSize: 12,
    fontWeight: 700,
    color: '#999',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionHint: {
    marginLeft: 'auto',
    fontSize: 11,
    color: '#444',
    flexShrink: 0,
  },
  empty: {
    textAlign: 'center' as const,
    color: '#555',
    fontSize: 17,
    padding: '60px 0',
    lineHeight: 1.8,
  },
  hint: {
    fontSize: 13,
    color: '#444',
  },
  typePanel: {
    background: '#1a1a1a',
    borderRadius: 14,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    maxHeight: 0,
    overflow: 'hidden',
    transition: 'max-height 0.3s ease, padding 0.3s ease',
    paddingTop: 0,
    paddingBottom: 0,
  },
  typePanelActive: {
    maxHeight: 200,
    paddingTop: 16,
    paddingBottom: 16,
  },
  typePanelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  typePanelTitle: {
    fontWeight: 600,
    fontSize: 15,
    color: '#e0e0e0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    cursor: 'pointer',
    fontSize: 16,
    padding: '2px 6px',
  },
  typePanelHint: {
    fontSize: 12,
    color: '#555',
    lineHeight: 1.4,
  },
  typeForm: {
    display: 'flex',
    gap: 8,
  },
  typeInput: {
    flex: 1,
    background: '#252525',
    border: '1px solid #333',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 15,
    color: '#e0e0e0',
    outline: 'none',
  },
  speakBtn: {
    background: '#2563eb',
    border: 'none',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'opacity 0.2s',
  },
  typeReplyFab: {
    background: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 12,
    padding: '12px 18px',
    fontSize: 15,
    color: '#aaa',
    cursor: 'pointer',
    textAlign: 'center' as const,
    width: '100%',
  },
  footer: {
    fontSize: 12,
    color: '#444',
    textAlign: 'center' as const,
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
