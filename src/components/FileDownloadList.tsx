import { useMemo } from 'react';
import {
  Archive,
  Download,
  ExternalLink,
  Eye,
  File as FileIcon,
  FileText,
  Film,
  HardDrive,
  Image as ImageIcon,
  Music,
  Smartphone,
} from 'lucide-react';
import type { ExternalAuthorizedLink, PawchiveFile } from '../types/spacex';
import {
  buildFileDownloadSources,
  buildDirectFileUrl,
  buildDownloadProxyUrl,
  classifyFile,
} from '../services/pawchiveService';
import type { PreviewTarget } from './FilePreviewModal';

interface FileDownloadListProps {
  primaryFile?: PawchiveFile;
  attachments?: PawchiveFile[];
  externalLinks?: ExternalAuthorizedLink[];
  onPreview: (target: PreviewTarget) => void;
}

interface NormalizedFileEntry {
  key: string;
  name: string;
  filePath: string;
  directUrl: string;
  downloadCandidates: string[];
  downloadUrl: string;
  index: number;
}

function getKindIcon(kind: ReturnType<typeof classifyFile>['kind']) {
  switch (kind) {
    case 'video':
      return Film;
    case 'android':
      return Smartphone;
    case 'image':
      return ImageIcon;
    case 'audio':
      return Music;
    case 'archive':
      return Archive;
    case 'document':
      return FileText;
    default:
      return FileIcon;
  }
}

export function FileDownloadList({
  primaryFile,
  attachments = [],
  externalLinks = [],
  onPreview,
}: FileDownloadListProps) {
  const entries = useMemo(() => {
    const raw: PawchiveFile[] = [];
    const seenUrls = new Set<string>();
    const pushFile = (f?: PawchiveFile) => {
      if (!f) return;
      const directUrl = buildDirectFileUrl(f);
      if (!directUrl || seenUrls.has(directUrl)) return;
      seenUrls.add(directUrl);
      raw.push(f);
    };
    pushFile(primaryFile);
    for (const att of attachments) {
      pushFile(att);
    }

    const list: NormalizedFileEntry[] = [];
    raw.forEach((f, idx) => {
      const downloadCandidates = buildFileDownloadSources(f);
      const directUrl = downloadCandidates[0];
      if (!directUrl) return;
      const fallbackName = f.path?.split('/').pop() || directUrl.split('?')[0].split('/').pop() || `arquivo-${idx + 1}`;
      const name = f.name?.trim() || fallbackName;
      list.push({
        key: `${directUrl}-${idx}`,
        name,
        filePath: f.path || directUrl.split('?')[0] || '',
        directUrl,
        downloadCandidates,
        downloadUrl: buildDownloadProxyUrl(downloadCandidates, name),
        index: idx,
      });
    });
    return list;
  }, [primaryFile, attachments]);

  if (entries.length === 0 && externalLinks.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 text-sm text-slate-400">
        Nenhum arquivo anexado ou link externo retornado pela API para esta publicação.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {entries.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-200">
              Arquivos disponibilizados pela API ({entries.length})
            </span>
            <span>Download individual direto</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {entries.map((entry) => {
              const cls = classifyFile(entry.name, entry.index, entry.filePath);
              const Icon = getKindIcon(cls.kind);
              const canPreview = cls.kind === 'image' || cls.kind === 'video' || cls.kind === 'audio';

              return (
                <div
                  key={entry.key}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 transition-colors hover:border-white/20"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0c0e14] text-sky-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white" title={entry.name}>
                        {entry.name}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span>{cls.typeLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          Tamanho não informado pela API
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={entry.downloadUrl}
                      className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-[#050507] transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" />
                      {cls.actionLabel}
                    </a>

                    {canPreview && (
                      <button
                        type="button"
                        onClick={() =>
                          onPreview({
                            name: entry.name,
                            url: entry.directUrl,
                            downloadCandidates: entry.downloadCandidates,
                            kind: cls.kind as 'image' | 'video' | 'audio',
                          })
                        }
                        aria-label={`Visualizar ${entry.name}`}
                        className="inline-flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {externalLinks.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-200">
              Links externos e downloads ({externalLinks.length})
            </span>
            <span>
              {externalLinks.some((link) => Boolean(link.downloadUrl))
                ? 'Download direto do Drive quando disponível'
                : 'Abertura segura em nova guia'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {externalLinks.map((link) => (
              <a
                key={link.url}
                href={link.downloadUrl || link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={link.downloadUrl ? `Baixar ${link.label} do Google Drive` : `Abrir ${link.label} em nova guia`}
                className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 transition-colors hover:border-sky-400/40 hover:bg-white/[0.05]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{link.label}</p>
                    <p className="text-xs text-slate-400">{link.provider}</p>
                  </div>
                </div>
                {link.downloadUrl ? (
                  <Download className="h-4 w-4 shrink-0 text-slate-300" />
                ) : (
                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
                )}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
