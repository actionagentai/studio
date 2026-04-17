'use client';

/**
 * Global CSS injected when Studio is in edit mode.
 *
 * - Persistent dashed blue outline on every [data-studio-editable] element
 * - Labels ("HERO IMAGE", "TITLE", etc.) pinned to each editable's top-left corner
 * - Top strip banner announcing edit mode
 * - Makes sure clicks on editables land (pointer-events auto, z-index bump)
 */

import { useSession } from '../providers/SessionProvider';
import { useEditorState } from '../providers/EditorStateProvider';

export function EditModeStyles() {
  const { canEdit } = useSession();
  const { editMode } = useEditorState();

  if (!canEdit) return null;

  return (
    <>
      <style>{CSS}</style>
      {editMode && (
        <div
          aria-hidden
          style={{
            position: 'fixed', top: 0, left: 0, right: 0,
            height: 28, zIndex: 99997, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(90deg, #2563eb 0%, #4f46e5 50%, #2563eb 100%)',
            color: '#fff', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
          }}
        >
          ✎ Studio — you are editing the live site
        </div>
      )}
    </>
  );
}

const CSS = `
/* Persistent edit affordances — applied only when <html data-studio-edit="on"> */

html[data-studio-edit="on"] [data-studio-editable] {
  outline: 2px dashed rgba(37, 99, 235, 0.7) !important;
  outline-offset: -4px !important;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25) !important;
  transition: outline-color 150ms ease, background 150ms ease !important;
}

html[data-studio-edit="on"] [data-studio-editable]:hover {
  outline-color: #2563eb !important;
  outline-style: solid !important;
  background: rgba(37, 99, 235, 0.18) !important;
}

/* Corner badge — uses data-studio-label for readability ("HERO IMAGE") */
html[data-studio-edit="on"] [data-studio-editable]::before {
  content: "✎ " attr(data-studio-label);
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 50;
  display: inline-block;
  padding: 4px 10px;
  background: #2563eb;
  color: #fff;
  font: 600 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  border-radius: 4px;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(37,99,235,0.35);
}

/* Center call-to-action label on hover */
html[data-studio-edit="on"] [data-studio-editable="image"]:hover::after {
  content: "Click to replace";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 51;
  padding: 8px 16px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  font: 600 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  pointer-events: none;
  backdrop-filter: blur(4px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
}

/* Push page content down so the top edit-mode strip doesn't cover the nav */
html[data-studio-edit="on"] body {
  padding-top: 28px;
}
`;
