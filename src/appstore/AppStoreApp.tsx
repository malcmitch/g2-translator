// src/appstore/AppStoreApp.tsx
// Phone companion UI — styled to match the Even Hub App Store (green selected chip).

import React, { useEffect, useRef, useState } from 'react'
import type { AppStoreLensManager, ViewState } from './AppStoreLensManager'
import {
  CATEGORIES,
  APPS,
  type StoreApp,
  getAppsInCategory,
  getFeaturedApps,
  getApp,
  formatRating,
  formatReviewCount,
} from './catalog'

interface Props {
  lens: AppStoreLensManager
}

type ActiveChip = 'all' | 'featured' | string   // string = category id

export function AppStoreApp({ lens }: Props) {
  const [lensView, setLensView]           = useState<ViewState>({ screen: 'home' })
  const [selectedApp, setSelectedApp]     = useState<StoreApp | null>(null)
  const [activeChip, setActiveChip]       = useState<ActiveChip>('all')
  const [installedIds, setInstalledIds]   = useState<Set<string>>(
    () => new Set(APPS.filter(a => a.installed).map(a => a.id))
  )
  const [searchOpen, setSearchOpen]       = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const searchRef                         = useRef<HTMLInputElement>(null)

  useEffect(() => {
    lens.onStateChange = (s) => {
      setLensView(s)
      if (s.screen === 'home')     { setSelectedApp(null); setActiveChip('all') }
      if (s.screen === 'featured') { setSelectedApp(null); setActiveChip('featured') }
      if (s.screen === 'category') { setSelectedApp(null); setActiveChip(s.categoryId) }
      if (s.screen === 'app')      { setSelectedApp(getApp(s.appId) ?? null) }
    }
    lens.onInstallToggle = (app, installed) => {
      setInstalledIds(prev => {
        const next = new Set(prev)
        if (installed) { next.add(app.id) } else { next.delete(app.id) }
        return next
      })
    }
  }, [lens])

  // ── Chip click ────────────────────────────────────────────────────────────

  function handleChipClick(chip: ActiveChip) {
    setActiveChip(chip)
    setSelectedApp(null)
    setSearchOpen(false)
    setSearchQuery('')
    if (chip === 'all')      void lens.goHome()
    else if (chip === 'featured') void lens.goToFeatured()
    else                     void lens.goToCategory(chip)
  }

  // ── App card click ────────────────────────────────────────────────────────

  function handleAppPress(app: StoreApp) {
    setSelectedApp(app)
    const from = activeChip === 'featured' ? 'featured' : 'category'
    const fromCat = activeChip !== 'all' && activeChip !== 'featured' ? activeChip : undefined
    void lens.goToApp(app.id, from, fromCat)
  }

  // ── Install toggle ────────────────────────────────────────────────────────

  function handleInstall(app: StoreApp) {
    const nowInstalled = !installedIds.has(app.id)
    setInstalledIds(prev => {
      const next = new Set(prev)
      if (nowInstalled) { next.add(app.id) } else { next.delete(app.id) }
      return next
    })
    lens.onInstallToggle?.(app, nowInstalled)
  }

  // ── Derived grid apps ─────────────────────────────────────────────────────

  const gridApps: StoreApp[] = searchQuery.trim()
    ? APPS.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.developer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeChip === 'all'      ? APPS
    : activeChip === 'featured' ? getFeaturedApps()
    : getAppsInCategory(activeChip)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={s.root}>
      {/* ── Header ── */}
      <div style={s.header}>
        <button
          style={s.headerIconBtn}
          onClick={() => {
            setSearchOpen(v => !v)
            if (!searchOpen) setTimeout(() => searchRef.current?.focus(), 80)
          }}
        >
          <SearchIcon />
        </button>

        {selectedApp ? (
          <button style={s.headerBackRow} onClick={() => {
            setSelectedApp(null)
            void lens.goBack()
          }}>
            <span style={s.backChevron}>‹</span>
            <span style={s.headerTitle}>Even Hub</span>
          </button>
        ) : (
          <span style={s.headerTitle}>Even Hub</span>
        )}

        <div style={s.glassesBtn}>
          <GlassesIcon />
        </div>
      </div>

      {/* ── Search bar ── */}
      {searchOpen && (
        <div style={s.searchBar}>
          <SearchIcon size={16} color="#8e8e8e" />
          <input
            ref={searchRef}
            style={s.searchInput}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button style={s.searchClear} onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>
      )}

      {/* ── Category chips (hidden on app detail) ── */}
      {!selectedApp && (
        <div style={s.chipsScroll}>
          <div style={s.chipsInner}>
            {[
              { id: 'all',      label: 'All' },
              { id: 'featured', label: 'Featured' },
              ...CATEGORIES.map(c => ({ id: c.id, label: c.name })),
            ].map(chip => {
              const active = activeChip === chip.id
              return (
                <button
                  key={chip.id}
                  style={{ ...s.chip, ...(active ? s.chipActive : {}) }}
                  onClick={() => handleChipClick(chip.id as ActiveChip)}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── App detail view ── */}
      {selectedApp ? (
        <AppDetail
          app={selectedApp}
          installed={installedIds.has(selectedApp.id)}
          onInstall={() => handleInstall(selectedApp)}
        />
      ) : (
        /* ── App grid ── */
        <div style={s.grid}>
          {gridApps.length === 0 && (
            <div style={s.empty}>No apps found.</div>
          )}
          {gridApps.map(app => (
            <AppCard
              key={app.id}
              app={app}
              installed={installedIds.has(app.id)}
              onPress={() => handleAppPress(app)}
            />
          ))}
        </div>
      )}

      {/* ── Bottom nav ── */}
      <div style={s.bottomNav}>
        <NavIcon label="Home">    <HomeIcon /> </NavIcon>
        <NavIcon label="Health">  <HeartIcon /> </NavIcon>
        <NavIcon label="Apps" active> <GridIcon /> </NavIcon>
        <NavIcon label="Settings"><GearIcon /> </NavIcon>
      </div>
    </div>
  )
}

// ── App card (2-col grid item) ────────────────────────────────────────────────

function AppCard({ app, installed, onPress }: {
  app: StoreApp
  installed: boolean
  onPress: () => void
}) {
  return (
    <div style={s.card} onClick={onPress} role="button">
      <span style={s.cardIcon}>{app.icon}</span>
      <div style={s.cardName}>{app.name}</div>
      <div style={{ ...s.cardDesc, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>{app.description}</div>
    </div>
  )
}

// ── App detail (full-width below header) ─────────────────────────────────────

function AppDetail({ app, installed, onInstall }: {
  app: StoreApp
  installed: boolean
  onInstall: () => void
}) {
  return (
    <div style={s.detail}>
      <div style={s.detailIconWrap}>
        <span style={s.detailIcon}>{app.icon}</span>
      </div>

      <div style={s.detailName}>{app.name}</div>
      <div style={s.detailDev}>{app.developer}</div>

      <div style={s.ratingRow}>
        <StarRow rating={app.rating} />
        <span style={s.ratingNum}>{formatRating(app.rating)}</span>
        <span style={s.ratingCount}>{formatReviewCount(app.reviewCount)} ratings</span>
      </div>

      <div style={s.detailDesc}>{app.description}</div>

      <div style={s.detailMeta}>v{app.version}</div>

      <button
        style={{ ...s.getBtn, ...(installed ? s.getBtnInstalled : {}) }}
        onClick={onInstall}
      >
        {installed ? 'OPEN' : 'GET'}
      </button>
    </div>
  )
}

// ── Star row ──────────────────────────────────────────────────────────────────

function StarRow({ rating }: { rating: number }) {
  const full = Math.floor(rating)
  const half = rating - full >= 0.5
  return (
    <span style={{ fontSize: 13, color: '#1a1a1a', letterSpacing: 0.5 }}>
      {'★'.repeat(full)}{half ? '⯨' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  )
}

// ── Nav icon wrapper ──────────────────────────────────────────────────────────

function NavIcon({ children, label, active }: {
  children: React.ReactNode
  label: string
  active?: boolean
}) {
  return (
    <button style={{ ...s.navBtn, ...(active ? s.navBtnActive : {}) }} aria-label={label}>
      {children}
    </button>
  )
}

// ── SVG-style icons (black line icons matching Even Hub aesthetic) ─────────────

function SearchIcon({ size = 22, color = '#1a1a1a' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" />
    </svg>
  )
}

function GlassesIcon() {
  return (
    <svg width="22" height="14" viewBox="0 0 36 22" fill="none"
      stroke="#5a5a5a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9"  cy="13" r="8" />
      <circle cx="27" cy="13" r="8" />
      <path d="M17 13 h2" />
      <path d="M1 13 Q0 6 3 4" />
      <path d="M35 13 Q36 6 33 4" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" />
    </svg>
  )
}

function GridIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3"  y="3"  width="7" height="7" rx="1.5" />
      <rect x="14" y="3"  width="7" height="7" rx="1.5" />
      <rect x="3"  y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const GREEN = '#b5f53a'   // lime green — replaces the Even Hub yellow highlight

const s: Record<string, React.CSSProperties> = {
  root: {
    width: '100%',
    maxWidth: 430,
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: '#f0f0f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    color: '#1a1a1a',
    paddingBottom: 72,  // room for bottom nav
  },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px 10px',
    background: '#f0f0f0',
  },
  headerIconBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    lineHeight: 0,
    width: 36,
  },
  headerBackRow: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  },
  backChevron: {
    fontSize: 28,
    fontWeight: 300,
    color: '#1a1a1a',
    lineHeight: 1,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a1a',
    letterSpacing: '-0.3px',
    textAlign: 'center' as const,
    flex: 1,
  },
  glassesBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: '#e0e0e0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Search bar ────────────────────────────────────────────────────────────
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    margin: '0 14px 8px',
    background: '#e4e4e4',
    borderRadius: 12,
    padding: '10px 14px',
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    fontSize: 16,
    color: '#1a1a1a',
  },
  searchClear: {
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: 14,
    cursor: 'pointer',
    padding: '0 2px',
  },

  // ── Category chips ────────────────────────────────────────────────────────
  chipsScroll: {
    overflowX: 'auto' as const,
    scrollbarWidth: 'none' as const,
    padding: '4px 0 10px',
  },
  chipsInner: {
    display: 'flex',
    gap: 8,
    padding: '0 14px',
    width: 'max-content',
  },
  chip: {
    background: '#ffffff',
    border: 'none',
    borderRadius: 20,
    padding: '8px 18px',
    fontSize: 14,
    fontWeight: 400,
    color: '#1a1a1a',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    letterSpacing: '-0.1px',
  },
  chipActive: {
    background: GREEN,
    fontWeight: 700,
    boxShadow: 'none',
  },

  // ── App grid ──────────────────────────────────────────────────────────────
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 2,
    flex: 1,
  },
  card: {
    background: '#ffffff',
    padding: '18px 16px 16px',
    cursor: 'pointer',
    minHeight: 180,
    display: 'flex',
    flexDirection: 'column',
  },
  cardIcon: {
    fontSize: 34,
    marginBottom: 14,
    display: 'block',
    filter: 'grayscale(100%) brightness(0.15)',
    lineHeight: 1,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 500,
    color: '#1a1a1a',
    lineHeight: 1.25,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: '#8e8e8e',
    lineHeight: 1.4,
    overflow: 'hidden',
  } as React.CSSProperties,

  // ── App detail ────────────────────────────────────────────────────────────
  detail: {
    background: '#ffffff',
    margin: 10,
    borderRadius: 16,
    padding: '28px 24px 32px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  detailIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 18,
    background: '#f4f4f4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  detailIcon: {
    fontSize: 42,
    filter: 'grayscale(100%) brightness(0.15)',
  },
  detailName: {
    fontSize: 26,
    fontWeight: 700,
    color: '#1a1a1a',
    lineHeight: 1.2,
  },
  detailDev: {
    fontSize: 14,
    color: '#8e8e8e',
    marginTop: -4,
  },
  ratingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  ratingNum: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  ratingCount: {
    fontSize: 13,
    color: '#8e8e8e',
  },
  detailDesc: {
    fontSize: 15,
    lineHeight: 1.6,
    color: '#3a3a3a',
    marginTop: 4,
  },
  detailMeta: {
    fontSize: 12,
    color: '#b0b0b0',
    marginTop: -4,
  },
  getBtn: {
    background: '#e8e8e8',
    border: 'none',
    borderRadius: 20,
    padding: '9px 28px',
    fontSize: 15,
    fontWeight: 700,
    color: '#1a1a1a',
    cursor: 'pointer',
    marginTop: 8,
    letterSpacing: '0.5px',
  },
  getBtnInstalled: {
    background: GREEN,
  },

  // ── Bottom nav ────────────────────────────────────────────────────────────
  bottomNav: {
    position: 'fixed' as const,
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 430,
    background: '#ffffff',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 64,
    borderTop: '1px solid #ebebeb',
    paddingBottom: 4,
  },
  navBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px 20px',
    color: '#b0b0b0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  navBtnActive: {
    color: '#1a1a1a',
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  empty: {
    gridColumn: '1 / -1' as string,
    textAlign: 'center' as const,
    color: '#aaa',
    fontSize: 15,
    padding: '60px 24px',
  },
}
