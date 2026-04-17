'use client';

import { createContext, useContext } from 'react';
import type { EditorAdapter } from '../types';

const AdapterContext = createContext<EditorAdapter | null>(null);

export function AdapterProvider({
  adapter,
  children,
}: {
  adapter: EditorAdapter;
  children: React.ReactNode;
}) {
  return <AdapterContext.Provider value={adapter}>{children}</AdapterContext.Provider>;
}

export function useAdapter(): EditorAdapter {
  const a = useContext(AdapterContext);
  if (!a) throw new Error('useAdapter must be called inside <AdapterProvider>');
  return a;
}
