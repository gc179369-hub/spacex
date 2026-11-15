import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import type { PawchiveCreator } from '../types/spacex';
import { getServiceLabel, pawchiveService } from '../services/pawchiveService';
import { CreatorCard } from './CreatorCard';
import { SmartSearchBar } from './SmartSearchBar';
import { InfiniteScrollSentinel } from './InfiniteScrollSentinel';
import { useToast } from '../hooks/useToast';

interface CreatorsDirectoryProps {
  defaultSort: 'favorited' | 'updated' | 'indexed' | 'name';
  defaultPageSize: number;
  isFavorite: (service: string, id: string) => boolean;
  onToggleFavorite: (creator: PawchiveCreator) => void;
  onOpenProfile: (service: string, id: string) => void;
  onRecordSearch: (term: string) => void;
}

export function CreatorsDirectory({
  defaultSort,
  defaultPageSize,
  isFavorite,
  onToggleFavorite,
  onOpenProfile,
  onRecordSearch,
}: CreatorsDirectoryProps) {
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [service, setService] = useState('all');
  const [sort, setSort] = useState<'favorited' | 'updated' | 'indexed' | 'name' | 'relevance'>(defaultSort);

  const [items, setItems] = useState<PawchiveCreator[]>([]);
  const [services, setServices] = useState<Record<string, number>>({ patreon: 0, fanbox: 0 });
  const [total, setTotal] = useState(0);
  const [totalCatalog, setTotalCatalog] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const clean = query.trim();
      setDebouncedQuery(clean);
      if (clean.length >= 2) onRecordSearch(clean);
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  const fetchFirstPage = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await pawchiveService.getCreators({
          q: debouncedQuery || undefined,
          service,
          sort: debouncedQuery ? 'relevance' : sort,
          smart: Boolean(debouncedQuery),
          page: 1,
          pageSize: defaultPageSize,
          refresh: forceRefresh,
        });
        setItems(res.items || []);
        setServices(res.services || { patreon: 0, fanbox: 0 });
        setTotal(res.total || 0);
        setTotalCatalog(res.totalCatalog || 0);
        setPage(1);
        setHasMore(res.page < res.totalPages);
        if (forceRefresh) showToast('Catálogo de criadores atualizado.', 'success');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar criadores.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [debouncedQuery, service, sort, defaultPageSize, showToast]
  );

  useEffect(() => {
    fetchFirstPage(false);
  }, [fetchFirstPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);

    pawchiveService
      .getCreators({
        q: debouncedQuery || undefined,
        service,
        sort: debouncedQuery ? 'relevance' : sort,
        smart: Boolean(debouncedQuery),
        page: nextPage,
        pageSize: defaultPageSize,
      })
      .then((res) => {
        setItems((prev) => {
          const seen = new Set(prev.map((c) => `${c.service}:${c.id}`));
          const added = (res.items || []).filter((c) => !seen.has(`${c.service}:${c.id}`));
          return [...prev, ...added];
        });
        setPage(nextPage);
        setHasMore(res.page < res.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loading, loadingMore, hasMore, page, debouncedQuery, service, sort, defaultPageSize]);

  const availableServices = Object.keys(services);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Criadores
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Busca inteligente em tempo real com rolagem infinita em todo o catálogo.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchFirstPage(true)}
          disabled={refreshing}
          className="inline-flex min-h-[40px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar catálogo
        </button>
      </div>

      {/* Smart Search & Filters */}
      <div className="liquid-glass relative z-20 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <SmartSearchBar
              value={query}
              onChange={setQuery}
              serviceFilter={service}
              onSelectCreator={onOpenProfile}
              placeholder="Digite as primeiras letras do criador, ID ou @public_id..."
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/50 p-1 lg:col-span-4">
            <button
              type="button"
              onClick={() => setService('all')}
              className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${
                service === 'all' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
              }`}
            >
              Todos
            </button>
            {availableServices.map((svc) => (
              <button
                key={svc}
                type="button"
                onClick={() => setService(svc)}
                className={`min-h-[38px] shrink-0 whitespace-nowrap rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  service === svc ? 'bg-white text-black' : 'text-white/80 hover:text-white'
                }`}
              >
                {getServiceLabel(svc)}
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            <select
              aria-label="Ordenar criadores"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-black/70 px-3.5 text-sm text-white focus:border-sky-400/50 focus:outline-none"
            >
              <option value="favorited">Mais favoritados</option>
              <option value="updated">Mais recentes</option>
              <option value="indexed">Indexação</option>
              <option value="name">Nome A–Z</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5 text-xs text-slate-300">
          <span className="font-mono-tabular">
            {new Intl.NumberFormat('pt-BR').format(total)} correspondências (de{' '}
            {new Intl.NumberFormat('pt-BR').format(totalCatalog)} criadores)
          </span>
          <span className="font-mono-tabular text-sky-300">
            Exibindo {items.length} · Rolagem infinita ativa
          </span>
        </div>
      </div>

      {error && (
        <div className="liquid-glass flex items-start gap-3 rounded-2xl border-rose-500/30 p-5 text-sm text-rose-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <div className="flex-1">
            <p className="font-semibold">Falha ao consultar criadores</p>
            <p className="mt-0.5 text-slate-200">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchFirstPage(true)}
            className="rounded-xl bg-white/15 px-3.5 py-2 text-xs font-medium text-white hover:bg-white/25"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="liquid-glass rounded-2xl p-4 space-y-3">
              <div className="skeleton-glass h-20 w-full rounded-xl" />
              <div className="skeleton-glass h-5 w-2/3 rounded" />
              <div className="skeleton-glass h-9 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="liquid-glass rounded-2xl p-10 text-center">
          <p className="font-display text-lg font-medium text-white">Nenhum criador encontrado</p>
          <p className="mt-1 text-sm text-slate-300">
            Tente digitar outras letras ou limpar o filtro de plataforma.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((creator) => (
              <CreatorCard
                key={`${creator.service}-${creator.id}`}
                creator={creator}
                isFavorite={isFavorite(creator.service, creator.id)}
                onOpenProfile={onOpenProfile}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>

          <InfiniteScrollSentinel
            hasMore={hasMore}
            loading={loadingMore}
            onLoadMore={loadMore}
            itemCount={items.length}
            label="criadores exibidos"
          />
        </>
      )}
    </section>
  );
}
