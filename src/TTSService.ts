// src/TTSService.ts
// Speaks selected Spanish reply via OpenAI TTS API.
// Single-instance — calling speak() while audio is playing cancels the current audio first.
//
// Swap TTS provider (e.g. Grok Voice) by replacing the speak() body;
// the rest of the pipeline is provider-agnostic.

const TTS_ENDPOINT = 'https://api.openai.com/v1/audio/speech'
export type TTSVoice = 'alloy' | 'nova' | 'shimmer' | 'onyx' | 'fable' | 'echo'

export class TTSService {
  private apiKey: string
  private currentAudio: HTMLAudioElement | null = null
  private _speaking = false

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  get speaking(): boolean {
    return this._speaking
  }

  /**
   * Fetch and play speech audio for the given text.
   * Cancels any currently playing audio before starting.
   * Resolves when playback finishes; rejects on API or playback error.
   *
   * @param text    The Spanish text to speak
   * @param voice   TTS voice (default: 'nova' — warm, natural female)
   */
  async speak(text: string, voice: TTSVoice = 'nova'): Promise<void> {
    this.stop()

    const response = await fetch(TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice,
      }),
    })

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.status}`)
    }

    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    this.currentAudio = audio
    this._speaking = true

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        this._speaking = false
        URL.revokeObjectURL(url)
        resolve()
      }
      audio.onerror = () => {
        this._speaking = false
        URL.revokeObjectURL(url)
        reject(new Error('Audio playback error'))
      }
      audio.play().catch((err: unknown) => {
        this._speaking = false
        reject(err)
      })
    })
  }

  /** Cancel any in-progress audio immediately. */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ''
      this.currentAudio = null
    }
    this._speaking = false
  }
}
