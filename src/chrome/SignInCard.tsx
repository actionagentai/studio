'use client';

/**
 * SignInCard — styled credentials sign-in for anonymous editors.
 *
 * Shown on localhost (dev) when the user is unauthenticated on the current port.
 * Submits email/password to /api/auth/callback/credentials (proxied to hn-backend).
 * On success, the tenant-port cookie lands and Studio activates on refresh.
 */

import { useEffect, useState } from 'react';
import { Loader2, LogIn, Eye, EyeOff, X } from 'lucide-react';

export function SignInCard({ onClose }: { onClose?: () => void }) {
  const [csrfToken, setCsrfToken] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/csrf', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setCsrfToken(d?.csrfToken || ''))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('csrfToken', csrfToken);
      fd.set('email', email);
      fd.set('password', password);
      fd.set('callbackUrl', window.location.href);
      fd.set('redirect', 'false');
      const res = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (res.ok || res.redirected) {
        // Success — reload so Studio picks up the new session
        window.location.reload();
        return;
      }
      const body = await res.text();
      // next-auth sets `?error=` on the URL for failures; try to parse redirect
      const maybeUrl = res.url;
      if (maybeUrl.includes('error=')) {
        const qs = new URL(maybeUrl).searchParams.get('error') || 'Sign-in failed';
        setError(decodeURIComponent(qs));
      } else {
        setError(body.slice(0, 200) || `Sign-in failed (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 400,
          maxWidth: '92vw',
          padding: 32,
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
          color: '#fff',
          position: 'relative',
        }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ position: 'absolute', top: 12, right: 12, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, color: 'rgba(255,255,255,0.5)', cursor: 'pointer', borderRadius: 999 }}
          >
            <X width={16} height={16} />
          </button>
        )}

        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            Studio
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 300, margin: '4px 0 0' }}>Sign in to edit</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '8px 0 0' }}>
            Use your HelloNative admin credentials.
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.4)', borderRadius: 8, color: '#ff6b63', fontSize: 13 }}>
            {error}
          </div>
        )}

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
            Email
          </span>
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            style={{
              width: '100%',
              padding: '12px 14px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#fff',
              fontSize: 15,
              outline: 'none',
            }}
          />
        </label>

        <label style={{ display: 'block', marginBottom: 24 }}>
          <span style={{ display: 'block', fontSize: 11, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
            Password
          </span>
          <div style={{ position: 'relative' }}>
            <input
              type={showPw ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{
                width: '100%',
                padding: '12px 44px 12px 14px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 15,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
            >
              {showPw ? <EyeOff width={14} height={14} /> : <Eye width={14} height={14} />}
            </button>
          </div>
        </label>

        <button
          type="submit"
          disabled={loading || !csrfToken}
          style={{
            width: '100%',
            padding: '12px 0',
            background: '#fff',
            color: '#000',
            border: 0,
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: loading ? 'default' : 'pointer',
            opacity: loading || !csrfToken ? 0.6 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? <Loader2 width={14} height={14} className="studio-spin" /> : <LogIn width={14} height={14} />}
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <style>{`@keyframes studio-spin { to { transform: rotate(360deg); } } .studio-spin { animation: studio-spin 1s linear infinite; }`}</style>
      </form>
    </div>
  );
}
