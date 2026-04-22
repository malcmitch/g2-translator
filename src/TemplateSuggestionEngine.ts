// src/TemplateSuggestionEngine.ts
// Offline fallback: generates contextually appropriate Spanish reply suggestions
// via keyword detection against scenario templates — no network required.

interface Scenario {
  triggers: string[]
  suggestions: [string, string, string]
}

const SCENARIOS: Scenario[] = [
  {
    triggers: ['nombre', 'cómo se llama', 'who are you', 'your name', 'llamas'],
    suggestions: ['Me llamo Malcolm', 'Soy Malcolm, mucho gusto', 'Malcolm, un placer'],
  },
  {
    triggers: ['firmar', 'firma', 'sign here', 'signature', 'documento', 'document'],
    suggestions: ['Sí, con gusto', '¿Dónde firmo?', 'Un momento, por favor'],
  },
  {
    triggers: ['precio', 'costo', 'cuánto', 'how much', 'price', 'cost', 'pagar'],
    suggestions: ['¿Cuánto es en total?', 'Está bien, acepto', '¿Hay descuento?'],
  },
  {
    triggers: ['dirección', 'address', 'dónde', 'where', 'ubicación', 'location', 'cómo llegar'],
    suggestions: ['No conozco bien la zona', '¿Puede mostrarme en el mapa?', 'Busco esta dirección'],
  },
  {
    triggers: ['gracias', 'thank', 'appreciate', 'agradezco'],
    suggestions: ['De nada', 'Con mucho gusto', 'Fue un placer'],
  },
  {
    triggers: ['ayuda', 'help', 'problema', 'problem', 'issue', 'error', 'asistencia'],
    suggestions: ['Sí, necesito ayuda', '¿Puede asistirme, por favor?', 'Hay un problema aquí'],
  },
  {
    triggers: ['cuándo', 'when', 'hora', 'time', 'horario', 'schedule', 'cita'],
    suggestions: ['¿A qué hora?', 'Mañana está bien', 'Necesito confirmarlo'],
  },
  {
    triggers: ['sí', 'yes', 'correcto', 'agree', 'entiendo', 'understand', 'exacto'],
    suggestions: ['Sí, exactamente', 'De acuerdo', 'Entendido, gracias'],
  },
  {
    triggers: ['no ', 'incorrect', 'wrong', 'error', 'equivocado'],
    suggestions: ['No, disculpe', 'Creo que hay un error', '¿Puede verificarlo?'],
  },
  {
    triggers: ['esperar', 'wait', 'momento', 'minuto', 'minute', 'segundo'],
    suggestions: ['Un momento, por favor', 'Sí, espero', '¿Cuánto tiempo?'],
  },
  {
    triggers: ['dinero', 'efectivo', 'tarjeta', 'cash', 'card', 'payment', 'pago'],
    suggestions: ['¿Acepta tarjeta?', 'Solo tengo efectivo', '¿Cuál es el total?'],
  },
  {
    triggers: ['tesla', 'carro', 'auto', 'vehículo', 'car', 'vehicle', 'entrega'],
    suggestions: ['Soy el representante', '¿Todo está listo?', 'Firmemos los documentos'],
  },
]

const DEFAULT_SUGGESTIONS: [string, string, string] = [
  'Sí, entiendo',
  '¿Puede repetir, por favor?',
  'Un momento',
]

export class TemplateSuggestionEngine {
  suggest(spanishInput: string, translatedText = ''): string[] {
    const haystack = (spanishInput + ' ' + translatedText).toLowerCase()

    for (const scenario of SCENARIOS) {
      if (scenario.triggers.some((t) => haystack.includes(t))) {
        return [...scenario.suggestions]
      }
    }

    return [...DEFAULT_SUGGESTIONS]
  }
}
