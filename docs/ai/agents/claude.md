# Agent Notes: Claude

Start with `../../AGENTS.md`. See also the root `CLAUDE.md`.

## Strengths to lean on
- Reading and mapping large files (`main.js`, `old-sheet.html`, `GameTable.tsx`).
- Consolidating and keeping the `docs/ai/*` context accurate.
- Summarizing risk and data flow before a critical edit.

## Guardrails
- **Do not rewrite monoliths unless explicitly asked.** File size is not a
  mandate to refactor. Big refactors are separate, explicit tasks.
- Read the matching workflow before editing any `critical` file.
- Update `../DECISIONS.md` when architecture/contracts change; keep
  `../CURRENT-STATE.md` short.
- Before a critical edit, state which subsystems and contracts are affected so the
  user can confirm scope.
- Propose doc updates only when architecture, data contracts, routes, mechanics,
  or the current focus change (see `../UPDATE-RULES.md`).
