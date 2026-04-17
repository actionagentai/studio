# @hellonative/studio

Inline visual + AI editor for HelloNative templates. Works across every `flow-*` standalone (Peak Builders, Mikado Lodge, Evoke Security, …) without per-site code.

## Why

- **One editor, many templates.** Drop `<Studio />` into any Next.js App Router app.
- **Hybrid editing.** Text edits via AI rewrite. Images via manual media picker. Image AI gen optional.
- **Pluggable adapters.** Real backend in production, mock adapter for v0 / preview.
- **v0 / Vercel partner compliant.** SSR-safe, keyboard accessible, zero CLS, no required network at boot.
- **Domain-safe.** Session cookie is first-party via `/api/*` rewrites; writes always carry explicit `orgId`.

## Install (local monorepo)

Studio lives at `v0/packages/studio`. Standalone sites wire it via TS path alias and Turbopack `resolveAlias`:

```ts
// next.config.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  transpilePackages: ['@hellonative/studio'],
  turbopack: {
    resolveAlias: {
      '@hellonative/studio': path.resolve(__dirname, '../packages/studio/src/index.ts'),
    },
  },
};
```

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@hellonative/studio": ["../packages/studio/src/index.ts"],
      "@hellonative/studio/*": ["../packages/studio/src/*"]
    }
  },
  "include": ["../packages/studio/src/**/*.ts", "../packages/studio/src/**/*.tsx"]
}
```

## Minimum usage

```tsx
// app/layout.tsx
import { Studio } from '@hellonative/studio';
import { hnAdapter } from '@hellonative/studio/adapters/hn';

export default function Layout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Studio adapter={hnAdapter} />
      </body>
    </html>
  );
}
```

Anonymous visitors see nothing. Logged-in editors see a bottom-right pencil FAB → expands into a glass toolbar at the top.

## Preview / v0 mode

```tsx
import { Studio } from '@hellonative/studio';
import { createMockAdapter } from '@hellonative/studio/adapters/mock';

const preview = createMockAdapter({
  docs: { home: { id: 'demo', organizationId: 'demo', slug: 'home', data: { hero: { title: 'Demo' } } } },
});

<Studio adapter={preview} />
```

Mock adapter runs fully offline. Save is disabled with a tooltip. AI rewrites return deterministic stub text. Good enough for v0 template review.

## Keyboard

| Shortcut | Action |
|---|---|
| ⌘E | Toggle edit mode |
| ⌘Z | Undo |
| ⌘⇧Z | Redo |
| Esc | Collapse toolbar |
| ⌘K | Open AI command bar (Stage 3) |

## Compatibility

- Next.js 15+
- React 19+
- Tailwind 4 (Studio ships its own utility classes — doesn't require your Tailwind config)
- Edge-safe session check (cookie via `/api/auth/session`)

## Staged build

- [x] Stage 0 — package scaffold + types + adapters
- [x] Stage 1 — auth gate + glass toolbar + FAB + keyboard nav
- [ ] Stage 2 — `<Editable>` text wrapper + floating handles
- [ ] Stage 3 — `<EditableImage>` + radial menu + media picker
- [ ] Stage 4 — AI command bar + diff preview
- [ ] Stage 5 — save flow end-to-end (hn-backend `PATCH /api/content/:id/patch`)
- [ ] Stage 6 — rollout to all 6 `flow-*` standalones
- [ ] Stage 7 — v0 compliance polish + npm publish

## License

MIT © HelloNative AI
