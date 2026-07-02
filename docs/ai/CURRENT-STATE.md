# Current State

> Keep this file **short and current**. It is the first thing every agent reads.
> Delete stale lines. Long-term decisions go to `DECISIONS.md`, not here.

## Current development focus
- Establishing this AI context layer (`docs/ai/*`) so agents work safely.
- Documenting the legacy ↔ React boundary; no behavior changes.
- Validating VTM mechanics (disciplines, health, humanity) rather than adding new
  ones.

## What is stable enough
- Routes `/`, `/character-sheet`, `/table`, `/journal`, `/reference`.
- The iframe character sheet loads, saves and loads characters.
- The game table renders and syncs a room via Supabase.
- `core/systems/vtm5/rules/*` pure modules (health, humanity, damage, derived stats, disciplines).
- `modules/chat/*` owns text chat auth, message history, realtime delivery and UI.
- `modules/music/*` owns shared room music playback, adapters and the persistent
  root engine mount.

## What is fragile
- `public/main.js` (~11k lines) — legacy sheet logic monolith.
- `public/old-sheet.html` (~5k lines) — legacy sheet markup/styles.
- `components/table/GameTable.tsx` (~9k lines) — table orchestrator.
- **Duplicated VTM logic**: `core/systems/vtm5/rules/health/index.ts` vs `public/vtm-health.js`,
  `core/systems/vtm5/rules/humanity/index.ts` vs `public/vtm-humanity.js` can drift.
- The **iframe bridge** between `/character-sheet` and `/old-sheet.html`
  (query params, localStorage, `vtm-character-saved` postMessage).
- RU/EN trait & discipline names across `rules.json` / `rules_eng.json` / i18n.

## Active problems
_(none recorded — add temporary bugs here only while being worked, then remove;
 use `templates/bug-investigation-template.md` for the writeup)_

## Next likely tasks
- Finish subsystem documentation and keep it accurate.
- Gradually extract logic out of `public/main.js` (small steps, explicit tasks).
- Sync full sheet ↔ quick sheet representations.
- Character creation wizard improvements.
- Contested / opposed rolls in the normal roll UI.
- Humanity / stains / remorse flow.
- Improve Supabase persistence robustness.

## Do not touch casually
- `public/main.js`, `public/old-sheet.html` — read `workflows/legacy-edit-protocol.md`.
- `components/table/GameTable.tsx` — read `workflows/react-table-edit-protocol.md`.
- Supabase table/bucket names & saved-data shape — read `workflows/supabase-edit-protocol.md`.
- `public/rules.json` / `rules_eng.json` — data layer, mind RU/EN drift.

## Last updated
2026-07-02 — Chat runtime moved to `modules/chat/*`.
