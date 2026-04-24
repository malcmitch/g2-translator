// src/types.ts
// Shared types across the translation pipeline

export interface PipelineResult {
  translation: string   // English: what they said
  suggestions: string[] // Spanish: 2-3 reply options
  isOffline: boolean
  /** Raw utterance that triggered this result — used for regeneration */
  sourceUtterance?: string
}

export interface ConversationTurn {
  speakerIsUser: boolean
  originalText: string   // Spanish — either what they said or Malcolm's chosen reply
  translatedText: string // English
}

export type NetworkStatus = 'online' | 'offline'

/** Action type emitted when a glasses list item is tapped */
export type SuggestionActionType = 'speak' | 'regenerate' | 'type_reply'
