import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Heart,
  Image as ImageIcon,
  Link2,
  Megaphone,
  Search,
  Tag,
} from 'lucide-react';
import type {
  PawchiveAnnouncement,
  PawchiveCreator,
  PawchiveCreatorProfile,
  PawchiveFancard,
  PawchivePostSummary,
  PawchiveTag,
} from '../types/spacex';
import {
  buildCreatorAvatarUrl,
  buildCreatorBannerUrl,
  buildMediaProxyUrl,
  formatBytes,
  formatDatePtBr,
  getServiceLabel,
  pawchiveService,
} from '../services/pawchiveService';
import { SmartImage } from './SmartImage';
import { PostCard } from './PostCard';
import { InfiniteScrollSentinel } from './InfiniteScrollSentinel';

interface CreatorProfileViewProps {
  service: string;
  creatorId: string;
  blurThumbnails: boolean;
  isCreatorFavorite: (service: string, id: string) => boolean;
  isPostFavorite: (service: string, creatorId: string, postId: string) => boolean;
  onToggleCreatorFavorite: (creator: PawchiveCreator) => void;
  onTogglePostFavorite: (post: PawchivePostSummary) => void;
  onOpenCreator: (service: string, creatorId: string) => void;
  onOpenPost: (post: PawchivePostSummary) => void;
  onBack: () => void;
}

