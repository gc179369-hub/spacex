import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { ToastProvider } from './hooks/useToast';
import { useLocalStorage } from './hooks/useLocalStorage';
import { FirebaseAuthProvider, useFirebaseAuth } from './contexts/FirebaseAuthContext';
import type {
  AuthSessionState,
  NavSection,
  PawchivePostSummary,
  UserPreferences,
} from './types/spacex';
import { pawchiveService } from './services/pawchiveService';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { ExploreView } from './components/ExploreView';
import { CreatorsDirectory } from './components/CreatorsDirectory';
import { CreatorProfileView } from './components/CreatorProfileView';
import { PublicationsFeed } from './components/PublicationsFeed';
import { FavoritesView } from './components/FavoritesView';
import { PostDetailModal } from './components/PostDetailModal';
import { ImporterModal } from './components/ImporterModal';
import { SettingsModal } from './components/SettingsModal';
import { GoogleLoginPromptModal } from './components/GoogleLoginPromptModal';

const DEFAULT_PREFERENCES: UserPreferences = {
  blurSensitiveThumbnails: false,
  defaultCreatorSort: 'favorited',
  defaultPageSize: 24,
  compactCards: false,
};

function SpaceXShell() {
  const {
    user: googleUser,
    authReady,
    signingIn,
    favoriteCreators,
    favoritePosts,
    signInWithGoogle,
    logoutGoogle,
    isCreatorFavorite,
    isPostFavorite,
    toggleCreatorFavorite,
    togglePostFavorite,
    clearAllCloudFavorites,
  } = useFirebaseAuth();

  const [section, setSection] = useState<NavSection>('inicio');
  const [selectedCreator, setSelectedCreator] = useState<{ service: string; id: string } | null>(null);
  const [selectedPost, setSelectedPost] = useState<PawchivePostSummary | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [importerOpen, setImporterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [exploreInit, setExploreInit] = useState<{ query: string; mode: 'creators' | 'posts' | 'hash'; key: number }>({
    query: '',
    mode: 'creators',
    key: 0,
  });

  const [refreshSignal, setRefreshSignal] = useState(0);
  const [auth, setAuth] = useState<AuthSessionState>({ authenticated: false });

  const [preferences, setPreferences] = useLocalStorage<UserPreferences>('spacex_preferences', DEFAULT_PREFERENCES);
  const [searchHistory, setSearchHistory] = useLocalStorage<string[]>('spacex_search_history', []);

  useEffect(() => {
    pawchiveService
      .getAuthSession()
      .then((res) => setAuth(res))
      .catch(() => setAuth({ authenticated: false }));
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 650);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add('motion-blur-visible');
              observer?.unobserve(entry.target);
            });
          },
          { threshold: 0.08, rootMargin: '0px 0px -7% 0px' }
        )
      : null;

    const observeMotionElements = (root: Node) => {
      if (!(root instanceof Element)) return;
      const elements: Element[] = [];
      if (root.matches('.motion-blur-in')) elements.push(root);
      elements.push(...root.querySelectorAll('.motion-blur-in'));
      elements.forEach((element) => {
        const siblings = Array.from(element.parentElement?.children || []).filter((sibling) =>
          sibling.classList.contains('motion-blur-in')
        );
        const index = Math.max(0, siblings.indexOf(element));
        (element as HTMLElement).style.setProperty('--motion-delay', `${Math.min(index, 5) * 65}ms`);

        if (prefersReducedMotion || !observer) {
          element.classList.add('motion-blur-visible');
        } else if (!element.classList.contains('motion-blur-visible')) {
          observer.observe(element);
        }
      });
    };

    observeMotionElements(document.body);
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach(observeMotionElements));
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    let scrollIdleTimer = 0;
    const markScrolling = () => {
      if (prefersReducedMotion) return;
      document.body.classList.add('is-scrolling');
      window.clearTimeout(scrollIdleTimer);
      scrollIdleTimer = window.setTimeout(() => document.body.classList.remove('is-scrolling'), 160);
    };
    window.addEventListener('scroll', markScrolling, { passive: true });

    return () => {
      observer?.disconnect();
      mutations.disconnect();
      window.removeEventListener('scroll', markScrolling);
      window.clearTimeout(scrollIdleTimer);
      document.body.classList.remove('is-scrolling');
    };
  }, []);

  const recordSearch = useCallback(
    (term: string) => {
      const clean = term.trim();
      if (!clean) return;
      setSearchHistory((prev) => [clean, ...prev.filter((t) => t !== clean)].slice(0, 12));
    },
    [setSearchHistory]
  );

  const removeSearchHistoryItem = useCallback(
    (term: string) => {
      setSearchHistory((prev) => prev.filter((t) => t !== term));
    },
    [setSearchHistory]
  );

  const handleNavigate = (next: NavSection) => {
    setSelectedCreator(null);
    setSection(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenCreator = (service: string, id: string) => {
    setSelectedCreator({ service, id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickSearch = (query: string, mode: 'creators' | 'posts') => {
    recordSearch(query);
    setSelectedCreator(null);
    setExploreInit((prev) => ({ query, mode, key: prev.key + 1 }));
    setSection('explorar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const favoritesCount = googleUser ? favoriteCreators.length + favoritePosts.length : 0;
  const activeViewKey = selectedCreator
    ? `creator-${selectedCreator.service}-${selectedCreator.id}`
    : `section-${section}`;

  return (
    <div className="piano-canvas flex min-h-screen flex-col text-white">
      <Navbar
        activeSection={section}
        onNavigate={handleNavigate}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenImporter={() => setImporterOpen(true)}
        favoritesCount={favoritesCount}
        googleUser={googleUser}
        searchHistory={searchHistory}
        onRecordSearch={recordSearch}
        onRemoveHistoryItem={removeSearchHistoryItem}
        onClearHistory={() => setSearchHistory([])}
        onSelectCreator={handleOpenCreator}
        onSelectPost={(p) => setSelectedPost(p)}
        onQuickSearch={handleQuickSearch}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeViewKey}
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {selectedCreator ? (
              <CreatorProfileView
                service={selectedCreator.service}
                creatorId={selectedCreator.id}
                blurThumbnails={preferences.blurSensitiveThumbnails}
                isCreatorFavorite={isCreatorFavorite}
                isPostFavorite={isPostFavorite}
                onToggleCreatorFavorite={toggleCreatorFavorite}
                onTogglePostFavorite={togglePostFavorite}
                onOpenCreator={handleOpenCreator}
                onOpenPost={(p) => setSelectedPost(p)}
                onBack={() => setSelectedCreator(null)}
              />
            ) : (
              <>
                {section === 'inicio' && (
                  <HomeView
                    blurThumbnails={preferences.blurSensitiveThumbnails}
                    refreshSignal={refreshSignal}
                    isCreatorFavorite={isCreatorFavorite}
                    isPostFavorite={isPostFavorite}
                    onToggleCreatorFavorite={toggleCreatorFavorite}
                    onTogglePostFavorite={togglePostFavorite}
                    onOpenCreator={handleOpenCreator}
                    onOpenPost={(p) => setSelectedPost(p)}
                    onQuickSearch={handleQuickSearch}
                    onNavigate={handleNavigate}
                    onOpenImporter={() => setImporterOpen(true)}
                  />
                )}

                {section === 'explorar' && (
                  <ExploreView
                    key={exploreInit.key}
                    initialQuery={exploreInit.query}
                    initialMode={exploreInit.mode}
                    blurThumbnails={preferences.blurSensitiveThumbnails}
                    searchHistory={searchHistory}
                    onRecordSearch={recordSearch}
                    onClearHistory={() => setSearchHistory([])}
                    isCreatorFavorite={isCreatorFavorite}
                    isPostFavorite={isPostFavorite}
                    onToggleCreatorFavorite={toggleCreatorFavorite}
                    onTogglePostFavorite={togglePostFavorite}
                    onOpenCreator={handleOpenCreator}
                    onOpenPost={(p) => setSelectedPost(p)}
                  />
                )}

                {section === 'criadores' && (
                  <CreatorsDirectory
                    key={refreshSignal}
                    defaultSort={preferences.defaultCreatorSort}
                    defaultPageSize={preferences.defaultPageSize}
                    isFavorite={isCreatorFavorite}
                    onToggleFavorite={toggleCreatorFavorite}
                    onOpenProfile={handleOpenCreator}
                    onRecordSearch={recordSearch}
                  />
                )}

                {section === 'publicacoes' && (
                  <PublicationsFeed
                    key={refreshSignal}
                    blurThumbnails={preferences.blurSensitiveThumbnails}
                    isPostFavorite={isPostFavorite}
                    onTogglePostFavorite={togglePostFavorite}
                    onOpenPost={(p) => setSelectedPost(p)}
                    onOpenCreator={handleOpenCreator}
                    onRecordSearch={recordSearch}
                  />
                )}

                {section === 'favoritos' && (
                  <FavoritesView
                    favoriteCreators={favoriteCreators}
                    favoritePosts={favoritePosts}
                    blurThumbnails={preferences.blurSensitiveThumbnails}
                    googleUser={googleUser}
                    authReady={authReady}
                    signingIn={signingIn}
                    onLoginWithGoogle={signInWithGoogle}
                    onLogoutGoogle={logoutGoogle}
                    onToggleCreatorFavorite={toggleCreatorFavorite}
                    onTogglePostFavorite={togglePostFavorite}
                    onOpenCreator={handleOpenCreator}
                    onOpenPost={(p) => setSelectedPost(p)}
                    onGoExplore={() => handleNavigate('explorar')}
                  />
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.16 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Voltar ao topo"
            className="liquid-glass fixed bottom-5 left-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
          >
            <ArrowUp className="h-4 w-4" />
          </motion.button>
        )}
      </AnimatePresence>

      <footer className="border-t border-white/[0.08] bg-black/85">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-6 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} SpaceX — Plataforma de Criadores e Publicações.</p>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={() => handleNavigate('criadores')} className="hover:text-white">
              Criadores
            </button>
            <button type="button" onClick={() => handleNavigate('publicacoes')} className="hover:text-white">
              Publicações
            </button>
            <button type="button" onClick={() => setImporterOpen(true)} className="hover:text-white">
              Importação Autorizada
            </button>
            <button type="button" onClick={() => setSettingsOpen(true)} className="hover:text-white">
              Configurações
            </button>
          </div>
        </div>
      </footer>

      <PostDetailModal
        post={selectedPost}
        blurThumbnails={preferences.blurSensitiveThumbnails}
        isFavorite={selectedPost ? isPostFavorite(selectedPost.service, selectedPost.user, selectedPost.id) : false}
        isAuthenticated={auth.authenticated}
        onToggleFavorite={togglePostFavorite}
        onOpenCreator={handleOpenCreator}
        onClose={() => setSelectedPost(null)}
      />

      <ImporterModal
        open={importerOpen}
        onClose={() => setImporterOpen(false)}
        onImported={() => setRefreshSignal((s) => s + 1)}
      />

      <SettingsModal
        open={settingsOpen}
        auth={auth}
        googleUser={googleUser}
        googleSigningIn={signingIn}
        preferences={preferences}
        onUpdatePreferences={setPreferences}
        onAuthChanged={setAuth}
        onLoginWithGoogle={signInWithGoogle}
        onLogoutGoogle={logoutGoogle}
        onClearHistory={() => setSearchHistory([])}
        onClearFavorites={clearAllCloudFavorites}
        onRefreshAll={() => setRefreshSignal((s) => s + 1)}
        onClose={() => setSettingsOpen(false)}
      />

      <GoogleLoginPromptModal />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <FirebaseAuthProvider>
          <SpaceXShell />
        </FirebaseAuthProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
