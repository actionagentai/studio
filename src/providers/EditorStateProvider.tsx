'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ContentDoc, JsonValue, Patch, Path } from '../types';

interface EditorState {
  doc: ContentDoc | null;
  setDoc: (d: ContentDoc | null) => void;

  editMode: boolean;
  toggleEditMode: () => void;

  /** Pending patches — the undo stack. */
  patches: Patch[];
  /** Number of patches popped to redo stack. 0 means nothing redoable. */
  redoable: Patch[];

  apply: (path: Path, value: JsonValue) => void;
  undo: () => void;
  redo: () => void;
  discardAll: () => void;

  /** Get the current effective value at a path (original + patches applied). */
  valueAt: (path: Path) => JsonValue | undefined;

  /** Selected element + hovered element (paths). */
  selected: Path | null;
  setSelected: (p: Path | null) => void;
  hovered: Path | null;
  setHovered: (p: Path | null) => void;

  saving: boolean;
  setSaving: (b: boolean) => void;
}

const EditorStateContext = createContext<EditorState | null>(null);

export function EditorStateProvider({ children }: { children: React.ReactNode }) {
  const [doc, setDoc] = useState<ContentDoc | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [patches, setPatches] = useState<Patch[]>([]);
  const [redoable, setRedoable] = useState<Patch[]>([]);
  const [selected, setSelected] = useState<Path | null>(null);
  const [hovered, setHovered] = useState<Path | null>(null);
  const [saving, setSaving] = useState(false);

  // Snapshot of the doc.data at mount so we can compute previousValue correctly.
  const originalRef = useRef<any>(null);
  if (doc && originalRef.current === null) originalRef.current = structuredClone(doc.data);

  const valueAt = useCallback(
    (path: Path): JsonValue | undefined => {
      if (!doc) return undefined;
      // Start from original, replay all applied (non-redoable) patches that match this path
      const base = getAtPath(originalRef.current ?? doc.data, path);
      // Find the last applied patch for this path
      for (let i = patches.length - 1; i >= 0; i--) {
        if (patches[i].path === path) return patches[i].value;
      }
      return base;
    },
    [doc, patches]
  );

  const apply = useCallback(
    (path: Path, value: JsonValue) => {
      const previousValue = getAtPath(originalRef.current, path) ?? undefined;
      setPatches((prev) => {
        // Collapse consecutive edits to the same path — keeps history readable.
        const last = prev[prev.length - 1];
        const next: Patch = { op: 'set', path, value, previousValue, ts: Date.now() };
        if (last && last.path === path && last.op === 'set') {
          return [...prev.slice(0, -1), { ...next, previousValue: last.previousValue }];
        }
        return [...prev, next];
      });
      setRedoable([]);
    },
    []
  );

  const undo = useCallback(() => {
    setPatches((prev) => {
      if (prev.length === 0) return prev;
      const popped = prev[prev.length - 1];
      setRedoable((r) => [...r, popped]);
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoable((prev) => {
      if (prev.length === 0) return prev;
      const popped = prev[prev.length - 1];
      setPatches((p) => [...p, popped]);
      return prev.slice(0, -1);
    });
  }, []);

  const discardAll = useCallback(() => {
    setPatches([]);
    setRedoable([]);
  }, []);

  const toggleEditMode = useCallback(() => setEditMode((v) => !v), []);

  const value = useMemo<EditorState>(
    () => ({
      doc, setDoc,
      editMode, toggleEditMode,
      patches, redoable,
      apply, undo, redo, discardAll,
      valueAt,
      selected, setSelected,
      hovered, setHovered,
      saving, setSaving,
    }),
    [doc, editMode, toggleEditMode, patches, redoable, apply, undo, redo, discardAll, valueAt, selected, hovered, saving]
  );

  return <EditorStateContext.Provider value={value}>{children}</EditorStateContext.Provider>;
}

export function useEditorState() {
  const ctx = useContext(EditorStateContext);
  if (!ctx) throw new Error('useEditorState must be inside <EditorStateProvider>');
  return ctx;
}

// ── utils ────────────────────────────────────────────────
function getAtPath(obj: any, path: string): any {
  if (!obj) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}
