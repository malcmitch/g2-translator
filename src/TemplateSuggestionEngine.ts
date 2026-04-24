// src/TemplateSuggestionEngine.ts
// Offline fallback: generates bilingual (English + Spanish) reply suggestions
// via keyword detection against scenario templates — no network required.
// English gloss lets Malcolm know what each suggestion means before choosing.

import type { SuggestionPair } from './types.js'

interface Scenario {
  triggers: string[]
  suggestions: [SuggestionPair, SuggestionPair, SuggestionPair]
}

const SCENARIOS: Scenario[] = [
  {
    triggers: ['nombre', 'cómo se llama', 'who are you', 'your name', 'llamas'],
    suggestions: [
      { english: "I'm Malcolm",               spanish: 'Me llamo Malcolm' },
      { english: 'Nice to meet you',           spanish: 'Soy Malcolm, mucho gusto' },
      { english: 'Malcolm, a pleasure',        spanish: 'Malcolm, un placer' },
    ],
  },
  {
    triggers: ['firmar', 'firma', 'sign here', 'signature', 'documento', 'document'],
    suggestions: [
      { english: 'Yes, of course',             spanish: 'Sí, con gusto' },
      { english: 'Where do I sign?',           spanish: '¿Dónde firmo?' },
      { english: 'One moment please',          spanish: 'Un momento, por favor' },
    ],
  },
  {
    triggers: ['precio', 'costo', 'cuánto', 'how much', 'price', 'cost', 'pagar'],
    suggestions: [
      { english: "What's the total?",          spanish: '¿Cuánto es en total?' },
      { english: "That's fine, I accept",      spanish: 'Está bien, acepto' },
      { english: 'Is there a discount?',       spanish: '¿Hay descuento?' },
    ],
  },
  {
    triggers: ['dirección', 'address', 'dónde', 'where', 'ubicación', 'location', 'cómo llegar'],
    suggestions: [
      { english: "I don't know the area",      spanish: 'No conozco bien la zona' },
      { english: 'Can you show me on a map?',  spanish: '¿Puede mostrarme en el mapa?' },
      { english: "I'm looking for this address", spanish: 'Busco esta dirección' },
    ],
  },
  {
    triggers: ['gracias', 'thank', 'appreciate', 'agradezco'],
    suggestions: [
      { english: "You're welcome",             spanish: 'De nada' },
      { english: 'My pleasure',               spanish: 'Con mucho gusto' },
      { english: 'It was a pleasure',          spanish: 'Fue un placer' },
    ],
  },
  {
    triggers: ['ayuda', 'help', 'problema', 'problem', 'issue', 'error', 'asistencia'],
    suggestions: [
      { english: 'Yes, I need help',           spanish: 'Sí, necesito ayuda' },
      { english: 'Can you assist me?',         spanish: '¿Puede asistirme, por favor?' },
      { english: "There's a problem here",     spanish: 'Hay un problema aquí' },
    ],
  },
  {
    triggers: ['cuándo', 'when', 'hora', 'time', 'horario', 'schedule', 'cita'],
    suggestions: [
      { english: 'What time?',                 spanish: '¿A qué hora?' },
      { english: 'Tomorrow is fine',           spanish: 'Mañana está bien' },
      { english: 'I need to confirm it',       spanish: 'Necesito confirmarlo' },
    ],
  },
  {
    triggers: ['sí', 'yes', 'correcto', 'agree', 'entiendo', 'understand', 'exacto'],
    suggestions: [
      { english: 'Yes, exactly',               spanish: 'Sí, exactamente' },
      { english: 'Agreed',                     spanish: 'De acuerdo' },
      { english: 'Understood, thank you',      spanish: 'Entendido, gracias' },
    ],
  },
  {
    triggers: ['no ', 'incorrect', 'wrong', 'equivocado'],
    suggestions: [
      { english: "No, I'm sorry",              spanish: 'No, disculpe' },
      { english: 'I think there is an error',  spanish: 'Creo que hay un error' },
      { english: 'Can you verify that?',       spanish: '¿Puede verificarlo?' },
    ],
  },
  {
    triggers: ['esperar', 'wait', 'momento', 'minuto', 'minute', 'segundo'],
    suggestions: [
      { english: 'One moment please',          spanish: 'Un momento, por favor' },
      { english: 'Yes, I will wait',           spanish: 'Sí, espero' },
      { english: 'How long?',                  spanish: '¿Cuánto tiempo?' },
    ],
  },
  {
    triggers: ['dinero', 'efectivo', 'tarjeta', 'cash', 'card', 'payment', 'pago'],
    suggestions: [
      { english: 'Do you accept card?',        spanish: '¿Acepta tarjeta?' },
      { english: 'I only have cash',           spanish: 'Solo tengo efectivo' },
      { english: "What's the total?",          spanish: '¿Cuál es el total?' },
    ],
  },
  {
    triggers: ['tesla', 'carro', 'auto', 'vehículo', 'car', 'vehicle', 'entrega'],
    suggestions: [
      { english: "I'm the representative",     spanish: 'Soy el representante' },
      { english: 'Is everything ready?',       spanish: '¿Todo está listo?' },
      { english: "Let's sign the documents",   spanish: 'Firmemos los documentos' },
    ],
  },
]

const DEFAULT_SUGGESTIONS: [SuggestionPair, SuggestionPair, SuggestionPair] = [
  { english: 'Yes, I understand',              spanish: 'Sí, entiendo' },
  { english: 'Can you repeat that?',           spanish: '¿Puede repetir, por favor?' },
  { english: 'One moment',                     spanish: 'Un momento' },
]

export class TemplateSuggestionEngine {
  suggest(spanishInput: string, translatedText = ''): SuggestionPair[] {
    const haystack = (spanishInput + ' ' + translatedText).toLowerCase()

    for (const scenario of SCENARIOS) {
      if (scenario.triggers.some((t) => haystack.includes(t))) {
        return [...scenario.suggestions]
      }
    }

    return [...DEFAULT_SUGGESTIONS]
  }
}
