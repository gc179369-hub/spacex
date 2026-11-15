import DOMPurify from 'dompurify';
import type {
  AuthSessionState,
  CreatorsCatalogResponse,
  ExternalAuthorizedLink,
  FileClassification,
  PawchiveAnnouncement,
  PawchiveComment,
  PawchiveCreator,
  PawchiveCreatorProfile,
  PawchiveFancard,
  PawchiveFile,
  PawchivePostDetail,
  PawchivePostSummary,
  PawchiveRevision,
  PawchiveTag,
} from '../types/spacex';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

async function apiFetch<T>(
  url: string,
  options: RequestInit & { cacheTtlMs?: number; skipCache?: boolean } = {}
): Promise<T> {
  const { cacheTtlMs = 0, skipCache = false, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();

  if (method === 'GET' && cacheTtlMs > 0 && !skipCache) {
    const hit = memoryCache.get(url);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.data as T;
    }
  }

  const response = await fetch(url, {
    credentials: 'same-origin',
    ...fetchOptions,
    headers: {
      Accept: 'application/json',
      ...(fetchOptions.body && typeof fetchOptions.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...fetchOptions.headers,
    },
  });

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const errMsg =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Erro HTTP ${response.status} ao comunicar com o servidor.`;
    throw new ApiError(errMsg, response.status);
  }

  if (method === 'GET' && cacheTtlMs > 0) {
    memoryCache.set(url, { data: payload, expiresAt: Date.now() + cacheTtlMs });
  }

  return payload as T;
}

export function clearClientCache() {
  memoryCache.clear();
}

export function getServiceLabel(service: string): string {
  const map: Record<string, string> = {
    patreon: 'Patreon',
    fanbox: 'Pixiv Fanbox',
    discord: 'Discord',
    fantia: 'Fantia',
    subscribestar: 'SubscribeStar',
    gumroad: 'Gumroad',
    fansly: 'Fansly',
    onlyfans: 'OnlyFans',
    candfans: 'CandFans',
  };
  return map[service.toLowerCase()] || service.charAt(0).toUpperCase() + service.slice(1);
}

// Media & File URL Builders (routed via SSRF-safe server proxy so images/files load cleanly everywhere)
export function buildMediaProxyUrl(upstreamUrl: string): string {
  return `/api/media?url=${encodeURIComponent(upstreamUrl)}`;
}

export function buildCreatorAvatarUrl(service: string, id: string): string {
  return buildMediaProxyUrl(`https://pawchive.pw/icons/${encodeURIComponent(service)}/${encodeURIComponent(id)}`);
}

export function buildCreatorBannerUrl(service: string, id: string): string {
  return buildMediaProxyUrl(`https://pawchive.pw/banners/${encodeURIComponent(service)}/${encodeURIComponent(id)}`);
}

export function buildFileDownloadSources(file?: PawchiveFile | null): string[] {
  if (!file || file.preview_only) return [];

  const expiry = file.temp_expires ? Date.parse(file.temp_expires) : Number.NaN;
  const temporaryUrlIsFresh = !Number.isFinite(expiry) || expiry > Date.now() + 30_000;
  const sources: string[] = [];
  const addSource = (url?: string | null) => {
    if (url?.startsWith('https://') && !sources.includes(url)) sources.push(url);
  };

  if (temporaryUrlIsFresh) addSource(file.temp_download_url);
  if (file.path) {
    const cleanPath = file.path.startsWith('/') ? file.path : `/${file.path}`;
    const server = file.server && file.server.startsWith('https://') ? file.server.replace(/\/$/, '') : 'https://n1.pawchive.pw';
    addSource(`${server}/data${cleanPath}`);
  }
  if (temporaryUrlIsFresh && file.temp_url && !file.temp_url.includes('.m3u8')) {
    addSource(file.temp_url);
  }
  return sources.slice(0, 6);
}

export function buildDirectFileUrl(file?: PawchiveFile | null): string | null {
  return buildFileDownloadSources(file)[0] || null;
}

export function buildThumbnailUrl(file?: PawchiveFile | null): string | null {
  if (!file) return null;
  if (file.temp_url && file.temp_url.startsWith('https://') && !file.temp_url.includes('.m3u8')) {
    return buildMediaProxyUrl(file.temp_url);
  }
  if (!file.path) return null;
  const cleanPath = file.path.startsWith('/') ? file.path : `/${file.path}`;
  const ext = (file.name || cleanPath).split('.').pop()?.toLowerCase() || '';
  const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];
  if (!imageExts.includes(ext)) return null;
  return buildMediaProxyUrl(`https://img.pawchive.pw/thumbnail/data${cleanPath}`);
}

