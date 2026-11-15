import { Heart, Paperclip, Play } from 'lucide-react';
import type { PawchivePostSummary } from '../types/spacex';
import {
  buildThumbnailUrl,
  formatDatePtBr,
  getServiceLabel,
  isVideoFile,
} from '../services/pawchiveService';
import { SmartImage } from './SmartImage';

interface PostCardProps {
  post: PawchivePostSummary;
  blurThumbnail: boolean;
  isFavorite: boolean;
  onOpenPost: (post: PawchivePostSummary) => void;
  onOpenCreator: (service: string, creatorId: string) => void;
  onToggleFavorite: (post: PawchivePostSummary) => void;
}

export function PostCard({
  post,
  blurThumbnail,
  isFavorite,
  onOpenPost,
  onOpenCreator,
  onToggleFavorite,
}: PostCardProps) {
  const thumbUrl = buildThumbnailUrl(post.file);
  const filesCount = (post.file?.path ? 1 : 0) + (post.attachments?.length || 0);
  const hasVideo =
    isVideoFile(post.file) || (post.attachments || []).some((att) => isVideoFile(att));

  return (
    <article className="liquid-glass-interactive motion-blur-in group relative flex flex-col overflow-hidden rounded-2xl">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#06070a]">
        <button
          type="button"
          onClick={() => onOpenPost(post)}
          className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <SmartImage
            src={thumbUrl}
            alt={post.title || `Publicação #${post.id}`}
            fallbackLabel={post.file?.name || getServiceLabel(post.service)}
            blur={blurThumbnail}
            className="h-full w-full transition-transform duration-300 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-black/20" />

          {hasVideo && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/55 text-white backdrop-blur-xl transition-transform duration-200 group-hover:scale-110">
                <Play className="ml-0.5 h-5 w-5 fill-white" />
              </span>
            </div>
          )}
        </button>

        {/* Top-Right Favorite Action */}
        <button
          type="button"
          onClick={() => onToggleFavorite(post)}
          aria-label={isFavorite ? 'Remover publicação dos favoritos' : 'Salvar publicação nos favoritos'}
          className={`absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
            isFavorite
              ? 'border-rose-400/50 bg-rose-500/30 text-rose-200'
              : 'border-white/15 bg-black/50 text-white hover:bg-black/75'
          }`}
        >
          <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        {/* Bottom Overlay Info (Netflix-style media tile) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
          <div className="flex items-center justify-between gap-2 text-[11px] font-medium text-white/80">
            <span className="truncate text-sky-300">{getServiceLabel(post.service)}</span>
            {filesCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 font-mono-tabular text-white/85">
                <Paperclip className="h-3 w-3" />
                {hasVideo ? 'MP4 · ' : ''}
                {filesCount}
              </span>
            )}
          </div>
          <h3 className="mt-1 line-clamp-1 font-display text-base font-semibold text-white">
            {post.title || `Publicação #${post.id}`}
          </h3>
        </div>
      </div>

      {/* Compact App Footer Bar */}
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-4 py-3 text-xs">
        <button
          type="button"
          onClick={() => onOpenCreator(post.service, post.user)}
          className="truncate font-medium text-white hover:text-sky-300 hover:underline"
        >
          {post.creator_name || `Criador #${post.user}`}
        </button>
        <span className="shrink-0 font-mono-tabular text-[11px] text-slate-300">
          {formatDatePtBr(post.published || post.added)}
        </span>
      </div>
    </article>
  );
}
