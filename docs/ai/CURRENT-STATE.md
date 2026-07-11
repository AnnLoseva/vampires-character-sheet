# Current State

> Keep this file **short and current**. It is the first thing every agent reads.
> Delete stale lines. Long-term decisions go to `DECISIONS.md`, not here.

## Current development focus
- **Legacy character sheet phase** — iframe sheet (`public/main.js` +
  `old-sheet.html`) stays load-bearing; bridge lives in `modules/character-sheet/`.
  Creation wizard (`public/creation-wizard.js`) — validation, nav, specialties, thin-blood/Caitiff rules synced.
- Hub + Modules architecture is **mostly complete** (`GameTable.tsx` ~2.6k lines).
- `/master?room=...` shell hosts **НПС и SPC** + permanent **master roller** right
  rail (`modules/master-rolls`). Hidden rolls use `master_hidden_rolls` (or local
  fallback) — never `table_rolls`/player realtime. Auth/SQL deploy still pending.
- Run `npm run test:vtm-parity` after health/humanity edits in `core/` or `public/vtm-*.js`.
  Remorse resolution (`applyRemorseCheckResult`) is shared: core ↔ legacy ↔ table.

## What is stable enough
- Routes `/`, `/character-sheet`, `/table`, `/journal`, `/reference`, `/master` — all thin
  `app/*/page.tsx` wrappers over `modules/*/*Route`.
- The iframe character sheet loads, saves and loads characters.
- The game table renders and syncs a room via Supabase.
- `core/systems/vtm5/rules/*` pure modules (health, humanity, damage, derived stats, disciplines).
- `modules/chat/*` owns text chat auth, message history, realtime delivery and UI.
- `modules/music/*` owns shared room music playback, adapters and the persistent
  root engine mount.
- `modules/table/*` owns table orchestrator, data layer, APIs, hooks, utils,
  panels/modals (`RollHistoryPanel`, `LayerContextMenuPanel`, `MediaPreviewModal`,
  etc.); deprecated component and `lib/table/*` shims have been removed.

## What is fragile
- `public/main.js` (~11k lines) — legacy sheet logic monolith.
- `public/old-sheet.html` (~5k lines) — legacy sheet markup/styles.
- `modules/table/GameTable.tsx` (~2.6k lines) — still wires many hooks inline.
- **Duplicated VTM logic**: `vtm-health.js` / `vtm-humanity.js` must stay aligned with
  `core/` — guarded by `npm run test:vtm-parity` (discipline parsing in `main.js` still manual).
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
- Humanity / stains / remorse flow.
- Improve Supabase persistence robustness.

## Do not touch casually
- `public/main.js`, `public/old-sheet.html` — read `workflows/legacy-edit-protocol.md`.
- `modules/table/GameTable.tsx` — read `workflows/react-table-edit-protocol.md`.
- Supabase table/bucket names & saved-data shape — read `workflows/supabase-edit-protocol.md`.
- `public/rules.json` / `rules_eng.json` — data layer, mind RU/EN drift.

## Last updated
2026-07-11 — Permanent master right-rail roller (`modules/master-rolls`): public
  rolls reuse `table_rolls`/`RollMessage`; hidden rolls master-only storage +
  reveal; undo via inverse ops + Ctrl+Z. Earlier: NPC module, actors domain,
  master shell/Auth foundation. 2026-07-08 — shims removed. 2026-07-07 — portraits/TURN/ECH.
