import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRight,
  Clock,
  FileText,
  Loader2,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { PawchiveCreator, PawchivePostSummary } from '../types/spacex';
import {
  buildCreatorAvatarUrl,
  buildThumbnailUrl,
  formatDatePtBr,
  getServiceLabel,
  pawchiveService,
} from '../services/pawchiveService';
import { SmartImage } from './SmartImage';

interface GlobalNavSearchProps {
  searchHistory: string[];
  onRecordSearch: (term: string) => void;
  onRemoveHistoryItem: (term: string) => void;
  onClearHistory: () => void;
  onSelectCreator: (service: string, id: string) => void;
  onSelectPost: (post: PawchivePostSummary) => void;
  onQuickSearch: (query: string, mode: 'creators' | 'posts') => void;
  compactMobile?: boolean;
  onCloseMobile?: () => void;
}

export function GlobalNavSearch({
  searchHistory,
  onRecordSearch,
  onRemoveHistoryItem,
  onClearHistory,
  onSelectCreator,
  onSelectPost,
  onQuickSearch,
  compactMobile = false,
  onCloseMobile,
}: GlobalNavSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<'all' | 'creators' | 'posts'>('all');
  const [loading, setLoading] = useState(false);
  const [creators, setCreators] = useState<PawchiveCreator[]>([]);
  const [creatorsTotal, setCreatorsTotal] = useState(0);
  const [posts, setPosts] = useState<PawchivePostSummary[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Cmd+K / Ctrl+K shortcut to focus global navbar search
  useEffect(() => {
    if (compactMobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [compactMobile, open]);

  // Close on click outside
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  // Debounced parallel search for creators & posts
  useEffect(() => {
    const clean = query.trim();
    if (!clean) {
      setCreators([]);
      setCreatorsTotal(0);
      setPosts([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      Promise.allSettled([
        pawchiveService.getCreators({
          q: clean,
          sort: 'relevance',
          smart: true,
          page: 1,
          pageSize: 5,
        }),
        pawchiveService.getRecentPosts({ q: clean, o: 0 }),
      ])
        .then(([creatorsRes, postsRes]) => {
          if (!active) return;
          if (creatorsRes.status === 'fulfilled') {
            setCreators(creatorsRes.value.items || []);
            setCreatorsTotal(creatorsRes.value.total || 0);
          } else {
            setCreators([]);
            setCreatorsTotal(0);
          }
          if (postsRes.status === 'fulfilled' && Array.isArray(postsRes.value)) {
            setPosts(postsRes.value.slice(0, 5));
          } else {
            setPosts([]);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const closeAll = () => {
    setOpen(false);
    onCloseMobile?.();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = query.trim();
    if (!clean) return;
    onRecordSearch(clean);
    closeAll();
    onQuickSearch(clean, scope === 'posts' ? 'posts' : 'creators');
  };

  const handleHistoryClick = (term: string) => {
    setQuery(term);
    setOpen(true);
    inputRef.current?.focus();
  };

  const cleanQuery = query.trim();
  const showHistory = open && !cleanQuery && searchHistory.length > 0;
  const showResults = open && cleanQuery.length > 0;
  const showEmptyPrompt = open && !cleanQuery && searchHistory.length === 0;

  const visibleCreators = scope === 'posts' ? [] : creators;
  const visiblePosts = scope === 'creators' ? [] : posts;

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus={compactMobile}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Buscar criadores e publicações..."
          aria-label="Busca global na plataforma"
          aria-expanded={open}
          className="h-9 w-full rounded-xl border border-white/15 bg-white/[0.05] pl-8 pr-16 text-xs text-white placeholder:text-slate-400 backdrop-blur-xl transition-all focus:border-sky-400/60 focus:bg-black/80 focus:outline-none"
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />}
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCreators([]);
                setPosts([]);
                inputRef.current?.focus();
              }}
              aria-label="Limpar busca global"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            !compactMobile && (
              <kbd className="hidden xl:inline-flex items-center rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono-tabular text-[10px] text-slate-400">
                Ctrl K
              </kbd>
            )
          )}
        </div>
      </form>

      <AnimatePresence>
        {(showHistory || showResults || showEmptyPrompt) && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className={`liquid-glass absolute top-[calc(100%+10px)] z-50 overflow-hidden rounded-2xl shadow-2xl ${
              compactMobile
                ? 'left-0 right-0'
                : 'left-1/2 w-[min(92vw,460px)] -translate-x-1/2'
            }`}
          >
            {/* Empty state without history */}
            {showEmptyPrompt && (
              <div className="p-4 text-center text-xs text-slate-300">
                Digite um nome, identificador ou tema para pesquisar criadores e publicações em toda a plataforma.
              </div>
            )}

            {/* Search History integrated */}
            {showHistory && (
              <div className="p-2.5">
                <div className="flex items-center justify-between px-2 pb-2 text-[11px] font-medium text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-sky-400" />
                    Pesquisas recentes
                  </span>
                  <button
                    type="button"
                    onClick={onClearHistory}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Trash2 className="h-3 w-3" />
                    Limpar
                  </button>
                </div>

                <ul className="max-h-[260px] space-y-0.5 overflow-y-auto">
                  {searchHistory.map((term) => (
                    <li key={term} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleHistoryClick(term)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-xs text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{term}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveHistoryItem(term)}
                        aria-label={`Remover ${term} do histórico`}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-70 transition-colors hover:bg-white/10 hover:text-white hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Live Global Results */}
            {showResults && (
              <div className="flex max-h-[72vh] flex-col">
                {/* Filter Scope Bar */}
                <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-3 py-2">
                  <div className="flex items-center gap-1">
                    {(
                      [
                        { id: 'all', label: 'Tudo' },
                        { id: 'creators', label: 'Criadores' },
                        { id: 'posts', label: 'Publicações' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setScope(tab.id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                          scope === tab.id
                            ? 'bg-white text-black'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <span className="font-mono-tabular text-[11px] text-slate-400">
                    {loading ? 'Buscando...' : `${creatorsTotal} criadores`}
                  </span>
                </div>

                <div className="overflow-y-auto p-2 space-y-3">
                  {/* Matching Creators */}
                  {visibleCreators.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3 w-3 text-sky-400" />
                          Criadores
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onRecordSearch(cleanQuery);
                            closeAll();
                            onQuickSearch(cleanQuery, 'creators');
                          }}
                          className="normal-case font-medium text-sky-300 hover:text-sky-200"
                        >
                          Ver todos
                        </button>
                      </div>
                      <ul className="space-y-0.5">
                        {visibleCreators.map((creator) => (
                          <li key={`${creator.service}-${creator.id}`}>
                            <button
                              type="button"
                              onClick={() => {
                                onRecordSearch(cleanQuery);
                                closeAll();
                                onSelectCreator(creator.service, creator.id);
                              }}
                              className="flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/10"
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                <SmartImage
                                  src={buildCreatorAvatarUrl(creator.service, creator.id)}
                                  alt={creator.name}
                                  fallbackLabel={creator.name}
                                  isAvatar
                                  className="h-8 w-8 shrink-0 rounded-full border border-white/15"
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold text-white">
                                    {creator.name}
                                  </p>
                                  <p className="truncate text-[11px] text-slate-400">
                                    <span className="text-sky-300">{getServiceLabel(creator.service)}</span>
                                    {' · '}
                                    <span className="font-mono-tabular">ID {creator.id}</span>
                                  </p>
                                </div>
                              </div>
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Matching Posts */}
                  {visiblePosts.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-sky-400" />
                          Publicações
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onRecordSearch(cleanQuery);
                            closeAll();
                            onQuickSearch(cleanQuery, 'posts');
                          }}
                          className="normal-case font-medium text-sky-300 hover:text-sky-200"
                        >
                          Ver todas
                        </button>
                      </div>
                      <ul className="space-y-0.5">
                        {visiblePosts.map((post) => {
                          const thumb = buildThumbnailUrl(post.file);
                          return (
                            <li key={`${post.service}-${post.user}-${post.id}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  onRecordSearch(cleanQuery);
                                  closeAll();
                                  onSelectPost(post);
                                }}
                                className="flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/10"
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  {thumb ? (
                                    <SmartImage
                                      src={thumb}
                                      alt={post.title || 'Publicação'}
                                      fallbackLabel={post.creator_name || post.title}
                                      className="h-9 w-12 shrink-0 rounded-lg border border-white/15 object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-400">
                                      <FileText className="h-4 w-4" />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-white">
                                      {post.title || `Publicação #${post.id}`}
                                    </p>
                                    <p className="truncate text-[11px] text-slate-400">
                                      <span>{post.creator_name || `ID ${post.user}`}</span>
                                      {' · '}
                                      <span className="font-mono-tabular">
                                        {formatDatePtBr(post.published || post.added)}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {!loading && visibleCreators.length === 0 && visiblePosts.length === 0 && (
                    <div className="px-3 py-5 text-center text-xs text-slate-300">
                      Nenhum resultado imediato para "{cleanQuery}". Pressione Enter para busca completa em Explorar.
                    </div>
                  )}
                </div>

                {/* Quick Full Search Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] bg-black/40 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      onRecordSearch(cleanQuery);
                      closeAll();
                      onQuickSearch(cleanQuery, 'creators');
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-sky-300 hover:text-sky-200"
                  >
                    <Users className="h-3 w-3" />
                    Explorar criadores "{cleanQuery}"
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRecordSearch(cleanQuery);
                      closeAll();
                      onQuickSearch(cleanQuery, 'posts');
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-200 hover:text-white"
                  >
                    <FileText className="h-3 w-3" />
                    Explorar publicações
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
