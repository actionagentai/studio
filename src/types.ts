/**
 * Studio — Public type surface.
 *
 * Keep this file dependency-free. Anything that wants to implement
 * an adapter or consume the editor imports from here.
 */

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** Minimal content document we operate on. `data` is the JSONB body. */
export interface ContentDoc {
  id: string;
  organizationId: string;
  slug: string;
  title?: string;
  description?: string;
  data: Record<string, JsonValue>;
  seo?: Record<string, JsonValue>;
}

/** A dot-path pointing into ContentDoc.data — e.g. `sections.hero.title.en`. */
export type Path = string;

/** One unit of change. Patches are the source of truth for undo / redo / save. */
export interface Patch {
  op: 'set' | 'remove';
  path: Path;
  value?: JsonValue;
  /** Previous value — stored by the editor so `op:'set'` is reversible. */
  previousValue?: JsonValue;
  /** When the patch was created (ms since epoch). */
  ts: number;
}

/** Current editor session. Returned null = anonymous visitor (no editor chrome). */
export interface Session {
  userId: string;
  orgId: string;
  role: 'super_admin' | 'owner' | 'editor' | 'viewer';
  email?: string;
  name?: string;
}

/** Media library item. */
export interface MediaItem {
  id: string;
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  filename?: string;
  createdAt?: string;
}

/** Input to the AI rewrite endpoint. */
export interface AiEditInput {
  prompt: string;
  /** Current doc (so the AI has full context). */
  doc: ContentDoc;
  /** Optional: limit changes to a single path subtree. */
  targetPath?: Path;
  /** Language the user is editing in. */
  lang?: 'en' | 'es' | 'fr' | 'he';
}

/** Output of the AI rewrite endpoint. Returns a set of patches the editor can preview. */
export interface AiEditOutput {
  patches: Patch[];
  /** Optional explanation the AI produced. Shown in the command bar. */
  summary?: string;
}

/**
 * Adapter — the pluggable backend boundary.
 *
 * Every editor integration (hn-backend, mock/preview, partner sites) implements this.
 * The editor itself knows nothing about your database, auth, or AI provider.
 */
export interface EditorAdapter {
  /** Return the current session or null. Must be SSR-safe. */
  getSession(): Promise<Session | null>;

  /** Load a content doc by slug. If tenantOrgId is passed, scope to that org (for super-admin editing a tenant site); otherwise use the session's own org. */
  getContent(slug: string, tenantOrgId?: string): Promise<ContentDoc | null>;

  /** Commit a batch of patches. Server MUST re-verify orgId vs session. */
  saveContent(docId: string, orgId: string, patches: Patch[]): Promise<{ ok: true } | { ok: false; error: string }>;

  /** Media library (paginated). */
  listMedia(orgId: string, opts?: { query?: string; page?: number; pageSize?: number }): Promise<{ items: MediaItem[]; total: number }>;

  /** Upload a file. Adapter handles storage (R2 / Blob / local). */
  uploadMedia(orgId: string, file: File): Promise<MediaItem>;

  /** AI rewrite. Adapter chooses model + prompt. Mock adapter can return lorem. */
  aiRewrite(orgId: string, input: AiEditInput): Promise<AiEditOutput>;
}

/** Capability flags an adapter can expose so the UI disables things it can't do. */
export interface AdapterCapabilities {
  canSave: boolean;
  canUpload: boolean;
  canAiRewrite: boolean;
  canListMedia: boolean;
}
