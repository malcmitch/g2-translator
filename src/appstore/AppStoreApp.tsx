// src/appstore/AppStoreApp.tsx
// Phone-side companion UI for the Even Hub App Store browser.
// The G2 lens is driven by AppStoreLensManager — this screen mirrors the
// current navigation state and lets the user browse / install without glasses.

import React, { useEffect, useState } from 'react'
import type { AppStoreLensManager, ViewState } from './AppStoreLensManager'
import {
  CATEGORIES,
  APPS,
  type StoreApp,
  type StoreCategory,
  getAppsInCategory,
  getFeaturedApps,
  getApp,
  formatRating,
  formatReviewCount,
} from './catalog'

interface Props {
  lens: AppStoreLensManager
}

export function AppStoreApp({ lens }: Props) {
  const [view, setView]                 = useState<ViewState>({ screen: 'home' })
  const [installedIds, setInstalledIds] = useState<Set<string>>(
    () => new Set(APPS.filter(a => a.installed).map(a => a.id))
  )
  const [search, setSearch]             = useState('')

  useEffect(() => {
    lens.onStateChange = (s) => setView(s)
    lens.onInstallToggle = (app, installed) => {
      setInstalledIds(prev => {
        const next = new Set(prev)
        if (installed) { next.add(app.id) } else { next.delete(app.id) }
        return next
      })
    }
  }, [lens])

  // ── Search overlay ────────────────────────────────────────────────────────

  const searchResults = search.trim()
    ? APPS.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.developer.toLowerCase().includes(search.toLowerCase())
      )
    : null

  // ── Install toggle (phone-side) ───────────────────────────────────────────

  function handleInstall(app: StoreApp) {
    const nowInstalled = !installedIds.has(app.id)
    setInstalledIds(prev => {
      const next = new Set(prev)
      if (nowInstalled) { next.add(app.id) } else { next.delete(app.id) }
      return next
    })
    lens.onInstallToggle?.(app, nowInstalled)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        {view.screen !== 'home' && (
          <button style={s.backBtn} onClick={() => lens.goBack()}>‹</button>
        )}
        <span style={s.title}>
          {headerTitle(view)}
        </span>
        <span style={s.glassesBadge}>On Lens</span>
      </div>

      {/* Search bar */}
      <div style={s.searchRow}>
        <input
          style={s.searchInput}
          type="text"
          placeholder="Search apps…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button style={s.clearBtn} onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* Search results */}
      {searchResults && (
        <div style={s.section}>
          {searchResults.length === 0
            ? <div style={s.empty}>No apps match "{search}"</div>
            : searchResults.map(app => (
                <AppRow
                  key={app.id}
                  app={app}
                  installed={installedIds.has(app.id)}
                  onPress={() => lens.goToApp(app.id, 'featured')}
                  onInstall={() => handleInstall(app)}
                />
              ))
          }
        </div>
      )}

      {/* Main content (when not searching) */}
      {!searchResults && (
        <>
          {view.screen === 'home' && (
            <HomeView
              onCategory={id => lens.goToCategory(id)}
              onFeatured={() => lens.goToFeatured()}
              installedIds={installedIds}
            />
          )}

          {view.screen === 'featured' && (
            <AppListView
              apps={getFeaturedApps()}
              installedIds={installedIds}
              onApp={id => lens.goToApp(id, 'featured')}
              onInstall={id => { const a = getApp(id); if (a) handleInstall(a) }}
            />
          )}

          {view.screen === 'category' && (
            <AppListView
              apps={getAppsInCategory(view.categoryId)}
              installedIds={installedIds}
              onApp={id => lens.goToApp(id, 'category', view.categoryId)}
              onInstall={id => { const a = getApp(id); if (a) handleInstall(a) }}
            />
          )}

          {view.screen === 'app' && (
            <AppDetailView
              app={getApp(view.appId)!}
              installed={installedIds.has(view.appId)}
              onInstall={() => { const a = getApp(view.appId); if (a) handleInstall(a) }}
            />
          )}
        </>
      )}
    </div>
  )
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

