/**
 * HelloNative adapter — talks to hn-backend via Bearer tokens (not cookies).
 *
 * Works cross-origin, cross-port, and inside iframes. The token lives in
 * sessionStorage (tab-scoped). Expired / revoked tokens are cleared
 * automatically on 401.
 */

import type { AiEditInput, AiEditOutput, ContentDoc, EditorAdapter, MediaItem, Patch, Session } from '../types';

/**
 * Cookie-based adapter (legacy's approach).
 *
 * All calls go same-origin through the tenant site's `/api/*` rewrites,
 * which proxy to hn-backend. The NextAuth session cookie set on the tenant
 * origin during `/auth/signin` is automatically sent.
 *
 * No tokens, no launch URLs — sign in at `/auth/signin` on the tenant and
 * every Studio API call authenticates automatically.
 */
export function createHnAdapter(baseUrl = ''): EditorAdapter {
  const api = (p: string) => `${baseUrl}${p}`;

  async function call<T = any>(path: string, init: RequestInit = {}): Promise<{ res: Response; body: T | null }> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(api(path), { ...init, headers, credentials: 'include' });
    let parsed: T | null = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      try { parsed = (await res.clone().json()) as T; } catch { parsed = null; }
    }
    return { res, body: parsed };
  }

  return {
    async getSession(): Promise<Session | null> {
      // NextAuth session endpoint — returns { user: { id, email, role, organizationId } } or null.
      const { res, body } = await call<any>('/api/auth/session');
      if (!res.ok || !body?.user?.id) return null;
      const u = body.user;
      return {
        userId: u.id,
        orgId: u.organizationId || u.orgId || '',
        role: u.role as Session['role'],
        email: u.email,
        name: u.name,
      };
    },

    async getContent(slug, tenantOrgId) {
      const params = new URLSearchParams({ slug });
      if (tenantOrgId) params.set('organizationId', tenantOrgId);
      const { res, body } = await call<ContentDoc>(`/api/content/by-slug?${params}`);
      if (!res.ok || !body) return null;
      return body;
    },

    async saveContent(docId, orgId, patches) {
      const { res, body } = await call<{ ok: true } | { ok: false; error: string }>(
        `/api/content/${encodeURIComponent(docId)}/patch`,
        {
          method: 'PATCH',
          body: JSON.stringify({ organizationId: orgId, patches }),
        }
      );
      if (!res.ok) return { ok: false, error: (body as any)?.error || `${res.status}` };
      return body || { ok: true };
    },

    async listMedia(orgId, opts) {
      const params = new URLSearchParams();
      params.set('organizationId', orgId);
      params.set('type', 'image');
      if (opts?.query) params.set('search', opts.query);
      if (opts?.page) params.set('page', String(opts.page));
      if (opts?.pageSize) params.set('limit', String(opts.pageSize));
      const { res, body } = await call<{ success: boolean; media: MediaItem[]; files: MediaItem[]; total: number }>(`/api/media?${params}`);
      if (!res.ok || !body) return { items: [], total: 0 };
      const items = body.media || body.files || [];
      return { items, total: body.total ?? items.length };
    },

    async uploadMedia(orgId, file) {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('organizationId', orgId);
      const { res, body } = await call<any>('/api/media/upload', { method: 'POST', body: fd });
      if (!res.ok || !body) throw new Error(`upload failed: ${res.status}`);
      return {
        id: body.id || body.media?.id,
        url: body.url || body.cdnUrl || body.media?.url,
        width: body.width,
        height: body.height,
        filename: body.filename || body.originalName,
        createdAt: body.createdAt,
      } as MediaItem;
    },

    async aiRewrite(orgId, input: AiEditInput): Promise<AiEditOutput> {
      const { res, body } = await call<AiEditOutput>('/api/agentic/inline-edit', {
        method: 'POST',
        body: JSON.stringify({ ...input, organizationId: orgId }),
      });
      if (!res.ok || !body) throw new Error(`AI rewrite failed: ${res.status}`);
      return body;
    },
  };
}

export const hnAdapter = createHnAdapter();