export function CreatorProfileView({
  service,
  creatorId,
  blurThumbnails,
  isCreatorFavorite,
  isPostFavorite,
  onToggleCreatorFavorite,
  onTogglePostFavorite,
  onOpenCreator,
  onOpenPost,
  onBack,
}: CreatorProfileViewProps) {
  const [profile, setProfile] = useState<PawchiveCreatorProfile | null>(null);
  const [posts, setPosts] = useState<PawchivePostSummary[]>([]);
  const [tags, setTags] = useState<PawchiveTag[]>([]);
  const [links, setLinks] = useState<PawchiveCreatorProfile[]>([]);
  const [announcements, setAnnouncements] = useState<PawchiveAnnouncement[]>([]);
  const [fancards, setFancards] = useState<PawchiveFancard[]>([]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<'publicacoes' | 'comunicados' | 'fancards'>('publicacoes');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    let active = true;
    setLoadingProfile(true);
    setError(null);
    setTab('publicacoes');
    setSearchQuery('');
    setDebouncedQuery('');
    setSelectedTag('');
    setOffset(0);

    Promise.allSettled([
      pawchiveService.getCreatorProfile(service, creatorId),
      pawchiveService.getCreatorTags(service, creatorId),
      pawchiveService.getCreatorLinks(service, creatorId),
      pawchiveService.getCreatorAnnouncements(service, creatorId),
      pawchiveService.getCreatorFancards(service, creatorId),
    ])
      .then(([profRes, tagRes, linkRes, annRes, fcRes]) => {
        if (!active) return;
        if (profRes.status === 'fulfilled') {
          setProfile(profRes.value);
        } else {
          setError(profRes.reason instanceof Error ? profRes.reason.message : 'Criador não encontrado.');
        }
        setTags(tagRes.status === 'fulfilled' && Array.isArray(tagRes.value) ? tagRes.value : []);
        setLinks(linkRes.status === 'fulfilled' && Array.isArray(linkRes.value) ? linkRes.value : []);
        setAnnouncements(annRes.status === 'fulfilled' && Array.isArray(annRes.value) ? annRes.value : []);
        setFancards(fcRes.status === 'fulfilled' && Array.isArray(fcRes.value) ? fcRes.value : []);
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, [service, creatorId]);

  useEffect(() => {
    let active = true;
    setLoadingPosts(true);
    setOffset(0);
    pawchiveService
      .getCreatorPosts(service, creatorId, {
        q: debouncedQuery || undefined,
        tag: selectedTag || undefined,
        o: 0,
      })
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res) ? res : [];
        setPosts(list);
        setHasMore(list.length >= 50);
      })
      .catch((err) => {
        if (!active) return;
        setPosts([]);
        setHasMore(false);
        if (!error) setError(err instanceof Error ? err.message : 'Falha ao carregar publicações.');
      })
      .finally(() => {
        if (active) setLoadingPosts(false);
      });

    return () => {
      active = false;
    };
  }, [service, creatorId, debouncedQuery, selectedTag]);

  const loadMore = useCallback(() => {
    if (loadingPosts || loadingMore || !hasMore) return;
    const nextOffset = offset + 50;
    setLoadingMore(true);

    pawchiveService
      .getCreatorPosts(service, creatorId, {
        q: debouncedQuery || undefined,
        tag: selectedTag || undefined,
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
  }, [loadingPosts, loadingMore, hasMore, offset, service, creatorId, debouncedQuery, selectedTag]);

  const avatarUrl = buildCreatorAvatarUrl(service, creatorId);
  const bannerUrl = buildCreatorBannerUrl(service, creatorId);
  const favActive = isCreatorFavorite(service, creatorId);
  const totalTaggedPosts = tags.reduce((acc, t) => acc + (t.post_count || 0), 0);

  const creatorEntity: PawchiveCreator = {
    id: creatorId,
    name: profile?.name || `Criador #${creatorId}`,
    public_id: profile?.public_id || null,
    service,
    indexed: profile?.indexed ? Math.floor(new Date(profile.indexed).getTime() / 1000) : 0,
    updated: profile?.updated ? Math.floor(new Date(profile.updated).getTime() / 1000) : 0,
    favorited: 0,
    ever_imported: Boolean(profile?.ever_imported),
  };

  return (
    <section className="motion-blur-in space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/15"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>

        <span className="font-mono-tabular text-xs text-slate-300">
          {getServiceLabel(service)} · ID {creatorId}
        </span>
      </div>

      {error && !profile && (
        <div className="liquid-glass flex items-start gap-3 rounded-2xl border-rose-500/30 p-5 text-sm text-rose-100">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
          <div>
            <p className="font-semibold">Erro ao carregar perfil do criador</p>
            <p className="mt-1 text-slate-200">{error}</p>
          </div>
        </div>
      )}

      {/* Creator Hero Banner */}
      <div className="liquid-glass overflow-hidden rounded-3xl">
        <div className="relative h-44 sm:h-56 w-full bg-[#050608]">
          <SmartImage
            src={bannerUrl}
            alt={`Banner de ${profile?.name || creatorId}`}
            fallbackLabel={profile?.name || getServiceLabel(service)}
            blur={blurThumbnails}
            className="h-full w-full"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08090d] via-[#08090d]/45 to-transparent" />
        </div>

        <div className="relative px-5 pb-6 sm:px-8">
          <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <SmartImage
                src={avatarUrl}
                alt={`Avatar de ${profile?.name || creatorId}`}
                fallbackLabel={profile?.name || creatorId}
                isAvatar
                className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-2xl border-2 border-[#020203] shadow-2xl"
              />
              <div className="min-w-0 pb-1">
                {loadingProfile ? (
                  <div className="space-y-2">
                    <div className="skeleton-glass h-7 w-48 rounded" />
                    <div className="skeleton-glass h-4 w-32 rounded" />
                  </div>
                ) : (
                  <>
                    <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white truncate">
                      {profile?.name || `Criador #${creatorId}`}
                    </h1>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-slate-200">
                      <span className="text-sky-300 font-semibold">{getServiceLabel(service)}</span>
                      <span aria-hidden="true" className="text-slate-500">·</span>
                      <span className="font-mono-tabular">ID {creatorId}</span>
                      {profile?.public_id && (
                        <>
                          <span aria-hidden="true" className="text-slate-500">·</span>
                          <span className="font-mono-tabular">@{profile.public_id}</span>
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onToggleCreatorFavorite(creatorEntity)}
              className={`inline-flex min-h-[42px] items-center justify-center gap-2 whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                favActive
                  ? 'border border-rose-400/50 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30'
                  : 'bg-white text-black hover:bg-slate-200'
              }`}
            >
              <Heart className={`h-4 w-4 ${favActive ? 'fill-current' : ''}`} />
              {favActive ? 'Favoritado' : 'Favoritar criador'}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-white/[0.08] pt-5 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-400">Indexação na API</p>
              <p className="mt-1 font-mono-tabular text-sm font-medium text-white">
                {formatDatePtBr(profile?.indexed)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Última atualização</p>
              <p className="mt-1 font-mono-tabular text-sm font-medium text-white">
                {formatDatePtBr(profile?.updated)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Publicações carregadas</p>
              <p className="mt-1 font-mono-tabular text-sm font-medium text-white">
                {posts.length} publicações {totalTaggedPosts > 0 ? `· ${tags.length} categorias` : ''}
              </p>
            </div>
          </div>

          {links.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-4 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-white">
                <Link2 className="h-3.5 w-3.5 text-sky-300" />
                Contas vinculadas:
              </span>
              {links.map((lk) => (
                <button
                  key={`${lk.service}-${lk.id}`}
                  type="button"
                  onClick={() => onOpenCreator(lk.service, lk.id)}
                  className="rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1 text-white transition-colors hover:border-sky-400/50 hover:bg-white/15"
                >
                  {lk.name} ({getServiceLabel(lk.service)})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setTab('publicacoes')}
            className={`min-h-[38px] whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === 'publicacoes' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
            }`}
          >
            Publicações
          </button>
          <button
            type="button"
            onClick={() => setTab('comunicados')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
              tab === 'comunicados' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
            }`}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Comunicados ({announcements.length})
          </button>
          {service.toLowerCase() === 'fanbox' && (
            <button
              type="button"
              onClick={() => setTab('fancards')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-medium transition-colors ${
                tab === 'fancards' ? 'bg-white text-black' : 'text-white/80 hover:text-white'
              }`}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Fancards ({fancards.length})
            </button>
          )}
        </div>

        {tab === 'publicacoes' && (
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSelectedTag('');
                setSearchQuery(e.target.value);
              }}
              placeholder="Filtrar publicações do criador..."
              className="min-h-[42px] w-full rounded-xl border border-white/10 bg-black/70 pl-10 pr-3.5 text-sm text-white placeholder:text-slate-400 focus:border-sky-400/50 focus:outline-none"
            />
          </div>
        )}
      </div>

      {tab === 'publicacoes' && tags.length > 0 && (
        <div className="liquid-glass-subtle flex items-center gap-2 overflow-x-auto rounded-xl px-4 py-2.5">
          <Tag className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          <button
            type="button"
            onClick={() => setSelectedTag('')}
            className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              selectedTag === '' ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            Todas
          </button>
          {tags.slice(0, 30).map((t) => (
            <button
              key={t.tag}
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTag(t.tag === selectedTag ? '' : t.tag);
              }}
              className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedTag === t.tag ? 'bg-white text-black' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              {t.tag} <span className="font-mono-tabular opacity-75">({t.post_count})</span>
            </button>
          ))}
        </div>
      )}

      {tab === 'publicacoes' && (
        <div>
          {loadingPosts ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="liquid-glass overflow-hidden rounded-2xl">
                  <div className="skeleton-glass aspect-[16/10] w-full" />
                  <div className="space-y-2 p-4">
                    <div className="skeleton-glass h-4 w-3/4 rounded" />
                    <div className="skeleton-glass h-3 w-1/2 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="liquid-glass rounded-2xl p-10 text-center">
              <p className="font-display text-lg font-medium text-white">Nenhuma publicação encontrada</p>
              <p className="mt-1 text-sm text-slate-300">
                Ajuste o filtro de busca ou selecione outra categoria deste criador.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {posts.map((p) => (
                  <PostCard
                    key={`${p.service}-${p.user}-${p.id}`}
                    post={{ ...p, creator_name: p.creator_name || profile?.name }}
                    blurThumbnail={blurThumbnails}
                    isFavorite={isPostFavorite(p.service, p.user, p.id)}
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
                itemCount={posts.length}
                label="publicações do criador"
              />
            </>
          )}
        </div>
      )}

      {tab === 'comunicados' && (
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <div className="liquid-glass rounded-2xl p-8 text-center text-sm text-slate-300">
              Nenhum comunicado oficial disponível para este criador.
            </div>
          ) : (
            announcements.map((a) => (
              <div key={a.hash} className="liquid-glass rounded-2xl p-5">
                <p className="font-mono-tabular text-xs text-slate-300">{formatDatePtBr(a.added)}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-white">{a.content}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'fancards' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fancards.length === 0 ? (
            <div className="liquid-glass col-span-full rounded-2xl p-8 text-center text-sm text-slate-300">
              Nenhum Fancard encontrado para este criador Fanbox.
            </div>
          ) : (
            fancards.map((fc) => {
              const path = `/${fc.hash.slice(0, 2)}/${fc.hash.slice(2, 4)}/${fc.hash}${fc.ext}`;
              const url = buildMediaProxyUrl(`https://img.pawchive.pw/thumbnail/data${path}`);
              return (
                <div key={fc.id} className="liquid-glass overflow-hidden rounded-2xl">
                  <SmartImage
                    src={url}
                    alt={`Fancard ${fc.id}`}
                    blur={blurThumbnails}
                    className="aspect-[4/3] w-full"
                  />
                  <div className="flex items-center justify-between p-4 text-xs text-slate-300">
                    <span className="font-mono-tabular">#{fc.file_id}</span>
                    <span className="font-mono-tabular">{formatBytes(fc.size)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
