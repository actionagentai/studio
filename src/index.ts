/**
 * @hellonative/studio — Inline visual + AI editor for HelloNative templates.
 *
 * v0 / Vercel partner compliant:
 *  - SSR-safe (auth checks in useEffect, no window access at render)
 *  - Pluggable adapters (mock for preview, hn for production)
 *  - No private runtime dependencies — peerDeps only
 *  - Accessible (keyboard, ARIA, focus-visible, Esc to exit)
 *  - Zero visual footprint for anonymous visitors
 *
 * @example
 *   // app/layout.tsx
 *   import { Studio } from '@hellonative/studio';
 *   import { hnAdapter } from '@hellonative/studio/adapters/hn';
 *
 *   export default function Layout({ children }) {
 *     return (
 *       <html>
 *         <body>
 *           {children}
 *           <Studio adapter={hnAdapter} />
 *         </body>
 *       </html>
 *     );
 *   }
 */

export { Studio, StudioWithAdapter } from './Studio';

// Editable wrappers — annotate your template with these
export { EditableImage } from './wrappers/EditableImage';
export { EditableHeroMedia } from './wrappers/EditableHeroMedia';

// Adapters (re-exported so consumers can import from root)
export { createHnAdapter, hnAdapter } from './adapters/hn-adapter';
export { createMockAdapter } from './adapters/mock-adapter';

// Token helpers (for dashboard integrations minting tokens)
export { readStudioToken, storeStudioToken, clearStudioToken } from './token';

// Providers (for advanced composition)
export { AdapterProvider, useAdapter } from './providers/AdapterProvider';
export { SessionProvider, useSession } from './providers/SessionProvider';
export { EditorStateProvider, useEditorState } from './providers/EditorStateProvider';

// Types
export type {
  EditorAdapter,
  Session,
  ContentDoc,
  Patch,
  Path,
  MediaItem,
  AiEditInput,
  AiEditOutput,
  JsonValue,
  AdapterCapabilities,
} from './types';
