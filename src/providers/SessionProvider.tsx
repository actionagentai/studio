'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '../types';
import { useAdapter } from './AdapterProvider';

interface SessionCtx {
  session: Session | null;
  loading: boolean;
  canEdit: boolean;
}

const SessionContext = createContext<SessionCtx>({ session: null, loading: true, canEdit: false });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const adapter = useAdapter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adapter
      .getSession()
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  const canEdit = !!session && ['super_admin', 'owner', 'editor'].includes(session.role);

  return <SessionContext.Provider value={{ session, loading, canEdit }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
