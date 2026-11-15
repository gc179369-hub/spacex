import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, Clock, FileSearch, Hash, Search, Trash2, Users } from 'lucide-react';
import type { PawchiveCreator, PawchivePostSummary } from '../types/spacex';
import { getServiceLabel, pawchiveService } from '../services/pawchiveService';
import { CreatorCard } from './CreatorCard';
import { PostCard } from './PostCard';
import { SmartSearchBar } from './SmartSearchBar';
import { InfiniteScrollSentinel } from './InfiniteScrollSentinel';

interface ExploreViewProps {
  initialQuery?: string;
  initialMode?: 'creators' | 'posts' | 'hash';
  blurThumbnails: boolean;
  searchHistory: string[];
  onRecordSearch: (term: string) => void;
  onClearHistory: () => void;
  isCreatorFavorite: (service: string, id: string) => boolean;
  isPostFavorite: (service: string, creatorId: string, postId: string) => boolean;
  onToggleCreatorFavorite: (creator: PawchiveCreator) => void;
  onTogglePostFavorite: (post: PawchivePostSummary) => void;
  onOpenCreator: (service: string, id: string) => void;
  onOpenPost: (post: PawchivePostSummary) => void;
}

export function ExploreView({
  initialQuery = '',
  initialMode = 'creators',
  blurThumbnails,
  searchHistory,
  onRecordSearch,
  onClearHistory,
  isCreatorFavorite,
  isPostFavorite,
  onToggleCreatorFavorite,
  onTogglePostFavorite,
  onOpenCreator,
  onOpenPost,
}: ExploreViewProps) {
  const [mode, setMode] = useState<'creators' | 'posts' | 'hash'>(initialMode);
  const [query, setQuery] = useState(initialQuery);
  const [service, setService] = useState('all');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creatorResults, setCreatorResults] = useState<PawchiveCreator[]>([]);
  const [creatorPage, setCreatorPage] = useState(1);
  const [creatorHasMore, setCreatorHasMore] = useState(false);

  const [postResults, setPostResults] = useState<PawchivePostSummary[]>([]);
  const [postOffset, setPostOffset] = useState(0);
  const [postHasMore, setPostHasMore] = useState(false);

  const [hashResult, setHashResult] = useState<unknown>(null);

  // Automatic live search for Creators as user types any letter
  useEffect(() => {
    if (mode !== 'creators') return;
    let active = true;
    const clean = query.trim();

    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      if (clean.length >= 2) onRecordSearch(clean);

      pawchiveService
        .getCreators({
          q: clean || undefined,
          service,
          sort: clean ? 'relevance' : 'favorited',
          smart: Boolean(clean),
          page: 1,
          pageSize: 24,
        })
        .then((res) => {
          if (!active) return;
          setCreatorResults(res.items || []);
          setCreatorPage(1);
          setCreatorHasMore(res.page < res.totalPages);
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : 'Erro ao pesquisar criadores.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 160);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [mode, query, service]);

  const runExplicitSearch = async (targetQuery = query, targetMode = mode, targetService = service) => {
    const clean = targetQuery.trim();
    if (!clean) return;
    setLoading(true);
    setError(null);
    onRecordSearch(clean);

    try {
      if (targetMode === 'posts') {
        const res = await pawchiveService.getRecentPosts({ q: clean, o: 0 });
        const list = Array.isArray(res) ? res : [];
        const filtered =
          targetService === 'all'
            ? list
            : list.filter((p) => p.service.toLowerCase() === targetService.toLowerCase());
        setPostResults(filtered);
        setPostOffset(0);
        setPostHasMore(list.length >= 50);
      } else if (targetMode === 'hash') {
        const res = await pawchiveService.searchByHash(clean);
        setHashResult(res);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao executar pesquisa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery && mode === 'posts') {
      runExplicitSearch(initialQuery, 'posts', service);
    }
  }, []);

  const loadMoreCreators = useCallback(() => {
    if (loading || loadingMore || !creatorHasMore) return;
    const nextPage = creatorPage + 1;
    const clean = query.trim();
    setLoadingMore(true);

    pawchiveService
      .getCreators({
        q: clean || undefined,
        service,
        sort: clean ? 'relevance' : 'favorited',
        smart: Boolean(clean),
        page: nextPage,
        pageSize: 24,
      })
      .then((res) => {
        setCreatorResults((prev) => {
          const seen = new Set(prev.map((c) => `${c.service}:${c.id}`));
          const added = (res.items || []).filter((c) => !seen.has(`${c.service}:${c.id}`));
          return [...prev, ...added];
        });
        setCreatorPage(nextPage);
        setCreatorHasMore(res.page < res.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loading, loadingMore, creatorHasMore, creatorPage, query, service]);

  const loadMorePosts = useCallback(() => {
    if (loading || loadingMore || !postHasMore) return;
    const nextOffset = postOffset + 50;
    const clean = query.trim();
    setLoadingMore(true);

    pawchiveService
      .getRecentPosts({ q: clean || undefined, o: nextOffset })
      .then((res) => {
        const list = Array.isArray(res) ? res : [];
        const filtered =
          service === 'all'
            ? list
            : list.filter((p) => p.service.toLowerCase() === service.toLowerCase());
        setPostResults((prev) => {
          const seen = new Set(prev.map((p) => `${p.service}:${p.user}:${p.id}`));
          const added = filtered.filter((p) => !seen.has(`${p.service}:${p.user}:${p.id}`));
          return [...prev, ...added];
        });
        setPostOffset(nextOffset);
        setPostHasMore(list.length >= 50);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loading, loadingMore, postHasMore, postOffset, query, service]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    runExplicitSearch();
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Explorar e Busca Inteligente
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          Digite para ver criadores correspondentes em tempo real, pesquise publicações ou verifique hashes SHA-256.
        </p>
      </div>

      {/* Unified Search Console */}
      <div className="liquid-glass relative z-20 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/50 p-1">
          <button
            type="button"
            onClick={() => setMode('creators')}
            className={`inline-flex min-h-[38px] items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              mode === 'creators' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Busca Inteligente (Criadores)
          </button>
          <button
            type="button"
            onClick={() => setMode('posts')}
            className={`inline-flex min-h-[38px] items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              mode === 'posts' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
            }`}
          >
            <FileSearch className="h-3.5 w-3.5" />
            Publicações
          </button>
          <button
            type="button"
            onClick={() => setMode('hash')}
            className={`inline-flex min-h-[38px] items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              mode === 'hash' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
            }`}
          >
            <Hash className="h-3.5 w-3.5" />
            Hash SHA-256
          </button>
        </div>

        {mode === 'creators' ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <SmartSearchBar
                value={query}
                onChange={setQuery}
                serviceFilter={service}
                onSelectCreator={onOpenCreator}
                autoFocus
                placeholder="Comece a digitar o nome do criador (ex.: A, Bo, Nek...) para resultados ao vivo..."
              />
            </div>
            <select
              aria-label="Filtrar plataforma"
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="min-h-[48px] rounded-2xl border border-white/10 bg-black/75 px-3.5 text-sm text-white focus:border-sky-400/50 focus:outline-none sm:w-44"
            >
              <option value="all">Todas plataformas</option>
              <option value="patreon">Patreon</option>
              <option value="fanbox">Pixiv Fanbox</option>
            </select>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  mode === 'posts'
                    ? 'Digite título, tema ou palavra-chave da publicação...'
                    : 'Cole o hash SHA-256 hexadecimal do arquivo...'
                }
                className="min-h-[48px] w-full rounded-2xl border border-white/15 bg-black/75 pl-11 pr-4 text-sm text-white placeholder:text-slate-400 focus:border-sky-400/50 focus:outline-none"
              />
            </div>

            {mode === 'posts' && (
              <select
                aria-label="Filtrar plataforma"
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="min-h-[48px] rounded-2xl border border-white/10 bg-black/75 px-3.5 text-sm text-white focus:border-sky-400/50 focus:outline-none sm:w-44"
              >
                <option value="all">Todas plataformas</option>
                <option value="patreon">Patreon</option>
                <option value="fanbox">Pixiv Fanbox</option>
              </select>
            )}

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="min-h-[48px] shrink-0 whitespace-nowrap rounded-2xl bg-white px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-slate-200 disabled:opacity-40"
            >
              {loading ? 'Pesquisando...' : 'Pesquisar'}
            </button>
          </form>
        )}

        {searchHistory.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-slate-300">
                <Clock className="h-3.5 w-3.5" />
                Recentes:
              </span>
              {searchHistory.slice(0, 8).map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setQuery(term);
                    if (mode !== 'creators') runExplicitSearch(term, mode, service);
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-white transition-colors hover:border-white/25 hover:bg-white/15"
                >
                  {term}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-rose-300"
            >
              <Trash2 className="h-3 w-3" />
              Limpar
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="liquid-glass flex items-start gap-3 rounded-2xl border-rose-500/30 p-5 text-sm text-rose-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="liquid-glass rounded-2xl p-4 space-y-3">
              <div className="skeleton-glass h-20 w-full rounded-xl" />
              <div className="skeleton-glass h-4 w-2/3 rounded" />
              <div className="skeleton-glass h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {!loading && mode === 'creators' && (
        <>
          {creatorResults.length === 0 ? (
            <div className="liquid-glass rounded-2xl p-8 text-center text-sm text-slate-300">
              Nenhum criador encontrado para "{query}". Tente outras letras.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {creatorResults.map((c) => (
                  <CreatorCard
                    key={`${c.service}-${c.id}`}
                    creator={c}
                    isFavorite={isCreatorFavorite(c.service, c.id)}
                    onOpenProfile={onOpenCreator}
                    onToggleFavorite={onToggleCreatorFavorite}
                  />
                ))}
              </div>
              <InfiniteScrollSentinel
                hasMore={creatorHasMore}
                loading={loadingMore}
                onLoadMore={loadMoreCreators}
                itemCount={creatorResults.length}
                label="criadores correspondentes"
              />
            </>
          )}
        </>
      )}

      {!loading && mode === 'posts' && postResults.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {postResults.map((p) => (
              <PostCard
                key={`${p.service}-${p.user}-${p.id}`}
                post={p}
                blurThumbnail={blurThumbnails}
                isFavorite={isPostFavorite(p.service, p.user, p.id)}
                onOpenPost={onOpenPost}
                onOpenCreator={onOpenCreator}
                onToggleFavorite={onTogglePostFavorite}
              />
            ))}
          </div>
          <InfiniteScrollSentinel
            hasMore={postHasMore}
            loading={loadingMore}
            onLoadMore={loadMorePosts}
            itemCount={postResults.length}
            label="publicações encontradas"
          />
        </>
      )}

      {!loading && mode === 'hash' && hashResult !== null && (
        <div className="liquid-glass rounded-2xl p-5 space-y-3">
          <h2 className="font-display text-base font-semibold text-white">Resultado da consulta SHA-256</h2>
          {Array.isArray(hashResult) && hashResult.length === 0 ? (
            <p className="text-sm text-slate-300">Nenhuma publicação associada a este hash foi encontrada.</p>
          ) : typeof hashResult === 'object' && 'posts' in (hashResult as Record<string, unknown>) ? (
            <div className="space-y-2">
              {((hashResult as { posts: { service: string; user: string; id: string }[] }).posts || []).map((ref) => (
                <button
                  key={`${ref.service}-${ref.user}-${ref.id}`}
                  type="button"
                  onClick={() =>
                    onOpenPost({
                      id: ref.id,
                      user: ref.user,
                      service: ref.service,
                      title: `Publicação #${ref.id}`,
                      published: '',
                    })
                  }
                  className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-left text-sm text-white hover:bg-white/15"
                >
                  <span>
                    {getServiceLabel(ref.service)} · Criador {ref.user} · Publicação {ref.id}
                  </span>
                  <span className="text-xs text-sky-300">Abrir</span>
                </button>
              ))}
            </div>
          ) : (
            <pre className="overflow-x-auto rounded-xl bg-black/60 p-4 font-mono-tabular text-xs text-slate-200">
              {JSON.stringify(hashResult, null, 2)}
            </pre>
          )}
        </div>
      )}
    </section>
  );
}