export function buildDownloadProxyUrl(fileUrl: string | string[], fileName: string): string {
  const sources = (Array.isArray(fileUrl) ? fileUrl : [fileUrl]).filter(Boolean).slice(0, 6);
  const params = new URLSearchParams({ url: sources[0] || '', filename: fileName });
  for (const candidate of sources.slice(1)) params.append('candidate', candidate);
  return `/api/download?${params.toString()}`;
}

// File classification for real individual download buttons
export function classifyFile(fileName: string, index: number, filePath = ''): FileClassification {
  const lower = fileName.toLowerCase();
  const pathLower = filePath.toLowerCase();
  const ext = lower.split('.').pop() || '';
  const pathExt = pathLower.split('.').pop() || '';
  const resolvedExt = ['apk', 'aab', 'xapk', 'mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'flv', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'psd', 'clip', 'tiff', 'mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'pdf', 'txt', 'md', 'doc', 'docx', 'epub', 'rtf', 'csv', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)
    ? ext
    : pathExt;

  if (['apk', 'aab', 'xapk'].includes(resolvedExt) || lower.includes('android')) {
    return { kind: 'android', actionLabel: 'Baixar arquivo Android', typeLabel: 'Pacote Android' };
  }
  if (['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'flv'].includes(resolvedExt)) {
    return { kind: 'video', actionLabel: 'Baixar vídeo', typeLabel: `Vídeo ${resolvedExt.toUpperCase()}` };
  }
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'psd', 'clip', 'tiff'].includes(resolvedExt)) {
    return { kind: 'image', actionLabel: 'Baixar imagem', typeLabel: `Imagem ${resolvedExt.toUpperCase()}` };
  }
  if (['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'].includes(resolvedExt)) {
    return { kind: 'audio', actionLabel: 'Baixar áudio', typeLabel: `Áudio ${resolvedExt.toUpperCase()}` };
  }
  if (['pdf', 'txt', 'md', 'doc', 'docx', 'epub', 'rtf', 'csv'].includes(resolvedExt)) {
    return { kind: 'document', actionLabel: 'Baixar documento', typeLabel: `Documento ${resolvedExt.toUpperCase()}` };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(resolvedExt)) {
    return { kind: 'archive', actionLabel: `Download ${index + 1}`, typeLabel: `Arquivo ${resolvedExt.toUpperCase()}` };
  }
  return {
    kind: 'other',
    actionLabel: `Download ${index + 1}`,
    typeLabel: resolvedExt ? resolvedExt.toUpperCase() : 'Arquivo',
  };
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes <= 0) return 'Tamanho sob consulta';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value >= 10 || idx === 0 ? value.toFixed(1) : value.toFixed(2)} ${units[idx]}`;
}

export function formatDatePtBr(value: string | number | undefined | null): string {
  if (!value) return 'Data indisponível';
  let date: Date;
  if (typeof value === 'number') {
    date = new Date(value > 1e12 ? value : value * 1000);
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function stripHtml(html: string | undefined | null): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizePostHtml(html: string | undefined | null): string {
  if (!html) return '';
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  doc.querySelectorAll('a').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  return doc.body.innerHTML;
}

export function extractExternalAuthorizedLinks(
  html: string | undefined | null,
  embed?: { url?: string; subject?: string }
): ExternalAuthorizedLink[] {
  const seen = new Set<string>();
  const links: ExternalAuthorizedLink[] = [];

  const classifyUrl = (rawUrl: string, textLabel?: string) => {
    try {
      const candidate = rawUrl.trim();
      if (!/^(?:https?:\/\/|\/\/)/i.test(candidate)) return;
      const parsed = new URL(candidate.startsWith('//') ? `https:${candidate}` : candidate);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      if (seen.has(parsed.href)) return;
      seen.add(parsed.href);

      const host = parsed.hostname.toLowerCase();
      const matchesHost = (domain: string) => host === domain || host.endsWith(`.${domain}`);
      let provider: ExternalAuthorizedLink['provider'] = 'Link Externo';
      if (matchesHost('drive.google.com') || matchesHost('docs.google.com')) {
        provider = 'Google Drive';
      } else if (matchesHost('mega.nz') || matchesHost('mega.co.nz')) {
        provider = 'Mega';
      } else if (matchesHost('dropbox.com') || matchesHost('dropboxusercontent.com')) {
        provider = 'Dropbox';
      } else if (matchesHost('fantia.jp')) {
        provider = 'Fantia';
      } else if (matchesHost('pixiv.net') || matchesHost('fanbox.cc')) {
        provider = 'Pixiv';
      } else if (matchesHost('patreon.com')) {
        provider = 'Patreon';
      }

      const cleanLabel = textLabel && textLabel.trim().length > 2 && textLabel.length < 90
        ? textLabel.trim()
        : `${provider} — ${parsed.hostname}`;

      links.push({
        url: parsed.href,
        label: cleanLabel,
        provider,
      });
    } catch {
      // Ignore malformed URLs
    }
  };

  if (embed?.url) {
    classifyUrl(embed.url, embed.subject || 'Link Incorporado');
  }

  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style').forEach((node) => node.remove());
    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href) classifyUrl(href, anchor.textContent || undefined);
    });

    const text = doc.body.textContent || html;
    const markdownLink = /(^|[^!])\[([^\]]{1,160})\]\((https?:\/\/[^)\s]+)\)/gim;
    for (const match of text.matchAll(markdownLink)) {
      classifyUrl(match[3], match[2]);
    }

    const plainUrl = /(?:https?:\/\/|\/\/)[^\s<>"'`]+/gi;
    for (const match of text.matchAll(plainUrl)) {
      let candidate = match[0].replace(/[.,!?;:]+$/g, '');
      while (candidate.endsWith(')')) {
        const closingParentheses = candidate.match(/\)/g)?.length || 0;
        const openingParentheses = candidate.match(/\(/g)?.length || 0;
        if (closingParentheses <= openingParentheses) break;
        candidate = candidate.slice(0, -1);
      }
      classifyUrl(candidate);
    }
  }

  return links;
}

