import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, RefreshCw, Search } from 'lucide-react';
import type { PawchivePostSummary } from '../types/spacex';
import { getServiceLabel, pawchiveService } from '../services/pawchiveService';
import { PostCard } from './PostCard';
import { InfiniteScrollSentinel } from './InfiniteScrollSentinel';
import { useToast } from '../hooks/useToast';

interface PublicationsFeedProps {
  blurThumbnails: boolean;
  isPostFavorite: (service: string, creatorId: string, postId: string) => boolean;
  onTogglePostFavorite: (post: PawchivePostSummary) => void;
  onOpenPost: (post: PawchivePostSummary) => void;
  onOpenCreator: (service: string, creatorId: string) => void;
  onRecordSearch: (term: string) => void;
}

export function PublicationsFeed({
  blurThumbnails,
  isPostFavorite,
  onTogglePostFavorite,
  onOpenPost,
  onOpenCreator,
  onRecordSearch,
}: PublicationsFeedProps) {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('all');

  const [posts, setPosts] = useState<PawchivePostSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      const clean = query.trim();
      setDebouncedQuery(clean);
      if (clean.length >= 2) onRecordSearch(clean);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const loadInitial = useCallback(
    async (refresh = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await pawchiveService.getRecentPosts({
          q: debouncedQuery || undefined,
          o: 0,
          refresh,
        });
        const list = Array.isArray(res) ? res : [];
        setPosts(list);
        setOffset(0);
        setHasMore(list.length >= 50);
        if (refresh) showToast('Feed atualizado.', 'success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar publicações.');
      } finally {
        setLoading(false);
      }
    },
    [debouncedQuery, showToast]
  );

  useEffect(() => {
    loadInitial(false);
  }, [loadInitial]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    const nextOffset = offset + 50;
    setLoadingMore(true);

    pawchiveService
      .getRecentPosts({
        q: debouncedQuery || undefined,
        o: nextOffset,
      })
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => `${p.service}:${p.user}:${p.id}`));
          const added = list.filter((p) => !seen.has(`${p.service}:${p.user}:${p.id}`));
          return [...prev, ...added];
        });
        setOffset(nextOffset);
        setHasMore(list.length >= 50);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loading, loadingMore, hasMore, offset, debouncedQuery]);

  const servicesInFeed = useMemo(() => {
    const s = new Set<string>();
    posts.forEach((p) => {
      if (p.service) s.add(p.service);
    });
    return Array.from(s);
  }, [posts]);

  const visiblePosts = useMemo(() => {
    if (serviceFilter === 'all') return posts;
    return posts.filter((p) => p.service.toLowerCase() === serviceFilter.toLowerCase());
  }, [posts, serviceFilter]);

  return (
    <section className="motion-blur-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Publicações
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Feed contínuo com player MP4 nativo, visualizador de imagens e downloads individuais.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadInitial(true)}
          disabled={loading}
          className="inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar feed
        </button>
      </div>

      {/* Search & Service Filter */}
      <div className="liquid-glass rounded-2xl p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar publicações por título, tema ou termo..."
              className="min-h-[46px] w-full rounded-2xl border border-white/10 bg-black/70 pl-11 pr-4 text-sm text-white placeholder:text-slate-400 focus:border-sky-400/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/50 p-1">
            <button
              type="button"
              onClick={() => setServiceFilter('all')}
              className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${
                serviceFilter === 'all' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
              }`}
            >
              Todas ({posts.length})
            </button>
            {servicesInFeed.map((svc) => (
              <button
                key={svc}
                type="button"
                onClick={() => setServiceFilter(svc)}
                className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  serviceFilter === svc ? 'bg-white text-black' : 'text-white/80 hover:text-white'
                }`}
              >
                {getServiceLabel(svc)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="liquid-glass flex items-start gap-3 rounded-2xl border-rose-500/30 p-5 text-sm text-rose-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">Erro ao carregar publicações</p>
            <p className="mt-0.5 text-slate-200">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => loadInitial(true)}
            className="rounded-xl bg-white/15 px-3.5 py-2 text-xs font-medium text-white hover:bg-white/25"
          >
            Recarregar
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="liquid-glass overflow-hidden rounded-2xl">
              <div className="skeleton-glass aspect-[16/10] w-full" />
              <div className="space-y-2 p-4">
                <div className="skeleton-glass h-4 w-3/4 rounded" />
                <div className="skeleton-glass h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-10 text-center">
          <p className="font-display text-lg font-medium text-white">Nenhuma publicação encontrada</p>
          <p className="mt-1 text-sm text-slate-300">
            Experimente outro termo de pesquisa ou limpe o filtro de plataforma.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visiblePosts.map((post) => (
              <PostCard
                key={`${post.service}-${post.user}-${post.id}`}
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
            hasMore={hasMore}
            loading={loadingMore}
            onLoadMore={loadMore}
            itemCount={visiblePosts.length}
            label="publicações exibidas"
          />
        </>
      )}
    </section>
  );
}
