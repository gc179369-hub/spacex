import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { pawchiveDownloadGate } from './downloadGate.js';

const PAWCHIVE_BASE = 'https://pawchive.pw';
const PAWCHIVE_API = `${PAWCHIVE_BASE}/api/v1`;
const VERCEL_MAX_PROXY_BYTES = 4_000_000; // Stay safely under Vercel's 4.5MB serverless payload limit

interface PawchiveCreator {
  id: string;
  name: string;
  public_id: string | null;
  service: string;
  indexed: number;
  updated: number;
  favorited: number;
  ever_imported: boolean;
}

interface ServerSession {
  pawchiveCookie: string;
  username?: string;
  method: 'credentials' | 'session_token';
  createdAt: number;
}

interface CreatorsCatalogCache {
  items: PawchiveCreator[];
  byKey: Map<string, PawchiveCreator>;
  services: Record<string, number>;
  fetchedAt: number;
}

const fileMetaCache = new Map<string, { contentLength: number | null; contentType: string | null; ts: number }>();

let creatorsCache: CreatorsCatalogCache | null = null;
let creatorsInFlight: Promise<CreatorsCatalogCache> | null = null;
const CREATORS_TTL_MS = 5 * 60 * 1000;

const FALLBACK_KEY_SEED = process.env.SESSION_SECRET || process.env.VERCEL_PROJECT_ID || 'spacex-pawchive-session-key-v1';
const SESSION_KEY = crypto.createHash('sha256').update(FALLBACK_KEY_SEED).digest();

function encryptSession(session: ServerSession): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', SESSION_KEY, iv);
  const plaintext = JSON.stringify(session);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

function decryptSession(token: string): ServerSession | null {
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length < 28) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', SESSION_KEY, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(decrypted) as ServerSession;
    if (!parsed || typeof parsed.pawchiveCookie !== 'string') return null;
    if (Date.now() - (parsed.createdAt || 0) > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(val);
      } catch {
        out[key] = val;
      }
    }
  }
  return out;
}

function getSessionFromReq(req: Request): { sid: string; session: ServerSession } | null {
  const cookies = parseCookies(req.headers.cookie);
  const sid = cookies.spacex_sid;
  if (!sid) return null;
  const session = decryptSession(sid);
  if (!session) return null;
  return { sid, session };
}

function isAllowedPawchiveUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (host === 'pawchive.pw' || host === 'img.pawchive.pw' || /^(?:n|t)[1-4]\.pawchive\.pw$/.test(host)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function hasAttachmentDisposition(value: string | null): boolean {
  return Boolean(value && /^\s*attachment(?:\s*;|$)/i.test(value));
}

function matchesKnownFileSignature(fileName: string, bytes: Buffer): boolean | null {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const startsWith = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  switch (extension) {
    case 'png': return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'jpg':
    case 'jpeg': return startsWith(0xff, 0xd8, 0xff);
    case 'gif': return bytes.subarray(0, 6).toString('ascii').match(/^GIF8[79]a$/) !== null;
    case 'webp': return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    case 'bmp': return bytes.toString('ascii', 0, 2) === 'BM';
    case 'avif': return bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii', 8, 12));
    case 'mp4':
    case 'm4v':
    case 'mov': return bytes.length >= 8 && bytes.toString('ascii', 4, 8) === 'ftyp';
    case 'avi': return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'AVI ';
    case 'flv': return bytes.toString('ascii', 0, 3) === 'FLV';
    case 'webm':
    case 'mkv': return startsWith(0x1a, 0x45, 0xdf, 0xa3);
    case 'zip':
    case 'apk':
    case 'aab':
    case 'xapk':
    case 'docx':
    case 'epub': return startsWith(0x50, 0x4b, 0x03, 0x04) || startsWith(0x50, 0x4b, 0x05, 0x06) || startsWith(0x50, 0x4b, 0x07, 0x08);
    case 'pdf': return bytes.subarray(0, 5).toString('ascii') === '%PDF-';
    case 'doc': return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    case 'tif':
    case 'tiff': return startsWith(0x49, 0x49, 0x2a, 0x00) || startsWith(0x4d, 0x4d, 0x00, 0x2a);
    case 'psd': return bytes.toString('ascii', 0, 4) === '8BPS';
    case 'tar': return bytes.length >= 262 && bytes.toString('ascii', 257, 262) === 'ustar';
    case 'gz': return startsWith(0x1f, 0x8b);
    case 'bz2': return bytes.toString('ascii', 0, 3) === 'BZh';
    case 'rtf': return bytes.toString('ascii', 0, 5) === '{\\rtf';
    case 'wav': return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE';
    case 'flac': return bytes.toString('ascii', 0, 4) === 'fLaC';
    case 'ogg': return bytes.toString('ascii', 0, 4) === 'OggS';
    case 'mp3':
    case 'aac': return bytes.toString('ascii', 0, 3) === 'ID3' || (bytes.length > 1 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case '7z': return startsWith(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c);
    case 'rar': return bytes.toString('ascii', 0, 4) === 'Rar!';
    default: return null;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init.headers);
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', 'SpaceX-Platform/1.0 (+https://spacex-posts.vercel.app)');
    }
    return await fetch(url, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPawchiveResource(
  url: string,
  init: RequestInit = {},
  timeoutMs = 20000,
  beforeRequest?: () => Promise<void>
): Promise<globalThis.Response> {
  let current = isAllowedPawchiveUrl(url);
  if (!current) throw new Error('URL de mídia Pawchive não autorizada.');

  for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
    if (beforeRequest) await beforeRequest();
    const response = await fetchWithTimeout(current.toString(), { ...init, redirect: 'manual' }, timeoutMs);
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    const redirected = isAllowedPawchiveUrl(new URL(location, current).toString());
    await response.body?.cancel().catch(() => {});
    if (!redirected) throw new Error('O servidor de mídia tentou redirecionar para um domínio não autorizado.');
    current = redirected;
  }

  throw new Error('O servidor de mídia excedeu o limite de redirecionamentos.');
}

async function getCreatorsCatalog(forceRefresh = false): Promise<CreatorsCatalogCache> {
  const now = Date.now();
  if (!forceRefresh && creatorsCache && now - creatorsCache.fetchedAt < CREATORS_TTL_MS) {
    return creatorsCache;
  }
  if (!forceRefresh && creatorsInFlight) {
    return creatorsInFlight;
  }

  creatorsInFlight = (async (): Promise<CreatorsCatalogCache> => {
    const upstream = await fetchWithTimeout(
      `${PAWCHIVE_API}/creators`,
      { headers: { Accept: 'application/json' } },
      30000
    );
    if (!upstream.ok) {
      throw new Error(`Pawchive /creators retornou HTTP ${upstream.status}`);
    }
    const items = (await upstream.json()) as PawchiveCreator[];
    const byKey = new Map<string, PawchiveCreator>();
    const services: Record<string, number> = {};

    for (const creator of items) {
      byKey.set(`${creator.service}:${creator.id}`, creator);
      services[creator.service] = (services[creator.service] || 0) + 1;
    }

    const nextCache: CreatorsCatalogCache = {
      items,
      byKey,
      services,
      fetchedAt: Date.now(),
    };
    creatorsCache = nextCache;
    return nextCache;
  })();

  try {
    return await creatorsInFlight;
  } finally {
    creatorsInFlight = null;
  }
}

function enrichPostsWithCreators<T extends { service?: string; user?: string }>(
  posts: T[],
  byKey?: Map<string, PawchiveCreator>
): (T & { creator_name?: string; creator_public_id?: string | null })[] {
  if (!byKey) return posts;
  return posts.map((post) => {
    const key = `${post.service || ''}:${post.user || ''}`;
    const creator = byKey.get(key);
    return {
      ...post,
      creator_name: creator?.name,
      creator_public_id: creator?.public_id ?? null,
    };
  });
}

async function proxyJson(
  req: Request,
  res: Response,
  upstreamUrl: string,
  options: { method?: string; body?: BodyInit; headers?: Record<string, string>; requireAuth?: boolean; enrichPosts?: boolean } = {}
) {
  try {
    const auth = getSessionFromReq(req);
    if (options.requireAuth && !auth) {
      res.status(401).json({
        error: 'Autenticação necessária na conta Pawchive para esta operação.',
        status: 401,
      });
      return;
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };
    if (auth?.session.pawchiveCookie) {
      headers.Cookie = auth.session.pawchiveCookie;
    }

    const upstream = await fetchWithTimeout(upstreamUrl, {
      method: options.method || 'GET',
      headers,
      body: options.body,
    });

    const contentType = upstream.headers.get('content-type') || '';
    const text = await upstream.text();

    let payload: unknown = text;
    if (contentType.includes('application/json') || text.startsWith('{') || text.startsWith('[')) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    } else if (!upstream.ok) {
      payload = { error: text || upstream.statusText || 'Erro na API externa', status: upstream.status };
    }

    if (upstream.ok && options.enrichPosts && Array.isArray(payload)) {
      const catalog = creatorsCache ?? (await getCreatorsCatalog().catch(() => null));
      payload = enrichPostsWithCreators(payload, catalog?.byKey);
    }

    res.status(upstream.status).json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha de comunicação com a API Pawchive';
    const isAbort = err instanceof Error && err.name === 'AbortError';
    res.status(isAbort ? 504 : 502).json({
      error: isAbort ? 'Tempo limite excedido ao consultar a API Pawchive.' : message,
      status: isAbort ? 504 : 502,
    });
  }
}

export function createApiApp() {
  const app = express();

  // Safe JSON / URL-encoded body parsers that won't hang if Vercel already parsed req.body
  const jsonParser = express.json({ limit: '1mb' });
  const urlencodedParser = express.urlencoded({ extended: true, limit: '1mb' });
  app.use((req, res, next) => {
    if (req.body !== undefined && req.body !== null) {
      next();
      return;
    }
    jsonParser(req, res, next);
  });
  app.use((req, res, next) => {
    if (req.body !== undefined && req.body !== null) {
      next();
      return;
    }
    urlencodedParser(req, res, next);
  });

  const isVercel = process.env.VERCEL === '1';

  // Health & App Version
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'SpaceX', runtime: isVercel ? 'vercel' : 'node', timestamp: new Date().toISOString() });
  });

  app.get('/api/pawchive/app_version', (req, res) => {
    proxyJson(req, res, `${PAWCHIVE_API}/app_version`);
  });

  // Creators Directory (Cached, Filtered, Sorted & Paginated Server-Side)
  app.get('/api/pawchive/creators', async (req, res) => {
    try {
      const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const catalog = await getCreatorsCatalog(forceRefresh);

      const q = String(req.query.q || '').trim().toLowerCase();
      const service = String(req.query.service || 'all').trim().toLowerCase();
      const sort = String(req.query.sort || 'favorited').trim();
      const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
      const pageSize = Math.min(60, Math.max(6, Number.parseInt(String(req.query.pageSize || '24'), 10) || 24));

      let filtered = catalog.items;

      if (service !== 'all' && service !== '') {
        filtered = filtered.filter((c) => c.service.toLowerCase() === service);
      }

      if (q) {
        filtered = filtered.filter((c) => {
          const nameMatch = c.name?.toLowerCase().includes(q);
          const idMatch = c.id?.toLowerCase().includes(q);
          const pubMatch = c.public_id ? c.public_id.toLowerCase().includes(q) : false;
          return nameMatch || idMatch || pubMatch;
        });
      }

      const sorted = [...filtered];
      if (q && (sort === 'relevance' || req.query.smart === '1')) {
        sorted.sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          const aPub = (a.public_id || '').toLowerCase();
          const bPub = (b.public_id || '').toLowerCase();
          const aExact = aName === q || aPub === q || a.id.toLowerCase() === q ? 3 : 0;
          const bExact = bName === q || bPub === q || b.id.toLowerCase() === q ? 3 : 0;
          if (aExact !== bExact) return bExact - aExact;
          const aStarts = aName.startsWith(q) || aPub.startsWith(q) ? 2 : 0;
          const bStarts = bName.startsWith(q) || bPub.startsWith(q) ? 2 : 0;
          if (aStarts !== bStarts) return bStarts - aStarts;
          return (b.favorited || 0) - (a.favorited || 0);
        });
      } else if (sort === 'favorited') {
        sorted.sort((a, b) => (b.favorited || 0) - (a.favorited || 0));
      } else if (sort === 'updated') {
        sorted.sort((a, b) => (b.updated || 0) - (a.updated || 0));
      } else if (sort === 'indexed') {
        sorted.sort((a, b) => (b.indexed || 0) - (a.indexed || 0));
      } else if (sort === 'name') {
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }

      const total = sorted.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const safePage = Math.min(page, totalPages);
      const start = (safePage - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize);

      res.json({
        total,
        totalCatalog: catalog.items.length,
        page: safePage,
        pageSize,
        totalPages,
        services: catalog.services,
        cachedAt: catalog.fetchedAt,
        items,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Erro ao carregar catálogo de criadores.',
        status: 502,
      });
    }
  });

  // Batch Creator Lookup
  app.post('/api/pawchive/creators/lookup', async (req, res) => {
    try {
      const keys = Array.isArray(req.body?.keys) ? (req.body.keys as string[]) : [];
      const catalog = await getCreatorsCatalog();
      const result: Record<string, PawchiveCreator> = {};
      for (const k of keys.slice(0, 100)) {
        const found = catalog.byKey.get(String(k));
        if (found) result[k] = found;
      }
      res.json({ creators: result });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Erro ao consultar criadores.',
      });
    }
  });

  // Recent / Search Posts (stepping of 50 enforced by Pawchive API)
  app.get('/api/pawchive/posts', (req, res) => {
    const params = new URLSearchParams();
    const q = String(req.query.q || '').trim();
    const rawOffset = Number.parseInt(String(req.query.o || '0'), 10) || 0;
    const alignedOffset = Math.max(0, Math.floor(rawOffset / 50) * 50);
    if (q) params.set('q', q);
    if (alignedOffset > 0) params.set('o', String(alignedOffset));
    const qs = params.toString();
    proxyJson(req, res, `${PAWCHIVE_API}/posts${qs ? `?${qs}` : ''}`, { enrichPosts: true });
  });

  // Creator Profile, Posts, Announcements, Fancards, Links, Tags
  app.get('/api/pawchive/creator/:service/:creatorId/profile', (req, res) => {
    const { service, creatorId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/profile`
    );
  });

  app.get('/api/pawchive/creator/:service/:creatorId/posts', (req, res) => {
    const { service, creatorId } = req.params;
    const params = new URLSearchParams();
    const q = String(req.query.q || '').trim();
    const tag = String(req.query.tag || '').trim();
    const rawOffset = Number.parseInt(String(req.query.o || '0'), 10) || 0;
    const alignedOffset = Math.max(0, Math.floor(rawOffset / 50) * 50);
    if (tag) params.set('tag', tag);
    else if (q) params.set('q', q);
    if (alignedOffset > 0) params.set('o', String(alignedOffset));
    const qs = params.toString();
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}${qs ? `?${qs}` : ''}`,
      { enrichPosts: true }
    );
  });

  app.get('/api/pawchive/creator/:service/:creatorId/announcements', (req, res) => {
    const { service, creatorId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/announcements`
    );
  });

  app.get('/api/pawchive/creator/:service/:creatorId/fancards', (req, res) => {
    const { service, creatorId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/fancards`
    );
  });

  app.get('/api/pawchive/creator/:service/:creatorId/links', (req, res) => {
    const { service, creatorId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/links`
    );
  });

  app.get('/api/pawchive/creator/:service/:creatorId/tags', (req, res) => {
    const { service, creatorId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/tags`
    );
  });

  // Single Post, Revisions, Comments, Flag
  app.get('/api/pawchive/post/:service/:creatorId/:postId', async (req, res) => {
    const { service, creatorId, postId } = req.params;
    try {
      const auth = getSessionFromReq(req);
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (auth?.session.pawchiveCookie) headers.Cookie = auth.session.pawchiveCookie;

      const upstream = await fetchWithTimeout(
        `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/post/${encodeURIComponent(postId)}`,
        { headers }
      );
      const text = await upstream.text();
      const data = JSON.parse(text);
      if (upstream.ok && data && typeof data === 'object' && !Array.isArray(data)) {
        const catalog = creatorsCache ?? (await getCreatorsCatalog().catch(() => null));
        const creator = catalog?.byKey.get(`${service}:${creatorId}`);
        if (creator) {
          data.creator_name = creator.name;
          data.creator_public_id = creator.public_id;
        }
      }
      res.status(upstream.status).json(data);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Erro ao carregar publicação.' });
    }
  });

  app.get('/api/pawchive/post/:service/:creatorId/:postId/revisions', (req, res) => {
    const { service, creatorId, postId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/post/${encodeURIComponent(postId)}/revisions`
    );
  });

  app.get('/api/pawchive/post/:service/:creatorId/:postId/comments', (req, res) => {
    const { service, creatorId, postId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/post/${encodeURIComponent(postId)}/comments`
    );
  });

  app.get('/api/pawchive/post/:service/:creatorId/:postId/flag', (req, res) => {
    const { service, creatorId, postId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/post/${encodeURIComponent(postId)}/flag`
    );
  });

  app.post('/api/pawchive/post/:service/:creatorId/:postId/flag', (req, res) => {
    const { service, creatorId, postId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/${encodeURIComponent(service)}/user/${encodeURIComponent(creatorId)}/post/${encodeURIComponent(postId)}/flag`,
      { method: 'POST', requireAuth: true }
    );
  });

  // SHA-256 File Hash Lookup
  app.get('/api/pawchive/search_hash/:hash', (req, res) => {
    const cleanHash = req.params.hash.trim();
    if (!/^[a-fA-F0-9]{16,128}$/.test(cleanHash)) {
      res.status(400).json({ error: 'Informe um hash SHA-256 hexadecimal válido.' });
      return;
    }
    proxyJson(req, res, `${PAWCHIVE_API}/search_hash/${encodeURIComponent(cleanHash)}`);
  });

  // Stateless Secure Account Session Proxy
  app.get('/api/auth/session', (req, res) => {
    const auth = getSessionFromReq(req);
    if (!auth) {
      res.json({ authenticated: false });
      return;
    }
    res.json({
      authenticated: true,
      username: auth.session.username || 'Conta Pawchive Conectada',
      method: auth.session.method,
      connectedAt: auth.session.createdAt,
    });
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password, sessionToken } = (req.body || {}) as {
        username?: string;
        password?: string;
        sessionToken?: string;
      };

      let pawchiveCookie = '';
      let method: 'credentials' | 'session_token' = 'credentials';

      if (sessionToken && sessionToken.trim()) {
        method = 'session_token';
        const raw = sessionToken.trim();
        pawchiveCookie = raw.includes('=') ? raw : `session=${raw}`;
      } else if (username && password) {
        const body = new URLSearchParams({
          username: username.trim(),
          password,
          location: '/artists',
        });
        const loginResp = await fetchWithTimeout(`${PAWCHIVE_BASE}/account/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
          redirect: 'manual',
        });

        const getSetCookie = (loginResp.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
        const setCookies = typeof getSetCookie === 'function' ? getSetCookie.call(loginResp.headers) : [];
        const fallbackCookie = loginResp.headers.get('set-cookie');
        const cookieList = setCookies.length > 0 ? setCookies : fallbackCookie ? [fallbackCookie] : [];

        pawchiveCookie = cookieList
          .map((c) => c.split(';')[0].trim())
          .filter(Boolean)
          .join('; ');

        if (!pawchiveCookie) {
          res.status(401).json({
            error: 'Credenciais inválidas ou sessão não autorizada pelo servidor Pawchive.',
          });
          return;
        }
      } else {
        res.status(400).json({ error: 'Informe usuário e senha ou token de sessão autorizado.' });
        return;
      }

      const verify = await fetchWithTimeout(`${PAWCHIVE_API}/account/favorites?type=artist`, {
        headers: {
          Accept: 'application/json',
          Cookie: pawchiveCookie,
        },
      });

      if (!verify.ok) {
        res.status(401).json({
          error: 'Não foi possível validar a autenticação na conta Pawchive (HTTP ' + verify.status + ').',
        });
        return;
      }

      const encryptedSid = encryptSession({
        pawchiveCookie,
        username: username?.trim() || 'Sessão Autorizada',
        method,
        createdAt: Date.now(),
      });

      const secureFlag = isVercel || req.secure ? '; Secure' : '';
      res.setHeader(
        'Set-Cookie',
        `spacex_sid=${encodeURIComponent(encryptedSid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secureFlag}`
      );
      res.json({
        authenticated: true,
        username: username?.trim() || 'Sessão Autorizada',
        method,
      });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Falha ao autenticar no serviço externo.',
      });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    const secureFlag = isVercel || req.secure ? '; Secure' : '';
    res.setHeader('Set-Cookie', `spacex_sid=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`);
    res.json({ authenticated: false });
  });

  // Account Favorites Sync Endpoints (require valid Pawchive session)
  app.get('/api/pawchive/account/favorites', (req, res) => {
    const type = req.query.type === 'post' ? 'post' : 'artist';
    proxyJson(req, res, `${PAWCHIVE_API}/account/favorites?type=${type}`, { requireAuth: true });
  });

  app.post('/api/pawchive/favorites/creator/:service/:creatorId', (req, res) => {
    const { service, creatorId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/favorites/creator/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}`,
      { method: 'POST', requireAuth: true }
    );
  });

  app.delete('/api/pawchive/favorites/creator/:service/:creatorId', (req, res) => {
    const { service, creatorId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/favorites/creator/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}`,
      { method: 'DELETE', requireAuth: true }
    );
  });

  app.post('/api/pawchive/favorites/post/:service/:creatorId/:postId', (req, res) => {
    const { service, creatorId, postId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/favorites/post/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/${encodeURIComponent(postId)}`,
      { method: 'POST', requireAuth: true }
    );
  });

  app.delete('/api/pawchive/favorites/post/:service/:creatorId/:postId', (req, res) => {
    const { service, creatorId, postId } = req.params;
    proxyJson(
      req,
      res,
      `${PAWCHIVE_API}/favorites/post/${encodeURIComponent(service)}/${encodeURIComponent(creatorId)}/${encodeURIComponent(postId)}`,
      { method: 'DELETE', requireAuth: true }
    );
  });

  // Authorized Importer Proxy (/api/v1/importer/submit)
  app.post('/api/pawchive/importer/submit', async (req, res) => {
    try {
      const { service, session_key, device_id, auth_id, x_bc, user_agent } = (req.body || {}) as Record<string, string>;

      if (!service || !session_key || !session_key.trim()) {
        res.status(400).json({ error: 'Selecione a plataforma e informe a chave/token de autorização.' });
        return;
      }

      const form = new URLSearchParams();
      form.set('service', service.trim());
      form.set('session_key', session_key.trim());
      if (device_id?.trim()) form.set('device_id', device_id.trim());
      if (auth_id?.trim()) form.set('auth_id', auth_id.trim());
      if (x_bc?.trim()) form.set('x-bc', x_bc.trim());
      if (user_agent?.trim()) form.set('user_agent', user_agent.trim());

      const auth = getSessionFromReq(req);
      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, text/plain, */*',
      };
      if (auth?.session.pawchiveCookie) {
        headers.Cookie = auth.session.pawchiveCookie;
      }

      const upstream = await fetchWithTimeout(
        `${PAWCHIVE_API}/importer/submit`,
        {
          method: 'POST',
          headers,
          body: form.toString(),
        },
        30000
      );

      const text = await upstream.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      if (upstream.ok) {
        creatorsCache = null;
        res.json({
          success: true,
          status: upstream.status,
          message: 'Solicitação de importação enviada e aceita pela API Pawchive.',
          data: parsed,
        });
      } else {
        const errMsg =
          typeof parsed === 'object' && parsed !== null && 'error' in parsed
            ? String((parsed as { error: unknown }).error)
            : typeof parsed === 'string' && parsed.length < 300 && !parsed.includes('<html')
              ? parsed
              : `A API retornou status ${upstream.status} (${upstream.statusText || 'Erro na importação'}). Verifique se a chave de autorização é válida e está ativa.`;

        res.status(upstream.status).json({
          success: false,
          status: upstream.status,
          error: errMsg,
        });
      }
    } catch (err) {
      res.status(502).json({
        success: false,
        error: err instanceof Error ? err.message : 'Erro ao enviar importação para a API.',
      });
    }
  });

  // SSRF-Protected Media & Video Range Proxy (redirects >4MB on Vercel)
  app.get('/api/media', async (req, res) => {
    const rawUrl = String(req.query.url || '');
    const parsed = isAllowedPawchiveUrl(rawUrl);
    if (!parsed) {
      res.status(400).json({ error: 'URL de mídia não autorizada.' });
      return;
    }

    const isThumbnailCdnRequest = parsed.hostname === 'img.pawchive.pw' && parsed.pathname.startsWith('/thumbnail/');
    let releaseTransfer: (() => void) | null = null;
    let streaming = false;
    try {
      if (!isThumbnailCdnRequest) releaseTransfer = await pawchiveDownloadGate.acquireTransfer();
      const auth = getSessionFromReq(req);
      const upstreamHeaders: Record<string, string> = {
        Accept: '*/*',
        'User-Agent': 'SpaceX-Platform/1.0 (+https://spacex-posts.vercel.app)',
        Referer: 'https://pawchive.pw/',
        Origin: 'https://pawchive.pw',
      };
      if (auth?.session.pawchiveCookie) upstreamHeaders.Cookie = auth.session.pawchiveCookie;
      if (req.headers.range) {
        upstreamHeaders.Range = String(req.headers.range);
      }
      if (req.headers['if-range']) {
        upstreamHeaders['If-Range'] = String(req.headers['if-range']);
      }

      const upstream = await fetchPawchiveResource(
        parsed.toString(),
        { headers: upstreamHeaders },
        30000,
        isThumbnailCdnRequest ? undefined : () => pawchiveDownloadGate.waitForRequestTurn()
      );
      if ((!upstream.ok && upstream.status !== 206) || !upstream.body) {
        await upstream.body?.cancel().catch(() => {});
        res.status(upstream.status || 404).end();
        return;
      }

      const cl = upstream.headers.get('content-length');
      const contentLenNum = cl ? Number.parseInt(cl, 10) : 0;
      if (isVercel && contentLenNum > VERCEL_MAX_PROXY_BYTES) {
        upstream.body.cancel().catch(() => {});
        res.redirect(302, parsed.toString());
        return;
      }

      res.status(upstream.status);
      const ct = upstream.headers.get('content-type');
      const cr = upstream.headers.get('content-range');
      const ar = upstream.headers.get('accept-ranges') || 'bytes';
      if (ct) res.setHeader('Content-Type', ct);
      if (cl) res.setHeader('Content-Length', cl);
      if (cr) res.setHeader('Content-Range', cr);
      res.setHeader('Accept-Ranges', ar);
      res.setHeader('Cache-Control', 'public, max-age=86400');

      const nodeStream = Readable.fromWeb(upstream.body as unknown as import('node:stream/web').ReadableStream);
      const releaseOnce = () => {
        releaseTransfer?.();
        releaseTransfer = null;
      };
      nodeStream.once('end', releaseOnce);
      nodeStream.once('close', releaseOnce);
      nodeStream.once('error', () => {
        releaseOnce();
        res.destroy();
      });
      res.once('close', () => {
        if (!res.writableEnded) nodeStream.destroy();
      });
      streaming = true;
      nodeStream.pipe(res);
    } catch {
      if (!res.headersSent) res.status(502).end();
    } finally {
      if (!streaming) releaseTransfer?.();
    }
  });

  // SSRF-Protected File Size / MIME Metadata Resolver
  app.get('/api/file-meta', async (req, res) => {
    const rawUrl = String(req.query.url || '');
    const parsed = isAllowedPawchiveUrl(rawUrl);
    if (!parsed) {
      res.status(400).json({ error: 'URL de arquivo não autorizada.' });
      return;
    }

    const cached = fileMetaCache.get(parsed.toString());
    if (cached && Date.now() - cached.ts < 30 * 60 * 1000) {
      res.json({ ok: true, contentLength: cached.contentLength, contentType: cached.contentType });
      return;
    }

    let releaseTransfer: (() => void) | null = null;
    try {
      releaseTransfer = await pawchiveDownloadGate.acquireTransfer();
      const head = await fetchPawchiveResource(
        parsed.toString(),
        { method: 'HEAD', headers: { Referer: 'https://pawchive.pw/', Origin: 'https://pawchive.pw' } },
        10000,
        () => pawchiveDownloadGate.waitForRequestTurn()
      );
      const clRaw = head.headers.get('content-length');
      const contentLength = clRaw ? Number.parseInt(clRaw, 10) : null;
      const contentType = head.headers.get('content-type');
      fileMetaCache.set(parsed.toString(), {
        contentLength: Number.isFinite(contentLength) ? contentLength : null,
        contentType,
        ts: Date.now(),
      });
      res.json({
        ok: head.ok,
        contentLength: Number.isFinite(contentLength) ? contentLength : null,
        contentType,
      });
    } catch {
      res.json({ ok: false, contentLength: null, contentType: null });
    } finally {
      releaseTransfer?.();
    }
  });

  // SSRF-protected streamer. Pawchive allows at most one new request per second
  // and five active downloads; acquire the slot before contacting file servers.
  app.get('/api/download', async (req, res) => {
    const rawUrl = String(req.query.url || '');
    const requestedName = String(req.query.filename || 'spacex-download')
      .replace(/[\r\n"/\\]/g, '_')
      .slice(0, 255);
    const primarySource = isAllowedPawchiveUrl(rawUrl);
    if (!primarySource) {
      res.status(400).json({ error: 'URL de download não autorizada.' });
      return;
    }

    const rawCandidates = req.query.candidate;
    const candidateValues = Array.isArray(rawCandidates)
      ? rawCandidates.filter((value): value is string => typeof value === 'string')
      : typeof rawCandidates === 'string'
        ? [rawCandidates]
        : [];
    const sourceUrls = [primarySource];
    for (const value of candidateValues.slice(0, 5)) {
      const candidate = isAllowedPawchiveUrl(value);
      if (candidate && !sourceUrls.some((source) => source.toString() === candidate.toString())) {
        sourceUrls.push(candidate);
      }
    }

    const candidates: URL[] = [];
    const seenCandidates = new Set<string>();
    const addCandidate = (candidate: URL) => {
      const key = candidate.toString();
      if (!seenCandidates.has(key)) {
        seenCandidates.add(key);
        candidates.push(candidate);
      }
    };
    for (const source of sourceUrls) {
      addCandidate(source);
      const nodeMatch = source.hostname.match(/^n([1-4])\.pawchive\.pw$/i);
      if (nodeMatch && source.pathname.startsWith('/data/')) {
        for (let node = 1; node <= 4; node += 1) {
          const mirror = new URL(source);
          mirror.hostname = `n${node}.pawchive.pw`;
          addCandidate(mirror);
        }
      }
    }

    const mediaExtension = /\.(?:png|jpe?g|webp|gif|bmp|avif|psd|clip|tiff?|mp4|webm|mov|mkv|avi|flv|m4v|mp3|wav|flac|ogg|m4a|aac|apk|aab|xapk|zip|rar|7z|tar|gz|bz2|pdf|doc|docx|epub)$/i.test(requestedName);
    let releaseTransfer: (() => void) | null = null;
    let streaming = false;

    try {
      releaseTransfer = await pawchiveDownloadGate.acquireTransfer();
      if (res.destroyed) return;

      let selected: {
        response: globalThis.Response;
        sourceUrl: URL;
        reader: ReadableStreamDefaultReader<Uint8Array>;
        firstChunks: Uint8Array[];
        firstDone: boolean;
        contentType: string;
      } | null = null;
      let lastStatus = 404;
      let rejectedPayload = false;
      let rateLimited = false;

      for (const candidateUrl of candidates) {
        let upstream: globalThis.Response;
        try {
          const headers: Record<string, string> = {
            Accept: '*/*',
            'User-Agent': 'SpaceX-Platform/1.0 (+https://spacex-posts.vercel.app)',
            Referer: 'https://pawchive.pw/',
            Origin: 'https://pawchive.pw',
          };
          const auth = getSessionFromReq(req);
          if (auth?.session.pawchiveCookie) headers.Cookie = auth.session.pawchiveCookie;
          upstream = await fetchPawchiveResource(
            candidateUrl.toString(),
            { headers },
            15000,
            () => pawchiveDownloadGate.waitForRequestTurn()
          );
        } catch {
          lastStatus = 502;
          continue;
        }

        if (!upstream.ok || !upstream.body) {
          lastStatus = upstream.status || lastStatus;
          if (upstream.status === 429) {
            rateLimited = true;
            await upstream.body?.cancel().catch(() => {});
            break;
          }
          if (upstream.status === 403 && upstream.body) {
            const errorReader = upstream.body.getReader();
            const errorChunk = await errorReader.read().catch(() => ({ done: true, value: undefined }));
            const sourceMessage = errorChunk.value
              ? Buffer.from(errorChunk.value).toString('utf8')
              : '';
            await errorReader.cancel().catch(() => {});
            if (/are you a bot|request per second|active downloads|rate.?limit/i.test(sourceMessage)) {
              rateLimited = true;
              break;
            }
          } else {
            await upstream.body?.cancel().catch(() => {});
          }
          continue;
        }

        const contentType = (upstream.headers.get('content-type') || 'application/octet-stream').toLowerCase();
        const reader = upstream.body.getReader();
        const firstChunks: Uint8Array[] = [];
        let initialBytes = 0;
        let firstDone = false;
        while (initialBytes < 512) {
          const first = await reader.read();
          if (first.done) {
            firstDone = true;
            break;
          }
          if (first.value?.byteLength) {
            firstChunks.push(first.value);
            initialBytes += first.value.byteLength;
          }
        }
        const signatureBytes = Buffer.concat(firstChunks.map((chunk) => Buffer.from(chunk)));
        const prefix = signatureBytes.subarray(0, 512).toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
        const extension = requestedName.toLowerCase().match(/\.([a-z0-9]{1,16})$/)?.[1] || '';
        const htmlFile = extension === 'html' || extension === 'htm';
        const jsonFile = extension === 'json' || extension === 'jsonl' || extension === 'ndjson';
        const knownTextFile = /\.(?:txt|md|csv|rtf|json|jsonl|ndjson|xml|yaml|yml|srt|vtt|log|html|htm|ini|cfg|conf|css|js|ts|sql|sh|bat)$/i.test(requestedName);
        const htmlBody = /^(?:<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>])/.test(prefix);
        const htmlType = contentType.includes('text/html') || contentType.includes('application/xhtml+xml') || htmlBody;
        const textType = contentType.startsWith('text/') || contentType.includes('application/json') || contentType.includes('application/xml') || contentType.includes('+xml');
        const jsonBody = /^[\[{]/.test(prefix);
        const jsonPayload = contentType.includes('json') || (jsonBody && !knownTextFile);
        const looksLikeError = /(?:404\s+(?:not found|error)|403\s+forbidden|not found|forbidden|unauthorized|access denied|are you a bot|checking your browser|too many requests|rate.?limit)/i.test(prefix);
        const invalidHtml = htmlType && (!htmlFile || looksLikeError);
        const unexpectedText = textType && !knownTextFile;
        const mismatchedJson = jsonPayload && !jsonFile;
        const errorText = looksLikeError;
        const validSignature = matchesKnownFileSignature(requestedName, signatureBytes);
        if (invalidHtml || unexpectedText || mismatchedJson || errorText || validSignature === false || (mediaExtension && textType)) {
          rejectedPayload = true;
          await reader.cancel().catch(() => {});
          continue;
        }

        selected = { response: upstream, sourceUrl: candidateUrl, reader, firstChunks, firstDone, contentType };
        break;
      }

      if (!selected) {
        res.status(rateLimited ? 503 : 502).json({
          error: rejectedPayload
            ? 'A origem devolveu HTML, JSON/texto de erro ou bytes incompatíveis com a extensão solicitada. Nenhuma resposta de erro foi salva como arquivo.'
            : rateLimited
              ? 'A Pawchive recusou temporariamente a transferência. Os downloads agora respeitam o limite de uma requisição por segundo e até cinco transferências simultâneas; aguarde um pouco antes de tentar novamente.'
              : `Arquivo original indisponível nos servidores de mídia (HTTP ${lastStatus}).`,
        });
        return;
      }

      const { response: upstream, sourceUrl, reader, firstChunks, firstDone, contentType } = selected;
      const cl = upstream.headers.get('content-length');
      const contentLenNum = cl ? Number.parseInt(cl, 10) : 0;
      if (isVercel && (!cl || contentLenNum > VERCEL_MAX_PROXY_BYTES)) {
        const directUrl = isAllowedPawchiveUrl(upstream.url) || isAllowedPawchiveUrl(sourceUrl.toString());
        const upstreamDisposition = upstream.headers.get('content-disposition');
        await reader.cancel().catch(() => {});
        if (directUrl && hasAttachmentDisposition(upstreamDisposition)) {
          // The file signature and response type were checked above. Leave the large body at Pawchive,
          // whose attachment header makes the browser download it instead of opening a media player.
          // Reserve a request turn so the browser's follow-up GET still respects Pawchive's 1 req/s limit.
          await pawchiveDownloadGate.waitForRequestTurn();
          res.status(302);
          res.setHeader('Location', directUrl.toString());
          res.setHeader('Cache-Control', 'no-store');
          res.end();
          return;
        }
        res.status(413).json({
          error: 'Este arquivo excede o limite do proxy Vercel, e a origem não confirmou um anexo direto seguro. Use o servidor Node/Container do Preview Manus ou uma fonte que ofereça Content-Disposition: attachment.',
        });
        return;
      }

      const asciiName = requestedName.replace(/[^\x20-\x7E]|["\\;]/g, '_');
      const encodedName = encodeURIComponent(requestedName);
      res.status(upstream.status);
      res.setHeader('Content-Type', contentType);
      if (cl) res.setHeader('Content-Length', cl);
      res.setHeader('Content-Disposition', `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`);

      const nodeStream = Readable.from((async function* () {
        for (const chunk of firstChunks) {
          if (chunk.byteLength) yield Buffer.from(chunk);
        }
        if (!firstDone) {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            if (next.value?.byteLength) yield Buffer.from(next.value);
          }
        }
      })());
      const releaseOnce = () => {
        releaseTransfer?.();
        releaseTransfer = null;
      };
      nodeStream.once('end', releaseOnce);
      nodeStream.once('close', releaseOnce);
      nodeStream.once('error', () => {
        releaseOnce();
        res.destroy();
      });
      res.once('close', () => {
        if (!res.writableEnded) nodeStream.destroy();
      });
      streaming = true;
      nodeStream.pipe(res);
    } catch {
      if (!res.headersSent) res.status(502).json({ error: 'Falha ao transferir arquivo do servidor.' });
      else res.destroy();
    } finally {
      if (!streaming) releaseTransfer?.();
    }
  });

  return app;
}

const vercelApp = createApiApp();

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const parsed = new URL(req.url || '/api/health', 'http://localhost');
    const rewrittenPath = parsed.searchParams.get('__path');

    if (rewrittenPath !== null) {
      parsed.searchParams.delete('__path');
      const cleanSubpath = rewrittenPath.replace(/^\/+/, '');
      const qs = parsed.searchParams.toString();
      req.url = `/api/${cleanSubpath}${qs ? `?${qs}` : ''}`;
    } else if (parsed.pathname === '/' || parsed.pathname === '/index' || parsed.pathname === '/index.ts') {
      const qs = parsed.searchParams.toString();
      req.url = `/api/health${qs ? `?${qs}` : ''}`;
    } else if (!parsed.pathname.startsWith('/api')) {
      const qs = parsed.searchParams.toString();
      req.url = `/api${parsed.pathname.startsWith('/') ? '' : '/'}${parsed.pathname}${qs ? `?${qs}` : ''}`;
    }

    return vercelApp(req as unknown as Request, res as unknown as Response);
  } catch (err) {
    console.error('Vercel API handler error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Erro interno na função serverless SpaceX.' }));
  }
}
