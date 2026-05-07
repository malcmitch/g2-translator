// src/appstore/catalog.ts
// Static Even Hub App Store catalog — replace with a real API call when available.

export interface StoreApp {
  id: string
  name: string         // ≤20 chars for clean lens display
  developer: string
  category: string     // category id
  rating: number       // 0–5, one decimal place
  reviewCount: number
  description: string  // shown on the detail screen
  version: string
  installed: boolean
  icon: string         // emoji rendered black via CSS filter on the card grid
}

export interface StoreCategory {
  id: string
  name: string   // ≤15 chars
  icon: string   // single emoji
}

export const CATEGORIES: StoreCategory[] = [
  { id: 'productivity',   name: 'Productivity',   icon: '📋' },
  { id: 'navigation',     name: 'Navigation',      icon: '🗺' },
  { id: 'health',         name: 'Health',          icon: '❤' },
  { id: 'communication',  name: 'Communication',   icon: '💬' },
  { id: 'entertainment',  name: 'Entertainment',   icon: '🎵' },
  { id: 'utilities',      name: 'Utilities',       icon: '🔧' },
]

export const APPS: StoreApp[] = [
  // ── Productivity ──────────────────────────────────────────────────────────
  {
    id: 'notes-plus',
    name: 'Notes+',
    developer: 'EvenLabs',
    category: 'productivity',
    rating: 4.8, reviewCount: 2341,
    description: 'Voice-to-text notes that sync to your phone instantly.',
    version: '1.2.0', installed: false, icon: '✏️',
  },
  {
    id: 'tasks-manager',
    name: 'Tasks Manager',
    developer: 'Orbit Apps',
    category: 'productivity',
    rating: 4.6, reviewCount: 1205,
    description: 'Manage to-do lists hands-free while on the go.',
    version: '2.0.1', installed: false, icon: '✅',
  },
  {
    id: 'timer-pro',
    name: 'Timer Pro',
    developer: 'ClockWorks',
    category: 'productivity',
    rating: 4.7, reviewCount: 987,
    description: 'Multi-timer with AR overlays for cooking and workouts.',
    version: '1.5.3', installed: true, icon: '⏱️',
  },
  {
    id: 'focus-mode',
    name: 'Focus Mode',
    developer: 'MindSpace',
    category: 'productivity',
    rating: 4.5, reviewCount: 763,
    description: 'Pomodoro timer with distraction blocking and daily stats.',
    version: '1.1.0', installed: false, icon: '🎯',
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Notes',
    developer: 'EvenLabs',
    category: 'productivity',
    rating: 4.4, reviewCount: 521,
    description: 'Auto-transcribes and summarises meetings in real time.',
    version: '0.9.2', installed: false, icon: '🎙️',
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  {
    id: 'maps-nav',
    name: 'Maps Navigator',
    developer: 'WayfindAR',
    category: 'navigation',
    rating: 4.9, reviewCount: 5678,
    description: 'Real-time AR navigation with turn-by-turn directions.',
    version: '3.1.0', installed: true, icon: '↗️',
  },
  {
    id: 'compass-pro',
    name: 'Compass Pro',
    developer: 'TrueNorth',
    category: 'navigation',
    rating: 4.6, reviewCount: 1432,
    description: 'Precision compass with declination correction and waypoints.',
    version: '1.3.1', installed: false, icon: '🧭',
  },
  {
    id: 'transit-guide',
    name: 'Transit Guide',
    developer: 'CityMove',
    category: 'navigation',
    rating: 4.7, reviewCount: 2109,
    description: 'Real-time bus, train and metro schedules at a glance.',
    version: '2.2.0', installed: false, icon: '🚌',
  },
  {
    id: 'nearby-places',
    name: 'Nearby Places',
    developer: 'LocalAR',
    category: 'navigation',
    rating: 4.3, reviewCount: 876,
    description: 'Find restaurants, ATMs and services around you.',
    version: '1.0.4', installed: false, icon: '📍',
  },
  {
    id: 'parking-finder',
    name: 'Parking Finder',
    developer: 'ParkAR',
    category: 'navigation',
    rating: 4.5, reviewCount: 654,
    description: 'Locate and navigate to available parking spots nearby.',
    version: '1.1.2', installed: false, icon: '🅿️',
  },

  // ── Health ────────────────────────────────────────────────────────────────
  {
    id: 'heart-rate',
    name: 'Heart Rate',
    developer: 'VitalSense',
    category: 'health',
    rating: 4.7, reviewCount: 3201,
    description: 'Continuous heart rate monitoring displayed on your lens.',
    version: '2.0.0', installed: false, icon: '❤️',
  },
  {
    id: 'step-counter',
    name: 'Step Counter',
    developer: 'FitAR',
    category: 'health',
    rating: 4.5, reviewCount: 1876,
    description: 'Count steps and estimate calories burned throughout the day.',
    version: '1.4.0', installed: true, icon: '🏃',
  },
  {
    id: 'breathing-coach',
    name: 'Breathing Coach',
    developer: 'ZenWave',
    category: 'health',
    rating: 4.8, reviewCount: 1023,
    description: 'Guided breathing exercises with visual pacing on the lens.',
    version: '1.2.1', installed: false, icon: '💨',
  },
  {
    id: 'water-reminder',
    name: 'Water Reminder',
    developer: 'HydroAR',
    category: 'health',
    rating: 4.4, reviewCount: 743,
    description: 'Hourly hydration reminders with daily intake tracking.',
    version: '1.0.2', installed: false, icon: '💧',
  },
  {
    id: 'posture-check',
    name: 'Posture Check',
    developer: 'SpineAR',
    category: 'health',
    rating: 4.6, reviewCount: 934,
    description: 'Real-time posture alerts and a daily posture score.',
    version: '1.1.0', installed: false, icon: '⬆️',
  },

  // ── Communication ─────────────────────────────────────────────────────────
  {
    id: 'messages-mirror',
    name: 'Messages Mirror',
    developer: 'EvenLabs',
    category: 'communication',
    rating: 4.7, reviewCount: 4532,
    description: 'See incoming messages on your lens without your phone.',
    version: '1.6.0', installed: true, icon: '💬',
  },
  {
    id: 'call-handler',
    name: 'Call Handler',
    developer: 'PhoneAR',
    category: 'communication',
    rating: 4.5, reviewCount: 2341,
    description: 'See caller ID and manage calls from your glasses.',
    version: '1.3.2', installed: false, icon: '📞',
  },
  {
    id: 'quick-reply',
    name: 'Quick Reply',
    developer: 'SwiftAR',
    category: 'communication',
    rating: 4.6, reviewCount: 1567,
    description: 'Reply to messages with voice or preset responses.',
    version: '2.1.0', installed: false, icon: '↩️',
  },
  {
    id: 'g2-translator',
    name: 'G2 Translator',
    developer: 'Malcolm Mitchell',
    category: 'communication',
    rating: 4.9, reviewCount: 312,
    description: 'Real-time bidirectional translation with smart bilingual suggestions.',
    version: '0.1.0', installed: true, icon: '🌐',
  },

  // ── Entertainment ─────────────────────────────────────────────────────────
  {
    id: 'now-playing',
    name: 'Now Playing',
    developer: 'TuneAR',
    category: 'entertainment',
    rating: 4.8, reviewCount: 6789,
    description: 'Song title, artist and playback controls on your lens.',
    version: '2.3.0', installed: false, icon: '🎵',
  },
  {
    id: 'sports-scores',
    name: 'Sports Scores',
    developer: 'GameAR',
    category: 'entertainment',
    rating: 4.6, reviewCount: 3421,
    description: 'Live scores for your favourite teams and leagues.',
    version: '1.8.0', installed: false, icon: '🏆',
  },
  {
    id: 'news-ticker',
    name: 'News Ticker',
    developer: 'FlashNews',
    category: 'entertainment',
    rating: 4.4, reviewCount: 2109,
    description: 'Breaking news headlines scrolling on your lens in real time.',
    version: '1.2.3', installed: false, icon: '📰',
  },
  {
    id: 'podcast-player',
    name: 'Podcast Player',
    developer: 'EarAR',
    category: 'entertainment',
    rating: 4.5, reviewCount: 1234,
    description: 'Browse and navigate podcasts without touching your phone.',
    version: '1.1.0', installed: false, icon: '🎙️',
  },

  // ── Utilities ─────────────────────────────────────────────────────────────
  {
    id: 'weather-now',
    name: 'Weather Now',
    developer: 'SkyCast',
    category: 'utilities',
    rating: 4.7, reviewCount: 7654,
    description: 'Live weather with hourly forecast and severe alerts.',
    version: '3.0.1', installed: true, icon: '🌤️',
  },
  {
    id: 'battery-monitor',
    name: 'Battery Monitor',
    developer: 'PowerAR',
    category: 'utilities',
    rating: 4.5, reviewCount: 2345,
    description: 'Shows phone and glasses battery levels on your lens.',
    version: '1.2.0', installed: false, icon: '🔋',
  },
  {
    id: 'world-clock',
    name: 'World Clock',
    developer: 'TimeAR',
    category: 'utilities',
    rating: 4.6, reviewCount: 1876,
    description: 'Show the current time in multiple timezones at a glance.',
    version: '1.0.3', installed: false, icon: '🕐',
  },
  {
    id: 'calculator',
    name: 'Calculator',
    developer: 'CalcAR',
    category: 'utilities',
    rating: 4.3, reviewCount: 987,
    description: 'Voice-activated calculator with a scrollable history.',
    version: '2.0.0', installed: false, icon: '🔢',
  },
  {
    id: 'unit-converter',
    name: 'Unit Converter',
    developer: 'ConvertAR',
    category: 'utilities',
    rating: 4.4, reviewCount: 654,
    description: 'Convert units for cooking, travel, and science on the fly.',
    version: '1.1.1', installed: false, icon: '↔️',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getCategory(id: string): StoreCategory | undefined {
  return CATEGORIES.find(c => c.id === id)
}

export function getApp(id: string): StoreApp | undefined {
  return APPS.find(a => a.id === id)
}

export function getAppsInCategory(categoryId: string): StoreApp[] {
  return APPS.filter(a => a.category === categoryId)
}

export function getFeaturedApps(): StoreApp[] {
  return APPS.filter(a => a.rating >= 4.7).slice(0, 6)
}

export function formatRating(rating: number): string {
  return rating.toFixed(1)
}

export function formatReviewCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}