function HomeView({
  onCategory,
  onFeatured,
  installedIds,
}: {
  onCategory: (id: string) => void
  onFeatured: () => void
  installedIds: Set<string>
}) {
  const installedCount = installedIds.size
  return (
    <>
      <div style={s.statsRow}>
        <StatPill label="Installed" value={installedCount} />
        <StatPill label="Total apps" value={APPS.length} />
        <StatPill label="Categories" value={CATEGORIES.length} />
      </div>

      <div style={s.sectionLabel}>Categories</div>
      <div style={s.grid}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} style={s.catCard} onClick={() => onCategory(cat.id)}>
            <span style={s.catIcon}>{cat.icon}</span>
            <span style={s.catName}>{cat.name}</span>
            <span style={s.catCount}>
              {APPS.filter(a => a.category === cat.id).length} apps
            </span>
          </button>
        ))}
      </div>

      <div style={s.sectionLabel}>Featured</div>
      <button style={s.featuredBanner} onClick={onFeatured}>
        <span>⭐ Top-rated apps</span>
        <span style={s.featuredArrow}>›</span>
      </button>
    </>
  )
}

function AppListView({
  apps,
  installedIds,
  onApp,
  onInstall,
}: {
  apps: StoreApp[]
  installedIds: Set<string>
  onApp: (id: string) => void
  onInstall: (id: string) => void
}) {
  return (
    <div style={s.section}>
      {apps.map(app => (
        <AppRow
          key={app.id}
          app={app}
          installed={installedIds.has(app.id)}
          onPress={() => onApp(app.id)}
          onInstall={() => onInstall(app.id)}
        />
      ))}
    </div>
  )
}

function AppDetailView({
  app,
  installed,
  onInstall,
}: {
  app: StoreApp
  installed: boolean
  onInstall: () => void
}) {
  if (!app) return <div style={s.empty}>App not found.</div>

  return (
    <div style={s.detailCard}>
      <div style={s.detailName}>{app.name}</div>
      <div style={s.detailDev}>by {app.developer} · v{app.version}</div>

      <div style={s.ratingRow}>
        <Stars rating={app.rating} />
        <span style={s.ratingNum}>{formatRating(app.rating)}</span>
        <span style={s.reviewCount}>{formatReviewCount(app.reviewCount)} reviews</span>
      </div>

      <div style={s.detailDesc}>{app.description}</div>

      <button
        style={{ ...s.installBtn, ...(installed ? s.installedBtn : {}) }}
        onClick={onInstall}
      >
        {installed ? '✓ Installed' : '📥 Install'}
      </button>
    </div>
  )
}

// ── Shared row component ──────────────────────────────────────────────────────

function AppRow({
  app,
  installed,
  onPress,
  onInstall,
}: {
  app: StoreApp
  installed: boolean
  onPress: () => void
  onInstall: () => void
}) {
  return (
    <div style={s.appRow} onClick={onPress} role="button">
      <div style={s.appIcon}>{app.category === 'utilities' ? '🔧' : categoryIcon(app.category)}</div>
      <div style={s.appInfo}>
        <div style={s.appName}>{app.name}</div>
        <div style={s.appDev}>{app.developer}</div>
        <div style={s.appRating}>
          <Stars rating={app.rating} small />
          <span style={s.appRatingNum}>{formatRating(app.rating)}</span>
        </div>
      </div>
      <button
        style={{ ...s.rowInstallBtn, ...(installed ? s.rowInstalledBtn : {}) }}
        onClick={e => { e.stopPropagation(); onInstall() }}
      >
        {installed ? '✓' : 'GET'}
      </button>
    </div>
  )
}

function Stars({ rating, small }: { rating: number; small?: boolean }) {
  const full  = Math.floor(rating)
  const half  = rating - full >= 0.5
  const sz    = small ? 10 : 13
  return (
    <span style={{ fontSize: sz, color: '#f59e0b', letterSpacing: 1 }}>
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  )
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div style={s.statPill}>
      <span style={s.statValue}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  )
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function headerTitle(view: ViewState): string {
  switch (view.screen) {
    case 'home':     return 'Even Hub Store'
    case 'featured': return '⭐ Featured'
    case 'category': {
      const cat = CATEGORIES.find(c => c.id === view.categoryId)
      return cat ? `${cat.icon} ${cat.name}` : 'Apps'
    }
    case 'app': {
      return APPS.find(a => a.id === view.appId)?.name ?? 'App'
    }
  }
}

