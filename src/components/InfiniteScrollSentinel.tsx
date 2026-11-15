import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

interface InfiniteScrollSentinelProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  itemCount: number;
  label?: string;
}

export function InfiniteScrollSentinel({
  hasMore,
  loading,
  onLoadMore,
  itemCount,
  label = 'itens carregados',
}: InfiniteScrollSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const callbackRef = useRef(onLoadMore);
  callbackRef.current = onLoadMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          callbackRef.current();
        }
      },
      { rootMargin: '420px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, itemCount]);

  return (
    <div ref={sentinelRef} className="flex flex-col items-center justify-center gap-3 py-8">
      {loading && (
        <div className="liquid-glass-subtle inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-xs font-medium text-white">
          <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
          <span>Carregando mais conteúdo...</span>
        </div>
      )}

      {!loading && hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          className="liquid-glass-subtle min-h-[40px] rounded-xl px-5 py-2 text-xs font-medium text-white transition-colors hover:border-white/25 hover:bg-white/10"
        >
          Carregar mais ({itemCount} {label})
        </button>
      )}

      {!hasMore && itemCount > 0 && (
        <p className="font-mono-tabular text-xs text-slate-400">
          {new Intl.NumberFormat('pt-BR').format(itemCount)} {label} no total
        </p>
      )}
    </div>
  );
}
