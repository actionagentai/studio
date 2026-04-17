/**
 * Walk a content doc's `data` JSONB tree and return a map of
 * `normalized image URL → JSON path`.
 *
 * Any value that looks like an image/video URL is indexed. The first
 * occurrence wins when duplicates exist (maintains tree-walk order).
 *
 * Example input:
 *   {
 *     hero: { image: "https://cdn/a.webp", video: "https://cdn/b.mp4" },
 *     cards: { cards: [{ image: "https://cdn/c.webp" }] }
 *   }
 *
 * Output:
 *   Map {
 *     "https://cdn/a.webp" → { path: "hero.image", kind: "image" }
 *     "https://cdn/b.mp4"  → { path: "hero.video", kind: "video" }
 *     "https://cdn/c.webp" → { path: "cards.cards.0.image", kind: "image" }
 *   }
 */

import type { JsonValue } from '../types';

export interface UrlMapEntry {
  path: string;
  kind: 'image' | 'video';
  /** Free-form label derived from nearby keys (title, alt, etc.) for UI chrome */
  label?: string;
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg|heic|heif)(\?.*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;

/** Keys that commonly hold image/video URLs. Values at these keys get priority indexing. */
const MEDIA_KEYS = new Set([
  'image', 'imagePath', 'imageUrl', 'img', 'src', 'cdnUrl',
  'poster', 'posterImage', 'posterUrl',
  'backgroundImage', 'backgroundVideo', 'heroImage', 'heroVideo',
  'video', 'videoUrl', 'videoPath',
  'avatar', 'photo', 'headshot', 'thumbnail', 'thumb',
  'logo', 'logoLight', 'logoDark',
  'featuredImage',
]);

/** Nearby keys to harvest as a friendly label ("alt", "title"). */
const LABEL_KEYS = new Set(['title', 'name', 'alt', 'label', 'heading']);

function isMediaUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length < 5) return false;
  if (v.startsWith('data:') || v.startsWith('blob:')) return false;
  return /^(https?:\/\/|\/)/.test(v) && (IMAGE_EXT.test(v) || VIDEO_EXT.test(v) || /\/media\//.test(v) || /cdn/.test(v));
}

function kindOf(url: string): 'image' | 'video' {
  return VIDEO_EXT.test(url) ? 'video' : 'image';
}

function extractLabel(obj: any): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const k of LABEL_KEYS) {
    const v = (obj as any)[k];
    if (typeof v === 'string' && v) return v;
    if (v && typeof v === 'object') {
      if (typeof v.en === 'string' && v.en) return v.en;
    }
  }
  return undefined;
}

export function buildUrlPathMap(data: JsonValue | null | undefined): Map<string, UrlMapEntry> {
  const map = new Map<string, UrlMapEntry>();
  if (!data || typeof data !== 'object') return map;

  function walk(node: JsonValue, path: string, parentForLabel?: any) {
    if (node == null) return;

    if (typeof node === 'string') {
      if (isMediaUrl(node) && !map.has(node)) {
        const label = extractLabel(parentForLabel);
        map.set(node, { path, kind: kindOf(node), label });
      }
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((item, i) => {
        // If the array is an array of URL strings, index each with its slot path.
        walk(item as JsonValue, `${path}.${i}`, Array.isArray(node) ? node[i] : undefined);
      });
      return;
    }

    if (typeof node === 'object') {
      // First pass — media-ish keys (deterministic priority)
      for (const [k, v] of Object.entries(node)) {
        if (MEDIA_KEYS.has(k)) walk(v as JsonValue, path ? `${path}.${k}` : k, node);
      }
      // Second pass — walk everything else (captures nested cards/items etc.)
      for (const [k, v] of Object.entries(node)) {
        if (!MEDIA_KEYS.has(k)) walk(v as JsonValue, path ? `${path}.${k}` : k, node);
      }
    }
  }

  walk(data, '');
  return map;
}

/** Strip wrapping that next/image applies so the underlying URL can be looked up. */
export function normalizeUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  // next/image: /_next/image?url=ENCODED&w=...
  if (src.includes('/_next/image') && src.includes('url=')) {
    try {
      const qs = src.split('?')[1] || '';
      const params = new URLSearchParams(qs);
      const raw = params.get('url');
      if (raw) return decodeURIComponent(raw);
    } catch {
      // fall through
    }
  }
  // strip query string to be lenient on cache busters
  const q = src.indexOf('?');
  return q > 0 ? src.slice(0, q) : src;
}
