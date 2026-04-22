// src/SpeechService.ts
// Captures audio and transcribes Spanish speech.
// Online: OpenAI Whisper API (via MediaRecorder chunks)
// Offline: Web Speech API (webkitSpeechRecognition — available in WKWebView on iOS 14.5+)

import { NetworkMonitor } from './NetworkMonitor.js'

export type TranscriptHandler = (text: string) => void

const WHISPER_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions'
const SILENCE_THRESHOLD_MS = 1500  // stop recording after 1.5s silence
const MAX_CHUNK_MS = 10_000        // max recording chunk before forced upload

export class SpeechService {
  private apiKey: string
  private network: NetworkMonitor
  private mediaRecorder?: MediaRecorder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private speechRecognition?: any  // SpeechRecognition — not in all TS DOM lib versions
  private chunks: Blob[] = []
  private silenceTimer?: ReturnType<typeof setTimeout>
  private isListening = false
  private onTranscript?: TranscriptHandler

  constructor(apiKey?: string, network?: NetworkMonitor) {
    this.apiKey = apiKey ?? (typeof process !== 'undefined' ? process.env.OPENAI_API_KEY ?? '' : '')
    this.network = network ?? NetworkMonitor.instance
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async start(language = 'es', onTranscript: TranscriptHandler): Promise<void> {
    if (this.isListening) return
    this.onTranscript = onTranscript
    this.isListening = true

    if (this.network.isOnline && this.apiKey) {
      await this.startWhisper(language)
    } else {
      this.startWebSpeech(language)
    }
  }

  stop(): void {
    this.isListening = false
    clearTimeout(this.silenceTimer)
    this.mediaRecorder?.stop()
    this.speechRecognition?.stop()
  }

  // ── Whisper (Online) ───────────────────────────────────────────────────────

  private async startWhisper(language: string): Promise<void> {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      console.warn('[SpeechService] Mic permission denied — falling back to Web Speech API')
      this.startWebSpeech(language)
      return
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    this.mediaRecorder = new MediaRecorder(stream, { mimeType })
    this.chunks = []

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
      this.resetSilenceTimer()
    }

    this.mediaRecorder.onstop = async () => {
      if (this.chunks.length === 0) return
      const blob = new Blob(this.chunks, { type: mimeType })
      this.chunks = []
      await this.uploadToWhisper(blob, language)
      // Auto-restart listening after each utterance
      if (this.isListening) await this.startWhisper(language)
    }

    this.mediaRecorder.start(250) // collect data every 250ms
    this.resetSilenceTimer()
  }

  private resetSilenceTimer(): void {
    clearTimeout(this.silenceTimer)
    this.silenceTimer = setTimeout(() => {
      this.mediaRecorder?.stop()
    }, SILENCE_THRESHOLD_MS)
  }

  private async uploadToWhisper(blob: Blob, language: string): Promise<void> {
    const form = new FormData()
    form.append('file', blob, `audio.${blob.type.includes('webm') ? 'webm' : 'mp4'}`)
    form.append('model', 'whisper-1')
    form.append('language', language)

    try {
      const res = await fetch(WHISPER_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      })
      if (!res.ok) throw new Error(`Whisper error: ${res.status}`)
      const data = (await res.json()) as { text: string }
      const text = data.text?.trim()
      if (text) this.onTranscript?.(text)
    } catch (err) {
      console.error('[SpeechService] Whisper upload failed:', err)
    }
  }

  // ── Web Speech API (Offline fallback) ─────────────────────────────────────

  private startWebSpeech(language: string): void {
    const SpeechRecognitionImpl =
      (typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) as
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        | (new () => any)
        | undefined

    if (!SpeechRecognitionImpl) {
      console.warn('[SpeechService] Web Speech API not available in this WebView')
      return
    }

    this.speechRecognition = new SpeechRecognitionImpl()
    this.speechRecognition.lang = language === 'es' ? 'es-MX' : language
    this.speechRecognition.continuous = false
    this.speechRecognition.interimResults = false

    this.speechRecognition.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript?.trim()
      if (text) this.onTranscript?.(text)
    }

    this.speechRecognition.onend = () => {
      // Auto-restart for continuous listening
      if (this.isListening) this.startWebSpeech(language)
    }

    this.speechRecognition.onerror = (e: any) => {
      console.error('[SpeechService] Web Speech error:', e.error)
      if (this.isListening) this.startWebSpeech(language)
    }

    this.speechRecognition.start()
  }
}
