// src/types.ts
// Shared types across the translation pipeline

export interface PipelineResult {
  translation: string   // English: what they said
  suggestions: string[] // Spanish: 2-3 reply options
  isOffline: boolean
}

export interface ConversationTurn {
  speakerIsUser: boolean
  originalText: string   // Spanish if other person, Spanish if user's chosen reply
  translatedText: string // English
}

export type NetworkStatus = 'online' | 'offline'