function categoryIcon(categoryId: string): string {
  return CATEGORIES.find(c => c.id === categoryId)?.icon ?? '📦'
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: 420,
    minHeight: '100dvh',
    padding: '0 0 40px',
    display: 'flex',
    flexDirection: 'column',
    background: '#0a0a0a',
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '18px 16px 10px',
    borderBottom: '1px solid #1e1e1e',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    fontSize: 26,
    cursor: 'pointer',
    padding: '0 4px 0 0',
    lineHeight: 1,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '-0.3px',
  },
  glassesBadge: {
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 20,
    background: '#1e3a5f',
    color: '#93c5fd',
    border: '1px solid #2563eb',
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 16px',
  },
  searchInput: {
    flex: 1,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 15,
    color: '#e0e0e0',
    outline: 'none',
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: '#555',
    fontSize: 16,
    cursor: 'pointer',
  },
  statsRow: {
    display: 'flex',
    gap: 8,
    padding: '8px 16px',
  },
  statPill: {
    flex: 1,
    background: '#141414',
    borderRadius: 10,
    padding: '10px 8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  statValue: { fontSize: 20, fontWeight: 700 },
  statLabel: { fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#555',
    padding: '12px 16px 6px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    padding: '0 16px',
  },
  catCard: {
    background: '#141414',
    border: '1px solid #1e1e1e',
    borderRadius: 12,
    padding: '16px 14px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
    color: '#e0e0e0',
    textAlign: 'left',
  },
  catIcon: { fontSize: 24 },
  catName: { fontSize: 14, fontWeight: 600 },
  catCount: { fontSize: 11, color: '#555' },
  featuredBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#1a2744',
    border: '1px solid #2563eb',
    borderRadius: 12,
    padding: '16px',
    margin: '0 16px',
    cursor: 'pointer',
    color: '#93c5fd',
    fontSize: 15,
    fontWeight: 600,
    width: 'calc(100% - 32px)',
  },
  featuredArrow: { fontSize: 20, color: '#2563eb' },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    padding: '4px 0',
  },
  appRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #141414',
  },
  appIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    flexShrink: 0,
  },
  appInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  appName: { fontSize: 15, fontWeight: 600 },
  appDev:  { fontSize: 12, color: '#555' },
  appRating: { display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 },
  appRatingNum: { fontSize: 11, color: '#888' },
  rowInstallBtn: {
    background: '#1e3a5f',
    border: '1px solid #2563eb',
    borderRadius: 8,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 700,
    color: '#60a5fa',
    cursor: 'pointer',
    flexShrink: 0,
  },
  rowInstalledBtn: {
    background: '#1a2a1a',
    border: '1px solid #166534',
    color: '#4ade80',
  },
  detailCard: {
    margin: 16,
    background: '#141414',
    borderRadius: 14,
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  detailName: { fontSize: 24, fontWeight: 700 },
  detailDev:  { fontSize: 13, color: '#666' },
  ratingRow: { display: 'flex', alignItems: 'center', gap: 8 },
  ratingNum: { fontSize: 14, fontWeight: 600, color: '#f59e0b' },
  reviewCount: { fontSize: 12, color: '#555' },
  detailDesc: { fontSize: 15, lineHeight: 1.6, color: '#bbb', marginTop: 4 },
  installBtn: {
    background: '#2563eb',
    border: 'none',
    borderRadius: 10,
    padding: '13px 0',
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    cursor: 'pointer',
    textAlign: 'center',
    marginTop: 4,
  },
  installedBtn: {
    background: '#1a2a1a',
    border: '1px solid #166534',
    color: '#4ade80',
  },
  empty: {
    textAlign: 'center',
    color: '#444',
    fontSize: 15,
    padding: '60px 24px',
    lineHeight: 1.8,
  },
}
