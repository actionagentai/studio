'use client';

/**
 * Studio toolbar — modelled on hn-builder's preview bar:
 *   [ ← Back | Page · TENANT ]   [ 🖥 📱 📟  EN/ES  ↶ ↷  Save ]
 *
 * 44px dark bar pinned to the top of the viewport. Pushes page content
 * down by 44px when visible.
 */

import { useEffect, useState } from 'react';
import { ArrowLeft, Monitor, Tablet, Smartphone, Undo2, Redo2, Loader2, Check } from 'lucide-react';
import { useEditorState } from '../providers/EditorStateProvider';
import { useAdapter } from '../providers/AdapterProvider';
import { useSession } from '../providers/SessionProvider';

type Viewport = 'desktop' | 'tablet' | 'mobile';

export function GlassToolbar({ pageSlug }: { pageSlug: string }) {
  const { session } = useSession();
  const adapter = useAdapter();
  const {
    doc, patches, redoable, undo, redo, discardAll, saving, setSaving,
  } = useEditorState();
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [lang, setLang] = useState<'en' | 'es'>('en');
  const [toast, setToast] = useState<string | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      if (meta && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); redo(); }
      if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo]);

  // Reserve 44px at the top of the viewport and shift any fixed site header down.
  useEffect(() => {
    document.body.style.paddingTop = '44px';
    document.body.dataset.studioBar = 'on';

    const style = document.createElement('style');
    style.id = '__studio_bar_styles__';
    style.textContent = `
      body[data-studio-bar="on"] > header[class*="fixed"],
      body[data-studio-bar="on"] header[class*="fixed top-0"],
      body[data-studio-bar="on"] nav[class*="fixed top-0"],
      body[data-studio-bar="on"] header.fixed {
        top: 44px !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.body.style.paddingTop = '';
      delete document.body.dataset.studioBar;
      delete document.body.dataset.studioViewport;
      style.remove();
    };
  }, []);

  // Sync viewport data attribute so the CSS above takes effect
  useEffect(() => {
    if (viewport === 'desktop') delete document.body.dataset.studioViewport;
    else document.body.dataset.studioViewport = viewport;
  }, [viewport]);

  async function handleSave() {
    if (!doc || patches.length === 0) return;
    setSaving(true);
    const res = await adapter.saveContent(doc.id, doc.organizationId, patches);
    setSaving(false);
    if (res.ok) {
      discardAll();
      setToast('Saved');
      setTimeout(() => setToast(null), 1600);
    } else {
      setToast(`Error: ${res.error}`);
      setTimeout(() => setToast(null), 3000);
    }
  }

  const dirty = patches.length > 0;
  const title = pageSlug === 'home' ? 'Home' : pageSlug.split('/').pop() || pageSlug;

  return (
    <>
      {/* Studio bar */}
      <div
        role="toolbar"
        aria-label="Studio editor toolbar"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0,
          height: 44,
          background: 'rgb(17,17,17)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          zIndex: 99998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        }}
      >
        {/* LEFT: Back + Page title + tenant */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => { if (typeof window !== 'undefined') window.history.back(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 6,
              fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} /> Back
          </button>
          <div style={{ height: 16, width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 600 }}>
            {title}
          </span>
          {session?.orgId && (
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Studio
            </span>
          )}
        </div>

        {/* RIGHT: viewport + lang + undo/redo + save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Viewport */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px', borderRadius: 8, background: 'rgba(255,255,255,0.06)' }}>
            {([
              { key: 'desktop' as const, Icon: Monitor, label: 'Desktop' },
              { key: 'tablet' as const, Icon: Tablet, label: 'Tablet' },
              { key: 'mobile' as const, Icon: Smartphone, label: 'Mobile' },
            ]).map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => setViewport(key)}
                title={label}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 24,
                  padding: 0,
                  background: viewport === key ? 'rgba(255,255,255,0.2)' : 'transparent',
                  color: viewport === key ? '#fff' : 'rgba(255,255,255,0.6)',
                  border: 0,
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                <Icon style={{ width: 14, height: 14 }} strokeWidth={2} />
              </button>
            ))}
          </div>

          {/* Viewport size label */}
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', minWidth: 52, textAlign: 'center' }}>
            {viewport === 'mobile' ? '375px' : viewport === 'tablet' ? '768px' : '100%'}
          </span>

          {/* Language toggle */}
          <div style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, overflow: 'hidden' }}>
            {(['en', 'es'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  padding: '4px 8px',
                  fontSize: 10, fontWeight: 500,
                  color: lang === l ? '#fff' : 'rgba(255,255,255,0.4)',
                  background: lang === l ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {l}
              </button>
            ))}
          </div>

          <div style={{ height: 16, width: 1, background: 'rgba(255,255,255,0.1)' }} />

          {/* Undo / Redo */}
          <button
            onClick={undo}
            disabled={patches.length === 0}
            title="Undo (⌘Z)"
            style={iconBtnStyle(patches.length === 0)}
          >
            <Undo2 style={{ width: 14, height: 14 }} strokeWidth={2} />
          </button>
          <button
            onClick={redo}
            disabled={redoable.length === 0}
            title="Redo (⌘⇧Z)"
            style={iconBtnStyle(redoable.length === 0)}
          >
            <Redo2 style={{ width: 14, height: 14 }} strokeWidth={2} />
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 6,
              fontSize: 11, fontWeight: 600,
              color: dirty ? '#000' : 'rgba(255,255,255,0.4)',
              background: dirty ? '#fff' : 'rgba(255,255,255,0.06)',
              border: 0,
              cursor: dirty ? 'pointer' : 'default',
              transition: 'opacity 150ms',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving
              ? <><Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> Saving…</>
              : dirty
                ? <><Check style={{ width: 12, height: 12 }} /> Save ({patches.length})</>
                : 'Saved'}
          </button>
        </div>
      </div>

      {/* Real mobile/tablet preview — iframe overlay so CSS + JS breakpoints actually trigger */}
      {viewport !== 'desktop' && typeof window !== 'undefined' && (
        <DevicePreview viewport={viewport} onClose={() => setViewport('desktop')} />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 99999,
            padding: '8px 16px', borderRadius: 6,
            background: 'rgb(17,17,17)',
            color: '#fff',
            fontSize: 12, fontWeight: 500,
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

function DevicePreview({ viewport, onClose }: { viewport: 'mobile' | 'tablet'; onClose: () => void }) {
  const dims = viewport === 'mobile'
    ? { w: 390, h: 844, label: 'iPhone 15 Pro' }
    : { w: 768, h: 1024, label: 'iPad' };

  // Build iframe URL — same page + `?studio-preview=1` so inner Studio suppresses chrome
  const src = (() => {
    const u = new URL(window.location.href);
    u.searchParams.set('studio-preview', '1');
    return u.toString();
  })();

  return (
    <div
      style={{
        position: 'fixed',
        top: 44,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99997,
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: dims.w,
          height: `min(${dims.h}px, calc(100vh - 100px))`,
          maxWidth: '100%',
          background: '#000',
          borderRadius: viewport === 'mobile' ? 36 : 20,
          border: viewport === 'mobile' ? '3px solid #2a2a2a' : '2px solid #2a2a2a',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {viewport === 'mobile' && (
          <div
            aria-hidden
            style={{
              position: 'absolute', top: 8, left: '50%',
              transform: 'translateX(-50%)', zIndex: 20,
              width: 110, height: 28, borderRadius: 999, background: '#000',
              pointerEvents: 'none',
            }}
          />
        )}
        <iframe
          src={src}
          title={`${dims.label} preview`}
          style={{
            width: '100%',
            height: '100%',
            border: 0,
            background: '#fff',
            display: 'block',
          }}
        />
      </div>
      <p style={{ marginTop: 16, color: 'rgba(255,255,255,0.4)', fontSize: 11, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
        {dims.label} · {dims.w}×{dims.h} · click outside to exit
      </p>
    </div>
  );
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 24,
    padding: 0,
    color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
    background: 'transparent',
    border: 0,
    borderRadius: 6,
    cursor: disabled ? 'default' : 'pointer',
  };
}
