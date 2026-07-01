# Roadmap

Working list of directions — not a fantasy plan. Keep it realistic and current.

## Now
- Keep the current site stable; no UI regressions.
- Document the legacy ↔ React boundary (this AI context layer).
- Validate VTM mechanics (disciplines, health, humanity) with the audit/validate
  scripts.
- Do **not** add chaos to `components/table/GameTable.tsx` or `public/main.js`.

## Next
- Gradually extract logic from `public/main.js` into `lib/vtm/*` / `lib/table/*`
  (small, verified steps; one explicit task each).
- Sync the full sheet and the quick/summary sheet representations.
- Improve the character creation wizard (`public/creation-wizard.js`).
- Add contested / opposed rolls to the normal roll UI.
- Implement the humanity / stains / remorse flow end-to-end.
- Improve Supabase persistence robustness (error handling, retries, conflicts).

## Later
- A full modular React version of the character sheet.
- Migrate the legacy JS off the iframe (dedicated project).
- Improve room / multiplayer logic (roles, presence, conflict handling).
- Stricter automated tests for rules and mechanics.

## Parking lot
- Ideas not scheduled: richer media pipeline, offline mode, export/print sheet,
  more languages, mobile layout pass. Pull into Now/Next only with an explicit
  task and a `DECISIONS.md` entry if it changes architecture.
