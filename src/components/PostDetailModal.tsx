import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Film,
  Flag,
  Heart,
  History,
  MessageSquare,
  Play,
  User,
  X,
} from 'lucide-react';
import type {
  PawchiveComment,
  PawchiveFile,
  PawchivePostDetail,
  PawchivePostSummary,
  PawchiveRevision,
} from '../types/spacex';
import {
  buildDirectFileUrl,
  buildMediaProxyUrl,
  buildThumbnailUrl,
  extractExternalAuthorizedLinks,
  formatDatePtBr,
  getServiceLabel,
  isImageFile,
  isVideoFile,
  parsePostTags,
  pawchiveService,
  sanitizePostHtml,
} from '../services/pawchiveService';
import { SmartImage } from './SmartImage';
import { FileDownloadList } from './FileDownloadList';
import { FilePreviewModal, type PreviewTarget } from './FilePreviewModal';
import { NativeVideoPlayer } from './NativeVideoPlayer';
import { useToast } from '../hooks/useToast';

interface PostDetailModalProps {
  post: PawchivePostSummary | null;
  blurThumbnails: boolean;
  isFavorite: boolean;
  isAuthenticated: boolean;
  onToggleFavorite: (post: PawchivePostSummary) => void;
  onOpenCreator: (service: string, creatorId: string) => void;
  onClose: () => void;
}

