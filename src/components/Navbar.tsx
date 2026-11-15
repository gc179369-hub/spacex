import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Menu, Search, X, Compass, Home, Users, FileText, Heart, Settings, UploadCloud } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { NavSection, PawchivePostSummary } from '../types/spacex';
import { GlobalNavSearch } from './GlobalNavSearch';

interface NavbarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  onOpenSettings: () => void;
  onOpenImporter: () => void;
  favoritesCount: number;
  googleUser?: User | null;
  searchHistory: string[];
  onRecordSearch: (term: string) => void;
  onRemoveHistoryItem: (term: string) => void;
  onClearHistory: () => void;
  onSelectCreator: (service: string, id: string) => void;
  onSelectPost: (post: PawchivePostSummary) => void;
  onQuickSearch: (query: string, mode: 'creators' | 'posts') => void;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: typeof Home }[] = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'explorar', label: 'Explorar', icon: Compass },
  { id: 'criadores', label: 'Criadores', icon: Users },
  { id: 'publicacoes', label: 'Publicações', icon: FileText },
  { id: 'favoritos', label: 'Favoritos', icon: Heart },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
];

export function Navbar({
  activeSection,
  onNavigate,
  onOpenSettings,
  onOpenImporter,
  favoritesCount,
  googleUser,
  searchHistory,
  onRecordSearch,
  onRemoveHistoryItem,
  onClearHistory,
  onSelectCreator,
  onSelectPost,
  onQuickSearch,
}: NavbarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const handleSelect = (id: NavSection) => {
    setDrawerOpen(false);
    setMobileSearchOpen(false);
    if (id === 'configuracoes') {
      onOpenSettings();
      return;
    }
    onNavigate(id);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#050507]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:h-16 lg:gap-5">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleSelect('inicio')}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
              className="shrink-0 text-white"
            >
              <circle cx="14" cy="14" r="11.5" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.25" />
              <path
                d="M7.5 19.5C11.5 14.5 16.5 10.5 22 8.5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M9 9.5L19 19.5"
                stroke="#38BDF8"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-display text-lg font-semibold tracking-tight text-white whitespace-nowrap shrink-0">
              SpaceX
            </span>
          </button>

          {/* Zone 2: Clean Typography Nav Links (Desktop) */}
          <nav aria-label="Navegação principal" className="hidden lg:flex items-center gap-4 xl:gap-5">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`relative py-2 text-[13px] xl:text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                  {item.id === 'favoritos' && favoritesCount > 0 ? ` (${favoritesCount})` : ''}
                  {isActive && (
                    <motion.span
                      layoutId="navbar-active-indicator"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-sky-400"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Persistent Global Search (Tablet & Desktop) */}
          <div className="hidden md:block flex-1 max-w-[240px] lg:max-w-[230px] xl:max-w-[290px]">
            <GlobalNavSearch
              searchHistory={searchHistory}
              onRecordSearch={onRecordSearch}
              onRemoveHistoryItem={onRemoveHistoryItem}
              onClearHistory={onClearHistory}
              onSelectCreator={onSelectCreator}
              onSelectPost={onSelectPost}
              onQuickSearch={onQuickSearch}
            />
          </div>

          {/* Zone 3: Mobile Search Trigger + Google Avatar + Primary Action + Mobile Drawer Toggle */}
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileSearchOpen((v) => !v)}
              aria-label={mobileSearchOpen ? 'Fechar busca global' : 'Abrir busca global'}
              aria-expanded={mobileSearchOpen}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
                mobileSearchOpen
                  ? 'border-sky-400/50 bg-sky-400/15 text-sky-300'
                  : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/10'
              }`}
            >
              {mobileSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>

            {googleUser && (
              <button
                type="button"
                onClick={() => handleSelect('favoritos')}
                title={googleUser.displayName || googleUser.email || 'Favoritos da conta Google'}
                aria-label="Abrir favoritos da conta Google"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 text-xs font-semibold text-white transition-transform hover:scale-105"
              >
                {googleUser.photoURL ? (
                  <img
                    src={googleUser.photoURL}
                    alt={googleUser.displayName || 'Google'}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  (googleUser.displayName || googleUser.email || 'G').slice(0, 1).toUpperCase()
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenImporter}
              className="hidden sm:inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-[#050507] transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Importar Criadores</span>
              <span className="xl:hidden">Importar</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menu de navegação"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition-colors hover:bg-white/10 lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Persistent Expandable Mobile Search Bar */}
        <AnimatePresence>
          {mobileSearchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="border-t border-white/[0.08] px-4 py-2.5 md:hidden"
            >
              <GlobalNavSearch
                compactMobile
                searchHistory={searchHistory}
                onRecordSearch={onRecordSearch}
                onRemoveHistoryItem={onRemoveHistoryItem}
                onClearHistory={onClearHistory}
                onSelectCreator={onSelectCreator}
                onSelectPost={onSelectPost}
                onQuickSearch={onQuickSearch}
                onCloseMobile={() => setMobileSearchOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile & Tablet Liquid Glass Side Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu SpaceX">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="liquid-glass fixed inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col justify-between p-5"
            >
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <span className="font-display text-lg font-semibold text-white">SpaceX</span>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Fechar menu"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="mt-4 flex flex-col gap-1">
                  {NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={`flex min-h-[44px] items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-slate-400" />
                          {item.label}
                        </span>
                        {item.id === 'favoritos' && favoritesCount > 0 && (
                          <span className="font-mono-tabular text-xs text-sky-300">{favoritesCount}</span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenImporter();
                  }}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#050507] transition-colors hover:bg-slate-200"
                >
                  <UploadCloud className="h-4 w-4" />
                  Importação Autorizada
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
