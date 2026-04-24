// src/types.ts
// Shared types across the translation pipeline

/**
 * A bilingual suggestion pair.
 * Both sides shown on the G2 lens: Malcolm reads the English to decide,
 * then the Spanish is spoken (or he reads it aloud) when selected.
 */
export interface SuggestionPair {
  english: string  // Short English gloss — "Sure, one moment" (max ~6 words)
  spanish: string  // Spoken/displayed Spanish reply (max ~8 words)
}

export interface PipelineResult {
  translation: string           // English: what they said
  suggestions: SuggestionPair[] // Bilingual reply options
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
