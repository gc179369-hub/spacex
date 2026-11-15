import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Loader2, Search, X } from 'lucide-react';
import type { PawchiveCreator } from '../types/spacex';
import {
  buildCreatorAvatarUrl,
  getServiceLabel,
  pawchiveService,
} from '../services/pawchiveService';
import { SmartImage } from './SmartImage';

interface SmartSearchBarProps {
  value: string;
  onChange: (next: string) => void;
  onSelectCreator: (service: string, id: string) => void;
  onSubmitSearch?: (query: string) => void;
  placeholder?: string;
  serviceFilter?: string;
  autoFocus?: boolean;
}

export function SmartSearchBar({
  value,
  onChange,
  onSelectCreator,
  onSubmitSearch,
  placeholder = 'Digite o nome ou ID do criador para busca inteligente...',
  serviceFilter = 'all',
  autoFocus = false,
}: SmartSearchBarProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PawchiveCreator[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const clean = value.trim();
    if (!clean) {
      setSuggestions([]);
      setTotalMatches(0);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      pawchiveService
        .getCreators({
          q: clean,
          service: serviceFilter,
          sort: 'relevance',
          smart: true,
          page: 1,
          pageSize: 10,
        })
        .then((res) => {
          if (!active) return;
          setSuggestions(res.items || []);
          setTotalMatches(res.total || 0);
        })
        .catch(() => {
          if (!active) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 120);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, serviceFilter]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setOpen(false);
    if (onSubmitSearch && value.trim()) {
      onSubmitSearch(value.trim());
    }
  };

  const showDropdown = open && value.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <Search className="pointer-events-none absolute left-4 h-4 w-4 text-slate-300" />
        <input
          type="text"
          value={value}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          aria-label="Busca inteligente de criadores"
          aria-expanded={showDropdown}
          className="min-h-[48px] w-full rounded-2xl border border-white/15 bg-black/70 pl-11 pr-24 text-sm text-white placeholder:text-slate-400 backdrop-blur-xl transition-colors focus:border-sky-400/70 focus:outline-none"
        />

        <div className="absolute right-2 flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-sky-400 mr-1" />}
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setSuggestions([]);
              }}
              aria-label="Limpar pesquisa"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {onSubmitSearch && (
            <button
              type="submit"
              className="min-h-[34px] rounded-xl bg-white px-3.5 text-xs font-semibold text-black transition-colors hover:bg-slate-200"
            >
              Ir
            </button>
          )}
        </div>
      </form>

      {showDropdown && (
        <div className="liquid-glass motion-blur-in absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[380px] overflow-y-auto rounded-2xl p-2 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2 text-xs text-slate-300">
            <span>
              {loading
                ? 'Buscando correspondências...'
                : `${new Intl.NumberFormat('pt-BR').format(totalMatches)} criador(es) encontrados`}
            </span>
            <span className="text-sky-300">Busca instantânea</span>
          </div>

          {!loading && suggestions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-300">
              Nenhum criador encontrado com "{value}". Tente outras letras ou ID.
            </div>
          ) : (
            <ul className="mt-1 divide-y divide-white/[0.05]">
              {suggestions.map((creator) => (
                <li key={`${creator.service}-${creator.id}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSelectCreator(creator.service, creator.id);
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/10"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <SmartImage
                        src={buildCreatorAvatarUrl(creator.service, creator.id)}
                        alt={creator.name}
                        fallbackLabel={creator.name}
                        isAvatar
                        className="h-10 w-10 shrink-0 rounded-full border border-white/15"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{creator.name}</p>
                        <p className="truncate text-xs text-slate-300">
                          <span className="text-sky-300">{getServiceLabel(creator.service)}</span>
                          <span className="mx-1.5 text-slate-500">·</span>
                          <span className="font-mono-tabular">ID {creator.id}</span>
                          {creator.public_id ? ` · @${creator.public_id}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 text-xs text-slate-300">
                      <span className="hidden sm:inline font-mono-tabular">
                        {new Intl.NumberFormat('pt-BR').format(creator.favorited || 0)} favs
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-white" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
