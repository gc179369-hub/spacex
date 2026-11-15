export type NavSection =
  | 'inicio'
  | 'explorar'
  | 'criadores'
  | 'publicacoes'
  | 'favoritos'
  | 'importacao'
  | 'configuracoes';

export interface PawchiveCreator {
  id: string;
  name: string;
  public_id: string | null;
  service: string;
  indexed: number;
  updated: number;
  favorited: number;
  ever_imported: boolean;
}

export interface CreatorsCatalogResponse {
  total: number;
  totalCatalog: number;
  page: number;
  pageSize: number;
  totalPages: number;
  services: Record<string, number>;
  cachedAt: number;
  items: PawchiveCreator[];
}

export interface PawchiveCreatorProfile {
  id: string;
  name: string;
  service: string;
  indexed: string;
  updated: string;
  public_id: string | null;
  relation_id: string | null;
  ever_imported?: boolean;
}

export interface PawchiveAnnouncement {
  service: string;
  user_id: string;
  hash: string;
  content: string;
  added: string;
}

export interface PawchiveFancard {
  id: number;
  user_id: string;
  file_id: number;
  hash: string;
  mtime: string;
  ctime: string;
  mime: string;
  ext: string;
  added: string;
  size: number;
  ihash: string | null;
}

export interface PawchiveTag {
  tag: string;
  post_count: number;
}

export interface PawchiveFile {
  name?: string;
  path?: string;
  server?: string;
  temp_url?: string;
  temp_download_url?: string;
  temp_expires?: string;
  deferred?: boolean;
  preview_only?: boolean;
}

export interface PawchivePostSummary {
  id: string;
  user: string;
  service: string;
  title: string;
  substring?: string;
  content?: string;
  published: string;
  added?: string;
  edited?: string;
  file?: PawchiveFile;
  attachments?: PawchiveFile[];
  preview_state?: string;
  has_full?: boolean;
  origin?: string;
  creator_name?: string;
  creator_public_id?: string | null;
}

export interface PawchivePostDetail extends PawchivePostSummary {
  content: string;
  embed?: {
    url?: string;
    subject?: string;
    description?: string;
  };
  shared_file?: boolean;
  poll?: unknown;
  captions?: unknown;
  tags?: string | string[];
  detail_fetched?: boolean;
  next?: string | null;
  prev?: string | null;
}

export interface PawchiveRevision {
  revision_id: number;
  added: string;
  title: string;
  content: string;
  file?: PawchiveFile;
  attachments?: PawchiveFile[];
}

export interface PawchiveComment {
  id: string;
  parent_id: string | null;
  commenter: string;
  commenter_name: string;
  content: string;
  published: string;
  revisions?: { content: string; added: string }[];
}

export interface ExternalAuthorizedLink {
  url: string;
  label: string;
  provider: 'Google Drive' | 'Mega' | 'Dropbox' | 'Fantia' | 'Pixiv' | 'Patreon' | 'Link Externo';
}

export interface FileClassification {
  kind: 'video' | 'android' | 'image' | 'audio' | 'archive' | 'document' | 'other';
  actionLabel: string;
  typeLabel: string;
}

export interface AuthSessionState {
  authenticated: boolean;
  username?: string;
  method?: string;
  connectedAt?: number;
}

export interface UserPreferences {
  blurSensitiveThumbnails: boolean;
  defaultCreatorSort: 'favorited' | 'updated' | 'indexed' | 'name';
  defaultPageSize: number;
  compactCards: boolean;
}
