'use client';

/**
 * Studio — mount once per app. Auth-gates the editor chrome.
 *
 * Two ways to mount:
 *
 *  A) Preferred (zero config) — uses the HelloNative backend:
 *     import { Studio } from '@hellonative/studio';
 *     <Studio pageSlug="home" />
 *
 *  B) Custom adapter (v0 preview, tests, partners):
 *     'use client';
 *     import { StudioWithAdapter, createMockAdapter } from '@hellonative/studio';
 *     const adapter = createMockAdapter({ ... });
 *     <StudioWithAdapter adapter={adapter} />
 *
 * Renders nothing for anonymous visitors.
 */

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import type { EditorAdapter } from './types';
import { createHnAdapter } from './adapters/hn-adapter';
import { AdapterProvider, useAdapter } from './providers/AdapterProvider';
import { SessionProvider, useSession } from './providers/SessionProvider';
import { EditorStateProvider, useEditorState } from './providers/EditorStateProvider';
import { GlassToolbar } from './chrome/GlassToolbar';
import { AutoEditables } from './auto/AutoEditables';
import { SignInCard } from './chrome/SignInCard';
import { useState } from 'react';

interface StudioProps {
  /** Children to render inside the editor context — normally the whole site. */
  children?: React.ReactNode;
  /** Override the page slug. Defaults to derived-from-pathname (home, roofing, etc.). */
  pageSlug?: string;
  /** Optional base URL for API calls. Defaults to same-origin. */
  apiBaseUrl?: string;
  /**
   * Tenant organizationId — the site's own org (not the user's home org).
   * Required for super-admins editing client sites so media/content scope correctly.
   */
  tenantOrgId?: string;
}

interface StudioWithAdapterProps extends StudioProps {
  adapter: EditorAdapter;
}

/** Default mount — wraps your site with editor providers + chrome. Safe to use from a Server Component. */
export function Studio({ children, pageSlug, apiBaseUrl, tenantOrgId }: StudioProps) {
  return (
    <StudioInner pageSlugOverride={pageSlug} apiBaseUrl={apiBaseUrl} tenantOrgId={tenantOrgId}>
      {children}
    </StudioInner>
  );
}

/** Advanced mount — lets you inject any adapter. Must be called from a Client Component. */
export function StudioWithAdapter({ children, adapter, pageSlug, tenantOrgId }: StudioWithAdapterProps) {
  return (
    <AdapterProvider adapter={adapter}>
      <SessionProvider>
        <EditorStateProvider>
          {children}
          <StudioChrome pageSlugOverride={pageSlug} tenantOrgId={tenantOrgId} />
        </EditorStateProvider>
      </SessionProvider>
    </AdapterProvider>
  );
}

function StudioInner({ children, pageSlugOverride, apiBaseUrl, tenantOrgId }: { children?: React.ReactNode; pageSlugOverride?: string; apiBaseUrl?: string; tenantOrgId?: string }) {
  const adapter = useMemo(() => createHnAdapter(apiBaseUrl || ''), [apiBaseUrl]);
  return (
    <AdapterProvider adapter={adapter}>
      <SessionProvider>
        <EditorStateProvider>
          {children}
          <StudioChrome pageSlugOverride={pageSlugOverride} tenantOrgId={tenantOrgId} />
        </EditorStateProvider>
      </SessionProvider>
    </AdapterProvider>
  );
}

function StudioChrome({ pageSlugOverride, tenantOrgId }: { pageSlugOverride?: string; tenantOrgId?: string }) {
  const { canEdit, loading } = useSession();
  const { setDoc, editMode, toggleEditMode } = useEditorState();
  const adapter = useAdapter();
  const pathname = usePathname();
  const slug = pageSlugOverride ?? pathToSlug(pathname);

  // Suppress ALL Studio chrome when running inside the device-preview iframe
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('studio-preview')) {
    return null;
  }

  // Auto-enter edit mode on first load for authenticated editors.
  // Matches v0 / Webflow / Framer convention: clicking "Edit" from the dashboard
  // lands the user already in edit mode, outlines visible.
  useEffect(() => {
    if (canEdit && !editMode) {
      // Only auto-enter ONCE per mount — user can still toggle off manually
      const flag = '__studio_auto_entered__';
      const w = window as any;
      if (!w[flag]) {
        w[flag] = true;
        toggleEditMode();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    adapter
      .getContent(slug, tenantOrgId)
      .then((doc) => {
        if (cancelled) return;
        if (doc) {
          setDoc(doc);
        } else {
          // No DB row for this slug — stub doc so media/toolbar still scope to tenant org.
          setDoc({ id: `stub-${slug}`, organizationId: tenantOrgId || 'stub', slug, data: {} });
        }
      })
      .catch(() => {
        if (!cancelled) setDoc({ id: `stub-${slug}`, organizationId: tenantOrgId || 'stub', slug, data: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [canEdit, slug, setDoc, adapter, tenantOrgId]);

  if (loading) return null;

  // Not signed in — offer a styled sign-in card (only on localhost, so prod visitors never see it).
  if (!canEdit) return <SignInHint />;

  return (
    <>
      <GlassToolbar pageSlug={slug} />
      <AutoEditables />
    </>
  );
}

function SignInHint() {
  const [open, setOpen] = useState(false);
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  const isDev = host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1';
  if (!isDev) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Sign in to edit"
        style={{
          position: 'fixed', bottom: 18, right: 18, zIndex: 99998,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 999,
          background: '#0a0a0a', color: '#fff',
          font: '600 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          letterSpacing: '0.15em', textTransform: 'uppercase',
          boxShadow: '0 12px 32px -6px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.15)',
          cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" x2="3" y1="12" y2="12" />
        </svg>
        Sign in to edit
      </button>
      {open && <SignInCard onClose={() => setOpen(false)} />}
    </>
  );
}

function pathToSlug(pathname: string | null): string {
  if (!pathname || pathname === '/') return 'home';
  return pathname.replace(/^\/+|\/+$/g, '');
}
