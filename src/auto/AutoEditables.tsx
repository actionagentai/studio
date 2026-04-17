'use client';

/**
 * AutoEditables — zero-configuration editing layer.
 *
 * Reads the current content doc, builds a map of image URLs → JSON paths,
 * then watches the DOM for any <img> / <video> / <source> elements and
 * overlays a pencil on the ones whose src we can map back to a path.
 *
 * Consumer setup required: mount <Studio> in the layout. That's it.
 * No wrappers needed in templates — every DB-backed image is editable.
 */

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import { useEditorState } from '../providers/EditorStateProvider';
import { useSession } from '../providers/SessionProvider';
import { MediaPicker } from '../media/MediaPicker';
import { buildUrlPathMap, normalizeUrl, type UrlMapEntry } from './buildUrlPathMap';

interface Discovered {
  el: HTMLElement;
  path: string;
  label?: string;
  kind: 'image' | 'video';
  src: string;
}

const SELECTOR = 'img, video, source, [data-studio-bg]';

export function AutoEditables() {
  const { canEdit } = useSession();
  const { editMode, doc, apply, valueAt, patches } = useEditorState();
  const [discovered, setDiscovered] = useState<Discovered[]>([]);
  const [openFor, setOpenFor] = useState<{ path: string; url: string; label?: string; kind: 'image' | 'video' } | null>(null);

  const urlMap = useMemo(() => {
    if (!doc?.data) return new Map();
    return buildUrlPathMap(doc.data);
  }, [doc?.data]);

  // Enhance the map with live (patched) URLs too, so previously-edited images still
  // have pencils after the DOM has been mutated to their new src.
  const liveUrlMap = useMemo(() => {
    const m = new Map(urlMap);
    for (const p of patches) {
      if (p.op === 'set' && typeof p.value === 'string') {
        const prev = urlMap.get(String(p.previousValue || ''));
        m.set(p.value as string, prev || { path: p.path, kind: /\.(mp4|webm|mov)/.test(String(p.value)) ? 'video' : 'image' });
      }
    }
    return m;
  }, [urlMap, patches]);

  // DOM scan — runs in edit mode, re-runs on DOM mutations or map changes
  useEffect(() => {
    if (!canEdit || !editMode) { setDiscovered([]); return; }

    const scan = () => {
      const found: Discovered[] = [];
      const seenSrc = new Set<string>();
      const nodes = document.querySelectorAll<HTMLElement>(SELECTOR);
      nodes.forEach((el) => {
        const rawSrc = (el as HTMLImageElement).src
          || (el as HTMLVideoElement).src
          || (el as HTMLSourceElement).src
          || (el as any).dataset?.studioBg
          || '';
        const src = normalizeUrl(rawSrc);
        if (!src) return;
        // Skip any element already marked as having a Studio wrapper — prevents double pencils
        if (el.closest('[data-studio-editable]')) return;
        // De-dupe by src — first wins so repeated thumbs don't pile up
        if (seenSrc.has(src)) return;
        const hit = liveUrlMap.get(src);
        if (!hit) return;
        seenSrc.add(src);
        found.push({ el, path: hit.path, label: hit.label, kind: hit.kind, src });
      });
      setDiscovered(found);
    };

    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    return () => mo.disconnect();
  }, [canEdit, editMode, liveUrlMap]);

  // When a patch changes a URL, find the matching DOM element(s) and mutate their src
  // so the page reflects the edit immediately without waiting for Save + reload.
  useEffect(() => {
    const last = patches[patches.length - 1];
    if (!last || last.op !== 'set' || typeof last.value !== 'string') return;
    const oldSrc = typeof last.previousValue === 'string' ? last.previousValue : null;
    const newSrc = last.value as string;
    if (!oldSrc) return;
    const normalizedOld = normalizeUrl(oldSrc);
    if (!normalizedOld) return;
    document.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
      const raw = (el as any).src || (el as any).dataset?.studioBg;
      const n = normalizeUrl(raw);
      if (n === normalizedOld) {
        if (el.tagName === 'VIDEO' || el.tagName === 'IMG' || el.tagName === 'SOURCE') {
          (el as HTMLImageElement).src = newSrc;
          if (el.tagName === 'VIDEO') (el as HTMLVideoElement).load();
        } else {
          (el as HTMLElement).dataset.studioBg = newSrc;
        }
      }
      // Also catch next/image srcSet
      const srcset = (el as HTMLImageElement).srcset;
      if (srcset && srcset.includes(oldSrc)) {
        (el as HTMLImageElement).srcset = srcset.split(',').map((entry) => {
          const parts = entry.trim().split(/\s+/);
          if (parts[0] && normalizeUrl(parts[0]) === normalizedOld) parts[0] = newSrc;
          return parts.join(' ');
        }).join(', ');
      }
    });
  }, [patches]);

  if (!canEdit || !editMode) return null;

  return (
    <>
      {discovered.map((d, i) => (
        <Pencil_Overlay
          key={`${d.path}-${i}`}
          entry={d}
          onClick={() => setOpenFor({ path: d.path, url: d.src, label: d.label, kind: d.kind })}
          dirty={patches.some((p) => p.path === d.path)}
        />
      ))}
      {openFor && (
        <MediaPicker
          currentUrl={openFor.url}
          currentMediaType={openFor.kind}
          allowVideo
          sizeType={guessSizeType(openFor.path)}
          title={openFor.label ? `Replace: ${openFor.label}` : 'Replace media'}
          onClose={() => setOpenFor(null)}
          onSelect={(url) => {
            apply(openFor.path, url);
            setOpenFor(null);
          }}
        />
      )}
    </>
  );
}

function guessSizeType(path: string): 'hero' | 'card' | 'thumbnail' | 'logo' | 'feature' {
  const p = path.toLowerCase();
  if (p.includes('hero')) return 'hero';
  if (p.includes('logo')) return 'logo';
  if (p.includes('thumb') || p.includes('avatar')) return 'thumbnail';
  if (p.includes('card')) return 'card';
  return 'feature';
}

/**
 * Position-tracking pencil portaled to document.body.
 * Lives at z-index 99996 so it sits above site content but below the toolbar.
 */
function Pencil_Overlay({
  entry,
  onClick,
  dirty,
}: {
  entry: Discovered;
  onClick: () => void;
  dirty: boolean;
}) {
  const [rect, setRect] = useState<{ top: number; left: number; right: number; bottom: number } | null>(null);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const update = () => {
      const r = entry.el.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) { setRect(null); return; }
      setRect({ top: r.top, left: r.left, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(entry.el);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [entry.el]);

  if (!rect) return null;

  return createPortal(
    <button
      type="button"
      aria-label={`Replace ${entry.label || entry.kind}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={entry.label || entry.path}
      style={{
        position: 'fixed',
        top: rect.top + 10,
        right: rect.right + 10,
        zIndex: 99996,
        width: 30,
        height: 30,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        background: hover ? '#000' : 'rgba(0,0,0,0.85)',
        color: '#fff',
        boxShadow: hover
          ? '0 6px 20px rgba(0,0,0,0.6), 0 0 0 3px rgba(37,99,235,0.5)'
          : '0 4px 14px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(6px)',
        border: 0,
        cursor: 'pointer',
        transition: 'box-shadow 150ms ease',
      }}
    >
      <Pencil width={14} height={14} strokeWidth={1.75} />
      {dirty && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: '#fbbf24',
            border: '2px solid #000',
          }}
        />
      )}
    </button>,
    document.body
  );
}
