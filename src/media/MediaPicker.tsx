'use client';

/**
 * MediaPicker — dark 640×640 modal, ported from legacy DarkMediaModal.
 * Uses INLINE STYLES (no Tailwind) so it renders identically in any host app
 * regardless of the consumer's Tailwind configuration.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Loader2, RefreshCw, Upload, Play, FolderOpen, Sparkles, Check, Wand2 } from 'lucide-react';
import { useSession } from '../providers/SessionProvider';
import { useEditorState } from '../providers/EditorStateProvider';

interface ContentContext {
  sectionTitle?: string;
  sectionDescription?: string;
  pageName?: string;
}

interface MediaPickerProps {
  currentUrl?: string;
  onSelect: (url: string, type?: 'image' | 'video') => void;
  onClose: () => void;
  title?: string;
  context?: string;
  allowVideo?: boolean;
  currentMediaType?: 'image' | 'video';
  sizeType?: 'hero' | 'card' | 'thumbnail' | 'logo' | 'feature';
  contentContext?: ContentContext;
}

const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  default: ['Modern', 'Luxury', 'Professional', 'Detail'],
  kitchen: ['Modern Kitchen', 'Traditional Kitchen', 'Open Concept', 'Island Focus'],
  bathroom: ['Spa Style', 'Modern Bath', 'Master Suite', 'Walk-in Shower'],
  basement: ['Entertainment', 'Living Space', 'Home Office', 'Guest Suite'],
  exterior: ['Curb Appeal', 'Deck/Patio', 'Landscaping', 'Entrance'],
  historic: ['Restored', 'Victorian', 'Craftsman', 'Character'],
};

function detectCategory(ctx: ContentContext): string {
  const t = [ctx.sectionTitle || '', ctx.sectionDescription || '', ctx.pageName || ''].join(' ').toLowerCase();
  if (t.includes('kitchen') || t.includes('cabinet') || t.includes('countertop')) return 'kitchen';
  if (t.includes('bathroom') || t.includes('bath') || t.includes('shower')) return 'bathroom';
  if (t.includes('basement') || t.includes('finish')) return 'basement';
  if (t.includes('exterior') || t.includes('roof') || t.includes('deck') || t.includes('patio')) return 'exterior';
  if (t.includes('historic') || t.includes('restoration')) return 'historic';
  return 'default';
}

// ─── Design tokens ───
const C = {
  bg: '#1c1c1e',
  bg2: '#2c2c2e',
  bg3: '#3a3a3c',
  border: '#3a3a3c',
  textPrimary: '#ffffff',
  textSecondary: '#8e8e93',
  textMuted: '#636366',
  accent: '#636366',
  red: '#ff453a',
  orange: '#ff9f0a',
  purple: '#5856d6',
  purpleLight: '#af52de',
  font: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
};

export function MediaPicker({
  currentUrl,
  onSelect,
  onClose,
  title = 'Edit Media',
  context,
  allowVideo = true,
  currentMediaType = 'image',
  sizeType = 'card',
  contentContext,
}: MediaPickerProps) {
  const { session } = useSession();
  const { doc } = useEditorState();
  // Use the org of the SITE being edited (from loaded doc), not the logged-in user's
  // home org. Super-admins editing Peak Builders should see Peak Builders' media.
  const orgId = doc?.organizationId && doc.organizationId !== 'stub'
    ? doc.organizationId
    : (session?.orgId || '');

  const [activeTab, setActiveTab] = useState<'library' | 'upload' | 'ai'>('library');
  const [mediaType, setMediaType] = useState<'image' | 'video'>(currentMediaType);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectedCategory = useMemo(() => (contentContext ? detectCategory(contentContext) : 'default'), [contentContext]);
  const categorySuggestions = useMemo(() => CATEGORY_SUGGESTIONS[detectedCategory] ?? CATEGORY_SUGGESTIONS.default ?? [], [detectedCategory]);
  const hasContentContext = !!(contentContext?.sectionTitle || contentContext?.pageName);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => {
    if (orgId) loadMediaItems('', currentMediaType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, currentMediaType]);

  useEffect(() => {
    if (activeTab === 'library' && orgId) loadMediaItems(searchQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaType]);

  async function loadMediaItems(search = '', typeOverride?: 'image' | 'video') {
    setLoadingMedia(true);
    setError(null);
    try {
      const effectiveType = typeOverride || mediaType;
      const params = new URLSearchParams({ limit: '200', type: effectiveType });
      if (search.trim()) params.set('search', search.trim());
      if (orgId) params.set('organizationId', orgId);
      const res = await fetch(`/api/media?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.error) { setError(data.error); setMediaItems([]); }
      else if (data.success) setMediaItems(data.media || []);
      else setMediaItems(data.media || data.files || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load media');
      setMediaItems([]);
    } finally { setLoadingMedia(false); }
  }

  function handleSelect(url: string, type: 'image' | 'video') {
    onSelect(url, type);
    onClose();
  }

  async function handleUpload(file: File) {
    const isVideo = file.type.startsWith('video/');
    if (!allowVideo && isVideo) { setError('Video not allowed'); return; }
    if (!orgId) { setError('Organization not configured'); return; }
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('organizationId', orgId);
      fd.append('category', 'marketing');
      const res = await fetch('/api/media/upload', { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json();
      if (data.success || data.url || data.cdnUrl) {
        const url = data.cdnUrl || data.url;
        if (url) handleSelect(url, isVideo ? 'video' : 'image');
      } else setError(data.error || 'Upload failed');
    } catch (e: any) { setError(e?.message || 'Upload failed'); }
    finally { setUploading(false); }
  }

  async function generateAgenticPrompt() {
    if (!contentContext || !orgId) return;
    setGeneratingPrompt(true); setError(null);
    try {
      const parts = [];
      if (contentContext.pageName) parts.push(`Page: ${contentContext.pageName}`);
      if (contentContext.sectionTitle) parts.push(`Section: ${contentContext.sectionTitle}`);
      if (contentContext.sectionDescription) parts.push(`Description: ${contentContext.sectionDescription}`);
      const sizeDesc: Record<string, string> = {
        hero: 'wide landscape hero banner (16:9)',
        card: 'square or slightly rectangular card image',
        thumbnail: 'small square thumbnail',
        logo: 'logo or icon',
        feature: 'feature image with subject focus',
      };
      const message = `Generate a detailed image prompt for AI image generation.\n\nContext: ${parts.join('. ') || 'General business/marketing'}\nImage type: ${sizeDesc[sizeType] || 'general purpose image'}\n\nCreate a professional stock-photo prompt (50-100 words). Return ONLY the prompt.`;
      const res = await fetch('/api/agentic/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ message, organizationId: orgId, maxTokens: 300, temperature: 0.8 }),
      });
      const data = await res.json();
      if (data.message) {
        let p = data.message.trim();
        if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1);
        setAiPrompt(p);
      } else setError(data.error || 'Failed to generate prompt');
    } catch (e: any) { setError(e?.message || 'Failed to generate prompt'); }
    finally { setGeneratingPrompt(false); }
  }

  async function handleGenerate() {
    if (!aiPrompt.trim() || !orgId) { setError(!orgId ? 'Organization not configured' : null); return; }
    setGenerating(true); setError(null);
    try {
      const res = await fetch('/api/agentic/images', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ prompt: aiPrompt, sizeType, saveToMedia: true, organizationId: orgId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || data.detail || `Server error: ${res.status}`); return; }
      const imageUrl = data.cdnUrl || data.cdn_url || data.url || data.image_url || data.imageUrl;
      if (imageUrl) setGeneratedUrl(imageUrl);
      else setError(data.error || 'No image URL in response');
    } catch (e: any) { setError(e?.message || 'Generation failed'); }
    finally { setGenerating(false); }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit media"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.8)',
        fontFamily: C.font,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.bg,
          borderRadius: 16,
          width: 640,
          height: 640,
          maxWidth: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ flex: 1 }}>
            {context && <p style={{ color: C.textSecondary, fontSize: 11, margin: 0 }}>{context}</p>}
            <h2 style={{ color: C.textPrimary, fontSize: 15, fontWeight: 600, margin: 0, marginTop: context ? 2 : 0 }}>{title}</h2>
          </div>
          <button onClick={onClose} style={iconBtn()} aria-label="Close"><X size={20} color={C.textSecondary} /></button>
        </div>

        {/* Segmented control */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px', borderBottom: `1px solid ${C.border}` }}>
          {allowVideo && (
            <div style={segmentedWrap()}>
              {(['image', 'video'] as const).map((t) => (
                <button key={t} onClick={() => setMediaType(t)} style={segmentedBtn(mediaType === t)}>{t}</button>
              ))}
            </div>
          )}
          <div style={segmentedWrap()}>
            {(['library', 'upload', 'ai'] as const).map((t) => (
              <button key={t} onClick={() => { setActiveTab(t); setError(null); }} style={segmentedBtn(activeTab === t)}>
                {t === 'ai' ? 'AI' : t}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ margin: '12px 20px 0', padding: '8px 12px', background: 'rgba(255,69,58,0.18)', color: C.red, fontSize: 13, borderRadius: 8 }}>
            {error}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {activeTab === 'library' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadMediaItems(searchQuery); }}
                  placeholder="Search media…"
                  style={inputStyle()}
                />
                <button onClick={() => loadMediaItems(searchQuery)} style={btnSecondary()}>Search</button>
              </div>

              {!loadingMedia && mediaItems.length > 0 && (
                <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 8 }}>
                  Showing {mediaItems.length} {mediaType}s
                </div>
              )}

              {loadingMedia ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={24} color={C.textSecondary} className="studio-spin" />
                </div>
              ) : mediaItems.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textSecondary }}>
                  <FolderOpen size={48} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>No {mediaType}s found</p>
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                    {mediaItems.map((item: any) => {
                      const url = item.cdnUrl || item.url;
                      const isCurrent = url === currentUrl;
                      return (
                        <button
                          key={item.id || url}
                          onClick={() => handleSelect(url, item.type || mediaType)}
                          title={item.filename || item.originalName}
                          style={{
                            position: 'relative',
                            aspectRatio: '1/1',
                            borderRadius: 8,
                            overflow: 'hidden',
                            background: C.bg2,
                            padding: 0,
                            border: 0,
                            cursor: 'pointer',
                            outline: isCurrent ? `2px solid #3b82f6` : 'none',
                            outlineOffset: -2,
                            transition: 'box-shadow 150ms',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 0 2px ${C.textPrimary}`)}
                          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                        >
                          {item.type === 'video' || mediaType === 'video' ? (
                            <>
                              <video src={item.thumbnailUrl || url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <Play size={24} color="rgba(255,255,255,0.8)" style={{ position: 'absolute', inset: 0, margin: 'auto' }} />
                            </>
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.thumbnailUrl || url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                          {item.filename?.includes('ai-generated') && (
                            <span style={{ position: 'absolute', top: 4, left: 4, padding: '2px 6px', background: 'rgba(168,85,247,0.8)', borderRadius: 4, fontSize: 9, color: '#fff', fontWeight: 500 }}>AI</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                height: '100%', minHeight: 280,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: `2px dashed ${isDragging ? '#fff' : C.border}`,
                background: isDragging ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderRadius: 12, cursor: 'pointer',
                transition: 'border-color 150ms, background 150ms',
              }}
            >
              <input ref={fileInputRef} type="file" accept={allowVideo ? 'image/*,video/*' : 'image/*'} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} style={{ display: 'none' }} />
              {uploading ? (
                <Loader2 size={32} color={C.textSecondary} className="studio-spin" />
              ) : (
                <>
                  <Upload size={40} color={C.textSecondary} style={{ marginBottom: 12 }} />
                  <p style={{ color: C.textPrimary, fontSize: 15, fontWeight: 500, margin: 0 }}>Drop file or click to upload</p>
                  <p style={{ color: C.textSecondary, fontSize: 13, marginTop: 4 }}>{allowVideo ? 'Images & Videos' : 'Images only'}</p>
                </>
              )}
            </div>
          )}

          {activeTab === 'ai' && (
            mediaType === 'video' ? (
              <div style={{ height: '100%', minHeight: 280, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <Sparkles size={40} color={C.textSecondary} style={{ marginBottom: 12 }} />
                <p style={{ color: C.textPrimary, fontSize: 15, fontWeight: 500, margin: 0 }}>AI Video</p>
                <p style={{ color: C.textSecondary, fontSize: 13, marginTop: 4 }}>Coming soon with Veo 3</p>
              </div>
            ) : generatedUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ position: 'relative', flex: 1, borderRadius: 12, overflow: 'hidden', background: C.bg2, marginBottom: 16 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={generatedUrl} alt="Generated" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  <span style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: '#22c55e' }}>
                    <Check size={14} color="#fff" />
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button onClick={() => setGeneratedUrl(null)} style={{ ...btnSecondaryWide(), display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <RefreshCw size={14} /> Regenerate
                  </button>
                  <button onClick={() => handleSelect(generatedUrl, 'image')} style={btnPrimaryWide()}>Use Image</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {!orgId && (
                  <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,159,10,0.18)', border: '1px solid rgba(255,159,10,0.4)', borderRadius: 12 }}>
                    <p style={{ color: C.orange, fontSize: 13, fontWeight: 500, margin: 0 }}>Setup Required</p>
                    <p style={{ color: '#ebebf5', fontSize: 12, marginTop: 4 }}>Organization not detected. Make sure you&apos;re signed in.</p>
                  </div>
                )}

                {hasContentContext && orgId && (
                  <button
                    onClick={generateAgenticPrompt}
                    disabled={generatingPrompt}
                    style={{
                      width: '100%', marginBottom: 16, padding: 12, textAlign: 'left',
                      background: 'linear-gradient(90deg, rgba(88,86,214,0.2), rgba(175,82,222,0.2))',
                      border: '1px solid rgba(88,86,214,0.4)', borderRadius: 12,
                      color: '#fff', cursor: 'pointer', opacity: generatingPrompt ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {generatingPrompt ? <Loader2 size={14} color={C.purple} className="studio-spin" /> : <Wand2 size={14} color={C.purple} />}
                      <span style={{ color: C.purple, fontSize: 13, fontWeight: 500 }}>{generatingPrompt ? 'Generating…' : 'Generate AI Prompt'}</span>
                    </div>
                    <p style={{ color: '#ebebf5', fontSize: 13, margin: 0 }}>
                      Create a professional prompt for &ldquo;{contentContext?.sectionTitle || contentContext?.pageName}&rdquo;
                    </p>
                  </button>
                )}

                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: C.textSecondary, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    {detectedCategory !== 'default' ? `${detectedCategory} styles` : 'Quick styles'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {categorySuggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          const base = contentContext?.sectionTitle || contentContext?.pageName || '';
                          setAiPrompt(`${base} - ${s} style, professional photography, modern design`);
                        }}
                        style={{ padding: '6px 12px', background: C.bg2, color: C.textSecondary, borderRadius: 999, fontSize: 13, border: 0, cursor: 'pointer' }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={hasContentContext ? `Click "Generate AI Prompt" above or describe the image…` : 'Describe the image you want to generate…'}
                  style={{
                    flex: 1, minHeight: 100, padding: 16,
                    background: C.bg2, color: '#fff', fontSize: 15,
                    border: `1px solid ${C.border}`, borderRadius: 12, resize: 'none',
                    outline: 'none', fontFamily: C.font,
                  }}
                />

                <button onClick={handleGenerate} disabled={generating || !aiPrompt.trim()} style={{ ...btnPrimaryWide(), marginTop: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {generating ? <><Loader2 size={16} className="studio-spin" /> Generating…</> : <><Sparkles size={16} /> Generate Image</>}
                </button>
              </div>
            )
          )}
        </div>

        <style>{`@keyframes studio-spin { to { transform: rotate(360deg); } } .studio-spin { animation: studio-spin 1s linear infinite; }`}</style>
      </div>
    </div>
  );
}

// ─── inline style helpers ───
function iconBtn(): React.CSSProperties {
  return { padding: 4, borderRadius: 999, background: 'transparent', border: 0, cursor: 'pointer' };
}
function segmentedWrap(): React.CSSProperties {
  return { display: 'flex', background: C.bg2, borderRadius: 8, padding: 2 };
}
function segmentedBtn(active: boolean): React.CSSProperties {
  return {
    padding: '6px 16px', fontSize: 13, borderRadius: 6, border: 0, cursor: 'pointer',
    background: active ? C.accent : 'transparent',
    color: active ? '#fff' : C.textSecondary,
    textTransform: 'capitalize' as const,
    fontFamily: C.font,
  };
}
function inputStyle(): React.CSSProperties {
  return {
    flex: 1, padding: '8px 16px', background: C.bg2, border: `1px solid ${C.border}`,
    borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', fontFamily: C.font,
  };
}
function btnSecondary(): React.CSSProperties {
  return { padding: '8px 16px', background: C.bg2, color: '#fff', borderRadius: 8, border: 0, fontSize: 14, cursor: 'pointer', fontFamily: C.font };
}
function btnSecondaryWide(): React.CSSProperties {
  return { flex: 1, padding: '12px 0', background: C.bg2, color: '#fff', borderRadius: 12, border: 0, fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: C.font };
}
function btnPrimaryWide(): React.CSSProperties {
  return { flex: 1, padding: '12px 0', background: '#fff', color: '#000', borderRadius: 12, border: 0, fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: C.font };
}
