import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  Play,
  UploadCloud,
  User,
} from 'lucide-react';
import type { NavSection, PawchiveCreator, PawchivePostSummary } from '../types/spacex';
import {
  buildThumbnailUrl,
  formatDatePtBr,
  getServiceLabel,
  isVideoFile,
  pawchiveService,
  stripHtml,
} from '../services/pawchiveService';
import { CreatorCard } from './CreatorCard';
import { PostCard } from './PostCard';
import { SmartImage } from './SmartImage';
import { SmartSearchBar } from './SmartSearchBar';
import { InfiniteScrollSentinel } from './InfiniteScrollSentinel';
import heroObsidianBg from '../assets/images/spacex_obsidian_glass_hero_1794747747406.jpg';

interface HomeViewProps {
  blurThumbnails: boolean;
  refreshSignal: number;
  isCreatorFavorite: (service: string, id: string) => boolean;
  isPostFavorite: (service: string, creatorId: string, postId: string) => boolean;
  onToggleCreatorFavorite: (creator: PawchiveCreator) => void;
  onTogglePostFavorite: (post: PawchivePostSummary) => void;
  onOpenCreator: (service: string, id: string) => void;
  onOpenPost: (post: PawchivePostSummary) => void;
  onQuickSearch: (query: string, mode: 'creators' | 'posts') => void;
  onNavigate: (section: NavSection) => void;
  onOpenImporter: () => void;
}

