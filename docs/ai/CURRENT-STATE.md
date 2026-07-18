# Current State

> Keep this file **short and current**. It is the first thing every agent reads.
> Delete stale lines. Long-term decisions go to `DECISIONS.md`, not here.

## Current development focus
- **Game table lite (2026-07-18)** — scene stage/background on `table_scenes`,
  character tokens (`table_tokens`) above media, `table_character_controllers`
  (several characters per player), geometric player visibility (outside-stage
  hidden/clipped, own tokens always visible). Needs live-room testing with a
  logged-in master + player; server-side permission checks still impossible
  (custom users identity, permissive `table_*` RLS).
- **Master console (PROMPT 6–15)** — six modules live under `/master`: overview,
  actors, scenes, lore, blood-bonds, session-log. Search/commands (`⌘K`), deep
  links, detached second-monitor windows (`display=detached`), layout versioning.
  Route entry now requires a live Supabase Auth session plus master membership;
  the local password remains only a compatibility lock. Production provisioning
  for new chronicles/members remains operator-owned.
- **Legacy character sheet phase** — iframe sheet (`public/main.js` +
  `old-sheet.html`) stays load-bearing; bridge in `modules/character-sheet/`.
- Hub + Modules architecture is **mostly complete** (`GameTable.tsx` ~2.6k lines —
  do not grow for master features).
- Run `npm run test:vtm-parity` after health/humanity edits; `npm run test:master-console`
  for layout/deep-link/registry/privacy unit checks.

## What is stable enough
- Routes `/`, `/character-sheet`, `/table`, `/journal`, `/reference`,
  `/library/chronicles`, `/master` — all thin
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
2026-07-18 — Game table lite: scene stage/background, character tokens above
  media, character controllers, geometric player visibility (see DECISIONS).
  Earlier: `/library/chronicles` now separates official history from
  owner-only, resumable AI-processed player transcripts (full clean text + short
  personal recap), and the Librarian searches both under caller RLS.
  Earlier: `/master` gates module mount on live Supabase Auth +
  `chronicle_members` and the home screen validates cached identity against the
  current Auth user. Earlier: PROMPT 14–15 detached windows (`display=detached`), BroadcastChannel
  bus, layout schema v1 + conflict copy, home → `/master` for master role,
  `test:master-console`, search/command palette, session-log. Six modules active.
  Earlier same day: bonds, lore, scenes, overview, rolls, NPC.