export function PostDetailModal({
  post,
  blurThumbnails,
  isFavorite,
  isAuthenticated,
  onToggleFavorite,
  onOpenCreator,
  onClose,
}: PostDetailModalProps) {
  const { showToast } = useToast();
  const playerSectionRef = useRef<HTMLDivElement | null>(null);

  const [detail, setDetail] = useState<PawchivePostDetail | null>(null);
  const [revisions, setRevisions] = useState<PawchiveRevision[]>([]);
  const [comments, setComments] = useState<PawchiveComment[]>([]);
  const [flagged, setFlagged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'arquivos' | 'comentarios' | 'revisoes'>('arquivos');
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget | null>(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!post) return;
    let active = true;
    setLoading(true);
    setError(null);
    setDetail(null);
    setRevisions([]);
    setComments([]);
    setActiveTab('arquivos');
    setActiveVideoIndex(null);

    Promise.allSettled([
      pawchiveService.getPost(post.service, post.user, post.id),
      pawchiveService.getPostRevisions(post.service, post.user, post.id),
      pawchiveService.getPostComments(post.service, post.user, post.id),
      pawchiveService.checkPostFlagged(post.service, post.user, post.id),
    ])
      .then(([postRes, revRes, commRes, flagRes]) => {
        if (!active) return;
        if (postRes.status === 'fulfilled') {
          setDetail(postRes.value);
        } else {
          setError(postRes.reason instanceof Error ? postRes.reason.message : 'Erro ao carregar publicação.');
        }
        if (revRes.status === 'fulfilled' && Array.isArray(revRes.value)) {
          setRevisions(revRes.value);
        }
        if (commRes.status === 'fulfilled' && Array.isArray(commRes.value)) {
          setComments(commRes.value);
        }
        if (flagRes.status === 'fulfilled') {
          setFlagged(flagRes.value);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [post]);

  const activePost = detail || post;
  const sanitizedHtml = useMemo(
    () => sanitizePostHtml(detail?.content || post?.content || post?.substring),
    [detail, post]
  );
  const externalLinks = useMemo(
    () => extractExternalAuthorizedLinks(detail?.content || post?.content, detail?.embed),
    [detail, post]
  );
  const tags = useMemo(() => parsePostTags(detail?.tags), [detail]);

  const allFiles = useMemo(() => {
    if (!activePost) return [];
    const out: PawchiveFile[] = [];
    const seenKeys = new Set<string>();
    const addFile = (f?: PawchiveFile) => {
      if (!f) return;
      const key = buildDirectFileUrl(f) || f.path || f.temp_url || f.temp_download_url;
      if (!key || seenKeys.has(key)) return;
      seenKeys.add(key);
      out.push(f);
    };
    addFile(activePost.file);
    for (const att of activePost.attachments || []) {
      addFile(att);
    }
    return out;
  }, [activePost]);

  const videoFiles = useMemo(() => allFiles.filter((f) => isVideoFile(f)), [allFiles]);
  const imageGallery = useMemo(() => allFiles.filter((f) => isImageFile(f)), [allFiles]);

  // If there is exactly 1 video (or primary file is video), auto-open player; if multiple, let user choose or open #1
  useEffect(() => {
    if (videoFiles.length === 1) {
      setActiveVideoIndex(0);
    } else if (videoFiles.length > 1 && isVideoFile(activePost?.file)) {
      setActiveVideoIndex(0);
    }
  }, [videoFiles.length, activePost?.id]);

  if (!post || !activePost) return null;

  const coverUrl = buildThumbnailUrl(activePost.file);
  const directCoverUrl = buildDirectFileUrl(activePost.file);
  const activeVideo = activeVideoIndex !== null ? videoFiles[activeVideoIndex] : null;
  const activeVideoUrl = activeVideo ? buildDirectFileUrl(activeVideo) : null;

  const selectVideoAndScroll = (idx: number) => {
    setActiveVideoIndex(idx);
    playerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleFlag = async () => {
    if (!isAuthenticated) {
      showToast('Conecte sua conta Pawchive em Configurações para sinalizar publicações.', 'info');
      return;
    }
    try {
      await pawchiveService.flagPost(post.service, post.user, post.id);
      setFlagged(true);
      showToast('Publicação sinalizada com sucesso.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao sinalizar publicação.', 'error');
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2.5 sm:p-5 backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-detail-title"
        onClick={onClose}
      >
        <div
          className="liquid-glass motion-blur-in flex max-h-[93vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-5 py-4 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span className="font-semibold text-sky-300">{getServiceLabel(activePost.service)}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-white">{activePost.creator_name || `ID ${activePost.user}`}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="inline-flex items-center gap-1 font-mono-tabular text-slate-300">
                  <Calendar className="h-3 w-3" />
                  {formatDatePtBr(activePost.published || activePost.added)}
                </span>
              </div>
              <h2
                id="post-detail-title"
                className="mt-1.5 font-display text-lg sm:text-xl font-semibold text-white text-balance"
              >
                {activePost.title || `Publicação #${activePost.id}`}
              </h2>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleFavorite(post)}
                aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                  isFavorite
                    ? 'border-rose-400/40 bg-rose-500/20 text-rose-300'
                    : 'border-white/10 bg-white/5 text-white hover:bg-white/15'
                }`}
              >
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleFlag}
                title={flagged ? 'Publicação sinalizada' : 'Sinalizar publicação'}
                aria-label="Sinalizar publicação"
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                  flagged
                    ? 'border-amber-400/40 bg-amber-400/20 text-amber-300'
                    : 'border-white/10 bg-white/5 text-white hover:bg-white/15'
                }`}
              >
                <Flag className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar detalhes"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-6">
            {/* Creator Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCreator(activePost.service, activePost.user);
                }}
                className="inline-flex min-h-[40px] items-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-white hover:text-black"
              >
                <User className="h-4 w-4" />
                <span>Perfil de {activePost.creator_name || `Criador #${activePost.user}`}</span>
              </button>

              {videoFiles.length > 0 && (
                <span className="inline-flex items-center gap-1.5 font-mono-tabular text-xs text-sky-300">
                  <Film className="h-3.5 w-3.5" />
                  {videoFiles.length} {videoFiles.length === 1 ? 'vídeo disponível' : 'vídeos disponíveis'}
                </span>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div>
                  <p className="font-medium">Não foi possível carregar todos os detalhes da API.</p>
                  <p className="mt-0.5 text-xs text-rose-200">{error}</p>
                </div>
              </div>
            )}

            {/* Multi-Video Selector & Native MP4 Player */}
            {videoFiles.length > 0 && (
              <div ref={playerSectionRef} className="space-y-4">
                {/* Active Player */}
                {activeVideoUrl ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          Reproduzindo {(activeVideoIndex ?? 0) + 1} de {videoFiles.length}:{' '}
                          <span className="text-sky-300">
                            {activeVideo?.name || activeVideo?.path?.split('/').pop() || `Vídeo ${(activeVideoIndex ?? 0) + 1}`}
                          </span>
                        </p>
                      </div>
                      {videoFiles.length > 1 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={(activeVideoIndex ?? 0) <= 0}
                            onClick={() => selectVideoAndScroll(Math.max(0, (activeVideoIndex ?? 0) - 1))}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-35"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Anterior
                          </button>
                          <button
                            type="button"
                            disabled={(activeVideoIndex ?? 0) >= videoFiles.length - 1}
                            onClick={() =>
                              selectVideoAndScroll(Math.min(videoFiles.length - 1, (activeVideoIndex ?? 0) + 1))
                            }
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 text-xs font-medium text-white hover:bg-white/15 disabled:opacity-35"
                          >
                            Próximo
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <NativeVideoPlayer
                      key={activeVideoUrl}
                      url={activeVideoUrl}
                      title={activeVideo?.name || activePost.title || 'Vídeo'}
                      posterUrl={coverUrl}
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/[0.04] p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Esta publicação possui {videoFiles.length} arquivos de vídeo disponíveis
                      </p>
                      <p className="text-xs text-slate-300">
                        Escolha abaixo qual vídeo você deseja reproduzir no player nativo MP4.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectVideoAndScroll(0)}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-slate-200"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      Reproduzir primeiro vídeo
                    </button>
                  </div>
                )}

                {/* Video Picker List (handles 2, 3, 10, 20+ video files cleanly!) */}
                {videoFiles.length > 1 && (
                  <div className="rounded-2xl border border-white/10 bg-black/50 p-3.5">
                    <div className="mb-2.5 flex items-center justify-between text-xs text-slate-300">
                      <span className="font-semibold text-white">
                        Escolha o arquivo de vídeo para reproduzir ({videoFiles.length})
                      </span>
                      <span className="font-mono-tabular text-sky-300">Lista completa</span>
                    </div>
                    <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {videoFiles.map((vf, idx) => {
                        const fileName = vf.name?.trim() || vf.path?.split('/').pop() || `Vídeo ${idx + 1}`;
                        const isPlaying = activeVideoIndex === idx;
                        return (
                          <button
                            key={`${vf.path}-${idx}`}
                            type="button"
                            onClick={() => selectVideoAndScroll(idx)}
                            className={`flex min-h-[44px] items-center justify-between gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
                              isPlaying
                                ? 'border-sky-400/60 bg-white text-black'
                                : 'border-white/10 bg-white/[0.04] text-white hover:border-white/25 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono-tabular text-[11px] font-semibold ${
                                  isPlaying ? 'bg-black text-white' : 'bg-white/10 text-sky-300'
                                }`}
                              >
                                {String(idx + 1).padStart(2, '0')}
                              </span>
                              <span className="truncate text-xs font-medium">{fileName}</span>
                            </div>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold ${
                                isPlaying ? 'text-black' : 'text-sky-300'
                              }`}
                            >
                              <Play className="h-3 w-3 fill-current" />
                              {isPlaying ? 'Ativo' : 'Assistir'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cover & Image Opener Gallery */}
            {(coverUrl || imageGallery.length > 0) && (
              <div className="space-y-3">
                {coverUrl && directCoverUrl && activeVideoIndex === null && (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewTarget({
                        name: activePost.file?.name || 'capa',
                        url: directCoverUrl,
                        kind: 'image',
                      })
                    }
                    className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
                  >
                    <SmartImage
                      src={coverUrl}
                      alt={activePost.title || 'Capa da publicação'}
                      blur={blurThumbnails}
                      className="max-h-[420px] w-full object-cover"
                    />
                  </button>
                )}

                {imageGallery.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-300">
                      Galeria de imagens ({imageGallery.length}) — clique para abrir com zoom
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                      {imageGallery.slice(0, 15).map((img, i) => {
                        const thumb = buildThumbnailUrl(img);
                        const full = buildDirectFileUrl(img);
                        if (!thumb || !full) return null;
                        return (
                          <button
                            key={`${img.path}-${i}`}
                            type="button"
                            onClick={() =>
                              setPreviewTarget({
                                name: img.name || `imagem-${i + 1}`,
                                url: full,
                                kind: 'image',
                              })
                            }
                            className="aspect-square overflow-hidden rounded-xl border border-white/10 transition-transform hover:scale-[1.03]"
                          >
                            <SmartImage
                              src={buildMediaProxyUrl(`https://img.pawchive.pw/thumbnail/data${img.path}`)}
                              alt={img.name || `Imagem ${i + 1}`}
                              blur={blurThumbnails}
                              className="h-full w-full"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
                <span className="font-semibold text-white">Categorias:</span>
                {tags.map((t, idx) => (
                  <span key={t}>
                    {idx > 0 && <span className="mr-2 text-slate-500">·</span>}
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Description / Content */}
            {loading && !detail ? (
              <div className="space-y-2.5">
                <div className="skeleton-glass h-4 w-3/4 rounded" />
                <div className="skeleton-glass h-4 w-full rounded" />
                <div className="skeleton-glass h-4 w-5/6 rounded" />
              </div>
            ) : sanitizedHtml ? (
              <div
                className="spacex-prose rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            ) : null}

            {/* Tabs: Arquivos e Downloads / Comentários / Revisões */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('arquivos')}
                  className={`min-h-[38px] whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === 'arquivos'
                      ? 'bg-white text-black'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  Arquivos e Downloads
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('comentarios')}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === 'comentarios'
                      ? 'bg-white text-black'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Comentários ({comments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('revisoes')}
                  className={`inline-flex min-h-[38px] items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === 'revisoes'
                      ? 'bg-white text-black'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  Revisões ({revisions.length})
                </button>
              </div>

              {activeTab === 'arquivos' && (
                <FileDownloadList
                  primaryFile={activePost.file}
                  attachments={activePost.attachments}
                  externalLinks={externalLinks}
                  onPreview={(target) => {
                    if (target.kind === 'video') {
                      const idx = videoFiles.findIndex((vf) => buildDirectFileUrl(vf) === target.url);
                      if (idx !== -1) {
                        selectVideoAndScroll(idx);
                        return;
                      }
                    }
                    setPreviewTarget(target);
                  }}
                />
              )}

              {activeTab === 'comentarios' && (
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm text-slate-300">
                      Nenhum comentário público registrado para esta publicação.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                          <span className="font-semibold text-white">
                            {c.commenter_name || `Usuário ${c.commenter}`}
                          </span>
                          <span className="font-mono-tabular">{formatDatePtBr(c.published)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{c.content}</p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'revisoes' && (
                <div className="space-y-3">
                  {revisions.length === 0 ? (
                    <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm text-slate-300">
                      Nenhuma revisão anterior encontrada para esta publicação.
                    </p>
                  ) : (
                    revisions.map((rev) => (
                      <div
                        key={rev.revision_id}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                          <span className="font-semibold text-white">
                            Revisão #{rev.revision_id} — {rev.title}
                          </span>
                          <span className="font-mono-tabular">{formatDatePtBr(rev.added)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <FilePreviewModal target={previewTarget} onClose={() => setPreviewTarget(null)} />
    </>
  );
}
