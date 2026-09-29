# AGENTS.md

High-signal notes an agent is likely to miss. Full detail is in CLAUDE.md.

- **Dev port:** 5190. Port 5173 is taken by another local project, so don't "fix" it back.
- **Workers AI in dev:** it runs against real Cloudflare (`"remote": true`) and is billed. Tests never call it; they stub `AI` via `fakeAi()`.
- **Compatibility date:** pinned to `2026-08-22` in both wrangler configs, the newest the test pool's workerd supports.
- **D1 limits:** 100 bound parameters per statement, so chunk bulk inserts.
- **Colour laws** (marigold / coral / sky / stone mean right / wrong / missing / extra) are product semantics. Don't reuse those colours decoratively.
- **Typing inputs** must keep `autoCorrect="off" autoCapitalize="none" spellCheck={false}`, or iPad autocorrect spells the word for the child.
- **Rounds:**
  - The words must never appear on screen before a check. Captions pass through `maskWord`, and server definitions mask the word too.
  - The `start` and `finish` session endpoints must stay idempotent, because the offline queue replays them.
- **Verification order:** `pnpm check` → `pnpm typecheck` → `pnpm test` → `pnpm test:e2e`.
- **Commits:** conventional commits.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
