import { useState } from 'react';
import { Download, ExternalLink, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { buildDownloadProxyUrl, buildMediaProxyUrl } from '../services/pawchiveService';
import { NativeVideoPlayer } from './NativeVideoPlayer';

export interface PreviewTarget {
  name: string;
  url: string;
  downloadCandidates?: string[];
  kind: 'image' | 'video' | 'audio';
}

interface FilePreviewModalProps {
  target: PreviewTarget | null;
  onClose: () => void;
}

export function FilePreviewModal({ target, onClose }: FilePreviewModalProps) {
  const [zoom, setZoom] = useState(1);

  if (!target) return null;

  const proxiedMedia = buildMediaProxyUrl(target.url);
  const downloadUrl = buildDownloadProxyUrl(target.downloadCandidates?.length ? target.downloadCandidates : target.url, target.name);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-3 sm:p-5 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualização de ${target.name}`}
      onClick={onClose}
    >
      <div
        className="liquid-glass motion-blur-in flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <p className="truncate font-mono-tabular text-xs sm:text-sm text-white">{target.name}</p>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {target.kind === 'image' && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  aria-label="Diminuir zoom"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  aria-label="Resetar zoom"
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 font-mono-tabular text-xs text-white hover:bg-white/15"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  aria-label="Aumentar zoom"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </>
            )}

            <a
              href={downloadUrl}
              className="inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-slate-200"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar
            </a>
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir arquivo original em nova aba"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar visualização"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-[320px] flex-1 items-center justify-center overflow-auto bg-black/90 p-3 sm:p-5">
          {target.kind === 'image' && (
            <img
              src={proxiedMedia}
              alt={target.name}
              referrerPolicy="no-referrer"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
              className="max-h-[78vh] max-w-full rounded-lg object-contain transition-transform duration-150"
            />
          )}
          {target.kind === 'video' && (
            <div className="w-full max-w-4xl">
              <NativeVideoPlayer url={target.url} title={target.name} />
            </div>
          )}
          {target.kind === 'audio' && (
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
              <p className="mb-4 text-sm font-medium text-white">{target.name}</p>
              <audio src={proxiedMedia} controls className="w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