export function HomeView({
  blurThumbnails,
  refreshSignal,
  isCreatorFavorite,
  isPostFavorite,
  onToggleCreatorFavorite,
  onTogglePostFavorite,
  onOpenCreator,
  onOpenPost,
  onQuickSearch,
  onNavigate,
  onOpenImporter,
}: HomeViewProps) {
  const [smartQuery, setSmartQuery] = useState('');
  const [featuredCreators, setFeaturedCreators] = useState<PawchiveCreator[]>([]);
  const [recentPosts, setRecentPosts] = useState<PawchivePostSummary[]>([]);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);

  // Infinite Stream State (both creators & posts)
  const [streamMode, setStreamMode] = useState<'creators' | 'posts'>('creators');
  const [streamCreators, setStreamCreators] = useState<PawchiveCreator[]>([]);
  const [creatorPage, setCreatorPage] = useState(1);
  const [creatorHasMore, setCreatorHasMore] = useState(true);
  const [loadingMoreCreators, setLoadingMoreCreators] = useState(false);

  const [streamPosts, setStreamPosts] = useState<PawchivePostSummary[]>([]);
  const [postOffset, setPostOffset] = useState(0);
  const [postHasMore, setPostHasMore] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);

  const creatorsRailRef = useRef<HTMLDivElement | null>(null);
  const postsRailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setInitialLoading(true);

    Promise.allSettled([
      pawchiveService.getCreators({ sort: 'favorited', page: 1, pageSize: 18 }),
      pawchiveService.getRecentPosts({ o: 0 }),
    ])
      .then(([catRes, postsRes]) => {
        if (!active) return;
        if (catRes.status === 'fulfilled') {
          const items = catRes.value.items || [];
          setFeaturedCreators(items.slice(0, 12));
          setStreamCreators(items);
          setCreatorPage(1);
          setCreatorHasMore(catRes.value.page < catRes.value.totalPages);
        }
        if (postsRes.status === 'fulfilled' && Array.isArray(postsRes.value)) {
          const list = postsRes.value;
          setRecentPosts(list.slice(0, 14));
          setStreamPosts(list);
          setPostOffset(0);
          setPostHasMore(list.length >= 50);
        }
      })
      .finally(() => {
        if (active) setInitialLoading(false);
      });

    return () => {
      active = false;
    };
  }, [refreshSignal]);

  const spotlightCandidates = recentPosts.filter((p) => buildThumbnailUrl(p.file)).slice(0, 6);
  const spotlightPost = spotlightCandidates[spotlightIndex % Math.max(1, spotlightCandidates.length)] || recentPosts[0];

  useEffect(() => {
    if (spotlightCandidates.length <= 1) return;
    const timer = window.setInterval(() => {
      setSpotlightIndex((i) => (i + 1) % spotlightCandidates.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [spotlightCandidates.length]);

  const loadMoreCreators = useCallback(() => {
    if (loadingMoreCreators || !creatorHasMore) return;
    const nextPage = creatorPage + 1;
    setLoadingMoreCreators(true);
    pawchiveService
      .getCreators({ sort: 'favorited', page: nextPage, pageSize: 18 })
      .then((res) => {
        setStreamCreators((prev) => {
          const seen = new Set(prev.map((c) => `${c.service}:${c.id}`));
          const added = (res.items || []).filter((c) => !seen.has(`${c.service}:${c.id}`));
          return [...prev, ...added];
        });
        setCreatorPage(nextPage);
        setCreatorHasMore(res.page < res.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoadingMoreCreators(false));
  }, [creatorPage, creatorHasMore, loadingMoreCreators]);

  const loadMorePosts = useCallback(() => {
    if (loadingMorePosts || !postHasMore) return;
    const nextOffset = postOffset + 50;
    setLoadingMorePosts(true);
    pawchiveService
      .getRecentPosts({ o: nextOffset })
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setStreamPosts((prev) => {
          const seen = new Set(prev.map((p) => `${p.service}:${p.user}:${p.id}`));
          const added = list.filter((p) => !seen.has(`${p.service}:${p.user}:${p.id}`));
          return [...prev, ...added];
        });
        setPostOffset(nextOffset);
        setPostHasMore(list.length >= 50);
      })
      .catch(() => {})
      .finally(() => setLoadingMorePosts(false));
  }, [postOffset, postHasMore, loadingMorePosts]);

  const scrollRail = (ref: React.RefObject<HTMLDivElement | null>, dir: -1 | 1) => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir * 360, behavior: 'smooth' });
  };

  return (
    <div className="space-y-9">
      {/* Smart Search Bar + Quick Access */}
      <section className="motion-blur-in relative z-30 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SmartSearchBar
            value={smartQuery}
            onChange={setSmartQuery}
            onSelectCreator={onOpenCreator}
            onSubmitSearch={(q) => onQuickSearch(q, 'creators')}
            placeholder="Busca inteligente: digite o nome do criador e veja sugestões em tempo real..."
          />
        </div>
        <button
          type="button"
          onClick={onOpenImporter}
          className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-2.5 text-xs font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white hover:text-black"
        >
          <UploadCloud className="h-4 w-4" />
          Importar Criadores
        </button>
      </section>

      {/* Netflix-Style Cinematic Billboard */}
      <section className="liquid-glass motion-blur-in relative overflow-hidden rounded-3xl">
        <div className="relative min-h-[340px] sm:min-h-[410px] w-full">
          {spotlightPost ? (
            <SmartImage
              src={buildThumbnailUrl(spotlightPost.file) || heroObsidianBg}
              alt={spotlightPost.title || 'Destaque SpaceX'}
              blur={blurThumbnails}
              className="absolute inset-0 h-full w-full"
            />
          ) : (
            <img
              src={heroObsidianBg}
              alt="SpaceX Black Piano"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}

          {/* Cinematic Contrast Scrim */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#020203] via-[#020203]/80 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#020203] via-transparent to-[#020203]/30" />

          <div className="relative z-10 flex min-h-[340px] sm:min-h-[410px] flex-col justify-end p-6 sm:p-10 lg:max-w-2xl">
            {spotlightPost ? (
              <>
                <p className="text-xs font-semibold tracking-wide text-sky-300">
                  Em Destaque · {getServiceLabel(spotlightPost.service)} ·{' '}
                  {formatDatePtBr(spotlightPost.published)}
                </p>
                <h1 className="mt-2 font-display text-2xl font-bold leading-tight text-white sm:text-4xl text-balance line-clamp-2">
                  {spotlightPost.title || `Publicação #${spotlightPost.id}`}
                </h1>
                <p className="mt-2.5 line-clamp-2 text-sm text-slate-200">
                  {stripHtml(spotlightPost.substring) ||
                    `Publicado por ${spotlightPost.creator_name || `Criador #${spotlightPost.user}`}`}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenPost(spotlightPost)}
                    className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.02] hover:bg-slate-200"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    {isVideoFile(spotlightPost.file) ? 'Assistir Preview MP4' : 'Abrir Publicação'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenCreator(spotlightPost.service, spotlightPost.user)}
                    className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl border border-white/20 bg-black/50 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-xl transition-colors hover:bg-white/15"
                  >
                    <User className="h-4 w-4" />
                    {spotlightPost.creator_name || 'Ver Criador'}
                  </button>

                  <button
                    type="button"
                    onClick={() => onTogglePostFavorite(spotlightPost)}
                    aria-label="Favoritar destaque"
                    className={`inline-flex h-[44px] w-[44px] items-center justify-center rounded-xl border backdrop-blur-xl transition-colors ${
                      isPostFavorite(spotlightPost.service, spotlightPost.user, spotlightPost.id)
                        ? 'border-rose-400/50 bg-rose-500/30 text-rose-200'
                        : 'border-white/20 bg-black/50 text-white hover:bg-white/15'
                    }`}
                  >
                    <Heart
                      className={`h-4 w-4 ${
                        isPostFavorite(spotlightPost.service, spotlightPost.user, spotlightPost.id) ? 'fill-current' : ''
                      }`}
                    />
                  </button>
                </div>
              </>
            ) : (
              <div>
                <h1 className="font-display text-3xl font-bold text-white sm:text-5xl">SpaceX</h1>
                <p className="mt-2 text-sm text-slate-200">
                  Carregando destaques ao vivo da plataforma...
                </p>
              </div>
            )}
          </div>

          {spotlightCandidates.length > 1 && (
            <div className="absolute bottom-5 right-5 z-20 hidden sm:flex items-center gap-1.5">
              {spotlightCandidates.map((item, idx) => (
                <button
                  key={`${item.service}-${item.id}`}
                  type="button"
                  onClick={() => setSpotlightIndex(idx)}
                  aria-label={`Destaque ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === spotlightIndex % spotlightCandidates.length
                      ? 'w-7 bg-white'
                      : 'w-2.5 bg-white/35 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Horizontal Streaming Rail 1: Criadores em Alta */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-white sm:text-xl">
            Criadores em Alta
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollRail(creatorsRailRef, -1)}
              aria-label="Rolar criadores para a esquerda"
              className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/15"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollRail(creatorsRailRef, 1)}
              aria-label="Rolar criadores para a direita"
              className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/15"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('criadores')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-white"
            >
              Ver todos
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div
          ref={creatorsRailRef}
          className="rail-scroll flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        >
          {initialLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="liquid-glass h-56 w-[260px] shrink-0 rounded-2xl p-4 space-y-3">
                  <div className="skeleton-glass h-20 w-full rounded-xl" />
                  <div className="skeleton-glass h-5 w-2/3 rounded" />
                  <div className="skeleton-glass h-9 w-full rounded-xl" />
                </div>
              ))
            : featuredCreators.map((creator) => (
                <div key={`${creator.service}-${creator.id}`} className="w-[265px] shrink-0 snap-start">
                  <CreatorCard
                    creator={creator}
                    isFavorite={isCreatorFavorite(creator.service, creator.id)}
                    onOpenProfile={onOpenCreator}
                    onToggleFavorite={onToggleCreatorFavorite}
                  />
                </div>
              ))}
        </div>
      </section>

      {/* Horizontal Streaming Rail 2: Publicações Recentes */}
      <section className="space-y-3.5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-white sm:text-xl">
            Lançamentos Recentes
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollRail(postsRailRef, -1)}
              aria-label="Rolar publicações para a esquerda"
              className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/15"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollRail(postsRailRef, 1)}
              aria-label="Rolar publicações para a direita"
              className="hidden sm:inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/15"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('publicacoes')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-300 hover:text-white"
            >
              Ver feed
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div
          ref={postsRailRef}
          className="rail-scroll flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        >
          {initialLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="liquid-glass h-56 w-[290px] shrink-0 rounded-2xl overflow-hidden">
                  <div className="skeleton-glass h-40 w-full" />
                  <div className="p-3"><div className="skeleton-glass h-4 w-2/3 rounded" /></div>
                </div>
              ))
            : recentPosts.map((post) => (
                <div key={`${post.service}-${post.user}-${post.id}`} className="w-[295px] shrink-0 snap-start">
                  <PostCard
                    post={post}
                    blurThumbnail={blurThumbnails}
                    isFavorite={isPostFavorite(post.service, post.user, post.id)}
                    onOpenPost={onOpenPost}
                    onOpenCreator={onOpenCreator}
                    onToggleFavorite={onTogglePostFavorite}
                  />
                </div>
              ))}
        </div>
      </section>

      {/* Infinite Scroll Discovery Feed right on Home */}
      <section className="space-y-5 pt-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
              Exploração Contínua
            </h2>
            <p className="text-xs text-slate-300">
              Role para baixo para carregar automaticamente mais criadores e publicações sem parar.
            </p>
          </div>

          <div className="flex items-center gap-1 self-start rounded-xl border border-white/10 bg-white/[0.04] p-1">
            <button
              type="button"
              onClick={() => setStreamMode('creators')}
              className={`min-h-[36px] whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                streamMode === 'creators' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
              }`}
            >
              Criadores Infinitos
            </button>
            <button
              type="button"
              onClick={() => setStreamMode('posts')}
              className={`min-h-[36px] whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                streamMode === 'posts' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
              }`}
            >
              Publicações Infinitas
            </button>
          </div>
        </div>

        {streamMode === 'creators' ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {streamCreators.map((creator) => (
                <CreatorCard
                  key={`home-${creator.service}-${creator.id}`}
                  creator={creator}
                  isFavorite={isCreatorFavorite(creator.service, creator.id)}
                  onOpenProfile={onOpenCreator}
                  onToggleFavorite={onToggleCreatorFavorite}
                />
              ))}
            </div>
            <InfiniteScrollSentinel
              hasMore={creatorHasMore}
              loading={loadingMoreCreators}
              onLoadMore={loadMoreCreators}
              itemCount={streamCreators.length}
              label="criadores carregados"
            />
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {streamPosts.map((post) => (
                <PostCard
                  key={`home-${post.service}-${post.user}-${post.id}`}
                  post={post}
                  blurThumbnail={blurThumbnails}
                  isFavorite={isPostFavorite(post.service, post.user, post.id)}
                  onOpenPost={onOpenPost}
                  onOpenCreator={onOpenCreator}
                  onToggleFavorite={onTogglePostFavorite}
                />
              ))}
            </div>
            <InfiniteScrollSentinel
              hasMore={postHasMore}
              loading={loadingMorePosts}
              onLoadMore={loadMorePosts}
              itemCount={streamPosts.length}
              label="publicações carregadas"
            />
          </>
        )}
      </section>
    </div>
  );
}