export function parsePostTags(tags: string | string[] | undefined | null): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.filter(Boolean);
  const trimmed = tags.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed
      .slice(1, -1)
      .split(',')
      .map((s) => s.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractCleanExt(raw: string | undefined | null): string {
  if (!raw) return '';
  const noQuery = raw.split('?')[0].split('#')[0];
  return noQuery.split('.').pop()?.toLowerCase() || '';
}

export function isVideoFile(file?: PawchiveFile | null): boolean {
  if (!file) return false;
  const exts = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'];
  return (
    exts.includes(extractCleanExt(file.name)) ||
    exts.includes(extractCleanExt(file.path)) ||
    exts.includes(extractCleanExt(file.temp_download_url))
  );
}

export function isImageFile(file?: PawchiveFile | null): boolean {
  if (!file) return false;
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'];
  return (
    exts.includes(extractCleanExt(file.name)) ||
    exts.includes(extractCleanExt(file.path)) ||
    exts.includes(extractCleanExt(file.temp_url))
  );
}

// API Service Methods
export const pawchiveService = {
  async getCreators(params: {
    q?: string;
    service?: string;
    sort?: 'favorited' | 'updated' | 'indexed' | 'name' | 'relevance';
    page?: number;
    pageSize?: number;
    refresh?: boolean;
    smart?: boolean;
  }): Promise<CreatorsCatalogResponse> {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.service && params.service !== 'all') qs.set('service', params.service);
    if (params.sort) qs.set('sort', params.sort);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.refresh) qs.set('refresh', '1');
    if (params.smart) qs.set('smart', '1');
    return apiFetch<CreatorsCatalogResponse>(`/api/pawchive/creators?${qs.toString()}`, {
      cacheTtlMs: params.refresh ? 0 : 60_000,
      skipCache: Boolean(params.refresh),
    });
  },

  async lookupCreators(keys: string[]): Promise<Record<string, PawchiveCreator>> {
    if (keys.length === 0) return {};
    const resp = await apiFetch<{ creators: Record<string, PawchiveCreator> }>('/api/pawchive/creators/lookup', {
      method: 'POST',
      body: JSON.stringify({ keys }),
    });
    return resp.creators;
  },

  async getRecentPosts(params: { q?: string; o?: number; refresh?: boolean } = {}): Promise<PawchivePostSummary[]> {
    const qs = new URLSearchParams();
    if (params.q?.trim()) qs.set('q', params.q.trim());
    if (params.o && params.o > 0) qs.set('o', String(params.o));
    const query = qs.toString();
    return apiFetch<PawchivePostSummary[]>(`/api/pawchive/posts${query ? `?${query}` : ''}`, {
      cacheTtlMs: 45_000,
      skipCache: Boolean(params.refresh),
    });
  },

  async getCreatorProfile(service: string, creatorId: string): Promise<PawchiveCreatorProfile> {
    return apiFetch<PawchiveCreatorProfile>(
      `/api/pawchive/creator/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/profile`,
      { cacheTtlMs: 120_000 }
    );
  },

  async getCreatorPosts(
    service: string,
    creatorId: string,
    params: { q?: string; tag?: string; o?: number } = {}
  ): Promise<PawchivePostSummary[]> {
    const qs = new URLSearchParams();
    if (params.tag?.trim()) qs.set('tag', params.tag.trim());
    else if (params.q?.trim()) qs.set('q', params.q.trim());
    if (params.o && params.o > 0) qs.set('o', String(params.o));
    const query = qs.toString();
    return apiFetch<PawchivePostSummary[]>(
      `/api/pawchive/creator/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/posts${query ? `?${query}` : ''}`,
      { cacheTtlMs: 45_000 }
    );
  },

  async getCreatorAnnouncements(service: string, creatorId: string): Promise<PawchiveAnnouncement[]> {
    return apiFetch<PawchiveAnnouncement[]>(
      `/api/pawchive/creator/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/announcements`,
      { cacheTtlMs: 120_000 }
    );
  },

  async getCreatorFancards(service: string, creatorId: string): Promise<PawchiveFancard[]> {
    if (service.toLowerCase() !== 'fanbox') return [];
    return apiFetch<PawchiveFancard[]>(
      `/api/pawchive/creator/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/fancards`,
      { cacheTtlMs: 120_000 }
    );
  },

  async getCreatorLinks(service: string, creatorId: string): Promise<PawchiveCreatorProfile[]> {
    return apiFetch<PawchiveCreatorProfile[]>(
      `/api/pawchive/creator/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/links`,
      { cacheTtlMs: 120_000 }
    );
  },

  async getCreatorTags(service: string, creatorId: string): Promise<PawchiveTag[]> {
    return apiFetch<PawchiveTag[]>(
      `/api/pawchive/creator/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/tags`,
      { cacheTtlMs: 120_000 }
    );
  },

  async getPost(service: string, creatorId: string, postId: string): Promise<PawchivePostDetail> {
    return apiFetch<PawchivePostDetail>(
      `/api/pawchive/post/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/${encodeURIComponent(postId)}`,
      { cacheTtlMs: 60_000 }
    );
  },

  async getPostRevisions(service: string, creatorId: string, postId: string): Promise<PawchiveRevision[]> {
    return apiFetch<PawchiveRevision[]>(
      `/api/pawchive/post/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/${encodeURIComponent(postId)}/revisions`,
      { cacheTtlMs: 120_000 }
    );
  },

  async getPostComments(service: string, creatorId: string, postId: string): Promise<PawchiveComment[]> {
    return apiFetch<PawchiveComment[]>(
      `/api/pawchive/post/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/${encodeURIComponent(postId)}/comments`,
      { cacheTtlMs: 60_000 }
    );
  },

  async checkPostFlagged(service: string, creatorId: string, postId: string): Promise<boolean> {
    try {
      const res = await apiFetch<boolean | { flagged?: boolean }>(
        `/api/pawchive/post/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/${encodeURIComponent(postId)}/flag`
      );
      return typeof res === 'boolean' ? res : Boolean(res?.flagged);
    } catch {
      return false;
    }
  },

  async flagPost(service: string, creatorId: string, postId: string): Promise<unknown> {
    return apiFetch(
      `/api/pawchive/post/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/${encodeURIComponent(postId)}/flag`,
      { method: 'POST' }
    );
  },

  async searchByHash(fileHash: string): Promise<unknown> {
    return apiFetch(`/api/pawchive/search_hash/${encodeURIComponent(fileHash.trim())}`);
  },

  async getAppVersion(): Promise<string> {
    const res = await apiFetch<string | { raw?: string }>('/api/pawchive/app_version', { cacheTtlMs: 300_000 });
    return typeof res === 'string' ? res.trim() : String(res?.raw || '').trim();
  },

  async getFileMeta(fileUrl: string): Promise<{ ok: boolean; contentLength: number | null; contentType: string | null }> {
    return apiFetch(`/api/file-meta?url=${encodeURIComponent(fileUrl)}`, { cacheTtlMs: 300_000 });
  },

  // Secure Session Auth
  async getAuthSession(): Promise<AuthSessionState> {
    return apiFetch<AuthSessionState>('/api/auth/session');
  },

  async login(payload: { username?: string; password?: string; sessionToken?: string }): Promise<AuthSessionState> {
    return apiFetch<AuthSessionState>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async logout(): Promise<AuthSessionState> {
    return apiFetch<AuthSessionState>('/api/auth/logout', { method: 'POST' });
  },

  // Authenticated Pawchive Account Favorites Sync
  async getAccountFavorites(type: 'artist' | 'post'): Promise<unknown[]> {
    return apiFetch<unknown[]>(`/api/pawchive/account/favorites?type=${type}`);
  },

  async addAccountFavoriteCreator(service: string, creatorId: string): Promise<void> {
    await apiFetch(`/api/pawchive/favorites/creator/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}`, {
      method: 'POST',
    });
  },

  async removeAccountFavoriteCreator(service: string, creatorId: string): Promise<void> {
    await apiFetch(`/api/pawchive/favorites/creator/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}`, {
      method: 'DELETE',
    });
  },

  async addAccountFavoritePost(service: string, creatorId: string, postId: string): Promise<void> {
    await apiFetch(
      `/api/pawchive/favorites/post/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/${encodeURIComponent(postId)}`,
      { method: 'POST' }
    );
  },

  async removeAccountFavoritePost(service: string, creatorId: string, postId: string): Promise<void> {
    await apiFetch(
      `/api/pawchive/favorites/post/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/${encodeURIComponent(postId)}`,
      { method: 'DELETE' }
    );
  },

  // Authorized Importer
  async submitImport(payload: {
    service: string;
    session_key: string;
    device_id?: string;
    auth_id?: string;
    x_bc?: string;
    user_agent?: string;
  }): Promise<{ success: boolean; status: number; message: string; data?: unknown }> {
    return apiFetch('/api/pawchive/importer/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
