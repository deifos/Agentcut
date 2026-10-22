# Agentcut

Follow React and Next.js best practices (https://react.dev/learn/you-might-not-need-an-effect).

## Layout

- `app/(site)/`: the public pages (landing `/`, `/components`, `/templates`), with `components/site/`.
- `app/studio/`: the studio (`components/studio/StudioApp`), with logic in `lib/studio/`. Next.js + shadcn/ui + Tailwind 4.
- `components/ui/`: shadcn components. Theme tokens live in `app/globals.css` (`:root` and `.dark`); restyle there.
- `motion/components/`: the Remotion component library (one folder per component with `meta.json`).
- `motion/presets/`: video templates (workspace scene code, built by the helper, not by Next). Their
  `preview.mp4` and `poster.jpg` are copied to `public/templates/<id>/` for the templates page.
- `skills/agentcut/`: the skill the chat agent follows inside a workspace.
- `packages/agentcut/`: the local helper (`npx agentcut`): bridge on 127.0.0.1:32118, workspace, esbuild bundles,
  agent adapters (Claude Code, Codex), the `agentcut` MCP server. Its `template/skill`, `template/components` and
  `template/presets` are generated copies: run `npm run sync:skill` after changing the originals.

Keep `lib/studio/types.ts` in sync with `packages/agentcut/template/runtime/types.ts` and
`packages/agentcut/src/studio/schema.ts`, and `lib/studio/modules.ts` with `packages/agentcut/src/studio/bundler.ts`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
