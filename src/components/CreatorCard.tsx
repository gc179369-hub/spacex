import { ArrowUpRight, Heart } from 'lucide-react';
import type { PawchiveCreator } from '../types/spacex';
import {
  buildCreatorAvatarUrl,
  buildCreatorBannerUrl,
  formatDatePtBr,
  getServiceLabel,
} from '../services/pawchiveService';
import { SmartImage } from './SmartImage';

interface CreatorCardProps {
  creator: PawchiveCreator;
  isFavorite: boolean;
  onOpenProfile: (service: string, creatorId: string) => void;
  onToggleFavorite: (creator: PawchiveCreator) => void;
}

export function CreatorCard({
  creator,
  isFavorite,
  onOpenProfile,
  onToggleFavorite,
}: CreatorCardProps) {
  const avatarUrl = buildCreatorAvatarUrl(creator.service, creator.id);
  const bannerUrl = buildCreatorBannerUrl(creator.service, creator.id);

  return (
    <article className="liquid-glass-interactive motion-blur-in group relative flex flex-col overflow-hidden rounded-2xl">
      {/* Visual Banner Backdrop */}
      <div className="relative h-24 w-full overflow-hidden bg-[#050608]">
        <button
          type="button"
          onClick={() => onOpenProfile(creator.service, creator.id)}
          aria-label={`Abrir perfil de ${creator.name}`}
          className="block h-full w-full"
        >
          <SmartImage
            src={bannerUrl}
            alt={`Capa de ${creator.name}`}
            fallbackLabel={creator.name}
            className="h-full w-full opacity-75 transition-transform duration-300 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08090d] via-black/35 to-black/15" />
        </button>

        <button
          type="button"
          onClick={() => onToggleFavorite(creator)}
          aria-label={isFavorite ? `Remover ${creator.name} dos favoritos` : `Adicionar ${creator.name} aos favoritos`}
          className={`absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            isFavorite
              ? 'border-rose-400/50 bg-rose-500/30 text-rose-200'
              : 'border-white/15 bg-black/55 text-white hover:bg-black/80'
          }`}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Identity & Action */}
      <div className="relative flex flex-1 flex-col justify-between px-4 pb-4">
        <div>
          <div className="-mt-8 flex items-end gap-3">
            <button
              type="button"
              onClick={() => onOpenProfile(creator.service, creator.id)}
              className="shrink-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              <SmartImage
                src={avatarUrl}
                alt={`Avatar de ${creator.name}`}
                fallbackLabel={creator.name}
                isAvatar
                className="h-16 w-16 rounded-2xl border-2 border-[#050507] shadow-xl"
              />
            </button>

            <div className="min-w-0 flex-1 pb-0.5">
              <button
                type="button"
                onClick={() => onOpenProfile(creator.service, creator.id)}
                className="block w-full text-left"
              >
                <h3 className="truncate font-display text-base font-semibold text-white group-hover:text-sky-300 transition-colors">
                  {creator.name || `Criador #${creator.id}`}
                </h3>
              </button>
              <p className="truncate text-xs text-slate-300">
                <span className="text-sky-300 font-medium">{getServiceLabel(creator.service)}</span>
                <span className="mx-1.5 text-slate-500">·</span>
                <span className="font-mono-tabular">ID {creator.id}</span>
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
            <span className="font-mono-tabular">
              {new Intl.NumberFormat('pt-BR').format(creator.favorited || 0)} favoritos
            </span>
            <span className="font-mono-tabular text-slate-400">
              {formatDatePtBr(creator.updated)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenProfile(creator.service, creator.id)}
          className="mt-3.5 inline-flex min-h-[38px] w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white hover:text-black"
        >
          Explorar perfil
          <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}
