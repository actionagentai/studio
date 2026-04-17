/**
 * Mock adapter — the v0 / preview story.
 *
 * Keeps all state in memory. No network. Lets the editor render and demo
 * without a backend. Required for v0 template submissions (reviewers often
 * run templates offline).
 */

import type { AiEditInput, AiEditOutput, ContentDoc, EditorAdapter, MediaItem, Patch, Session } from '../types';

interface MockAdapterOptions {
  /** Seed the mock with an initial session. Defaults to a super_admin so the editor shows. */
  session?: Session | null;
  /** Seed the mock with initial docs (keyed by slug). */
  docs?: Record<string, ContentDoc>;
  /** Seed the mock with media items. */
  media?: MediaItem[];
}

export function createMockAdapter(opts: MockAdapterOptions = {}): EditorAdapter {
  const session: Session | null =
    opts.session === undefined
      ? { userId: 'mock-user', orgId: 'mock-org', role: 'super_admin', email: 'preview@local' }
      : opts.session;

  const docs = new Map<string, ContentDoc>(Object.entries(opts.docs || {}));
  const media: MediaItem[] = opts.media ?? [];

  return {
    async getSession() {
      return session;
    },

    async getContent(slug) {
      return docs.get(slug) ?? null;
    },

    async saveContent(docId, orgId, patches) {
      const doc = [...docs.values()].find((d) => d.id === docId);
      if (!doc) return { ok: false, error: 'doc not found' };
      if (doc.organizationId !== orgId) return { ok: false, error: 'org mismatch' };
      applyPatches(doc.data, patches);
      return { ok: true };
    },

    async listMedia(_orgId, opts) {
      const q = (opts?.query || '').toLowerCase();
      const filtered = q ? media.filter((m) => (m.filename || m.alt || '').toLowerCase().includes(q)) : media;
      return { items: filtered, total: filtered.length };
    },

    async uploadMedia(_orgId, file) {
      // In mock mode just return a blob URL. Good enough for preview.
      const url = URL.createObjectURL(file);
      const item: MediaItem = {
        id: `mock-${Date.now()}`,
        url,
        filename: file.name,
        createdAt: new Date().toISOString(),
      };
      media.unshift(item);
      return item;
    },

    async aiRewrite(_orgId, input: AiEditInput): Promise<AiEditOutput> {
      // Deterministic stub: uppercase the current value at targetPath, or return a single lorem patch.
      const target = input.targetPath || 'sections.hero.title';
      const current = getAtPath(input.doc.data, target);
      const next = typeof current === 'string' ? current.toUpperCase() : '[preview rewrite]';
      const patch: Patch = {
        op: 'set',
        path: target,
        value: next,
        previousValue: current,
        ts: Date.now(),
      };
      return { patches: [patch], summary: 'Preview rewrite (mock adapter)' };
    },
  };
}

// ── tiny utils ───────────────────────────────────────────────

function getAtPath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setAtPath(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  let cur = obj;
  for (const k of keys) {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[last] = value;
}

function removeAtPath(obj: any, path: string): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  let cur = obj;
  for (const k of keys) {
    if (cur[k] == null) return;
    cur = cur[k];
  }
  delete cur[last];
}

function applyPatches(data: any, patches: Patch[]): void {
  for (const p of patches) {
    if (p.op === 'set') setAtPath(data, p.path, p.value);
    else removeAtPath(data, p.path);
  }
}
