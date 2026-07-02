# Decisions

Long-term architectural decisions. One entry per real decision (not per bug).
Use `templates/decision-entry-template.md`. Newest at the top. When a decision is
replaced, set the old one to `superseded` and link the new one.

---

## 2026-07-02 — VTM legacy parity test (`test:vtm-parity`)

**Area:** VTM mechanics / legacy character sheet
**Decision:** `scripts/test-vtm-legacy-parity.ts` (`npm run test:vtm-parity`) is the
guard for `public/vtm-health.js` and `public/vtm-humanity.js` staying aligned with
`core/systems/vtm5/rules/{health,humanity}/index.ts`. Run it after edits on either side.
**Reason:** Duplicated mechanics were the top drift risk between the legacy iframe sheet
and the React table; disciplines already had scripts but health/humanity did not.
**Consequences:** Health/humanity changes require parity pass. Discipline parsing in
`main.js` remains manually checked.
**Affected files:** `scripts/test-vtm-legacy-parity.ts`, `public/vtm-health.js`,
`public/vtm-humanity.js`, `core/systems/vtm5/rules/health/index.ts`,
`core/systems/vtm5/rules/humanity/index.ts`, `package.json`
**Status:** active

---

## 2026-07-02 — Table module decomposition (`modules/table`)

**Area:** Game table / module migration
**Decision:** `modules/table/` is the canonical home for table types, constants,
mappers, utils, Supabase APIs, hooks, and extracted UI modals. `GameTable.tsx`
consumes the module via hooks and components; it still owns orchestration for
rolls, health/willpower, voice WebRTC, and canvas/layer drag.
**Reason:** Gradual decomposition of the ~9k-line monolith following
`modules/chat` and `modules/music` patterns.
**Consequences:** New code imports from `@/modules/table`. `lib/table/*` shims
remain for backward compat. Do not grow `GameTable.tsx` — extend the module.
**Affected files:** `modules/table/*`, `components/table/GameTable.tsx`,
`lib/table/*`, `docs/ai/*`
**Status:** active

---

## 2026-07-02 — Table data layer moved into `modules/table` (superseded)

**Area:** Game table / module migration
**Decision:** Canonical table types, constants and Supabase row mappers now live
in `modules/table/{types,constants,mappers}.ts`. `lib/table/{types,constants,mappers}.ts`
are compatibility shims that re-export from the module. API scaffolds
(`modules/table/api/*`), hooks and component extraction plans are documented but
not yet implemented — `GameTable.tsx` still owns Supabase I/O.
**Reason:** Prepare gradual decomposition of the ~9k-line `GameTable.tsx`
monolith following the same pattern as `modules/chat` and `modules/music`.
**Consequences:** New code should import from `@/modules/table`. `@/lib/table/*`
still works via shims. Utils (`scene-utils`, `layer-utils`, `media-utils`) remain
in `lib/table/` until the next phase.
**Affected files:** `modules/table/*`, `lib/table/{types,constants,mappers}.ts`,
`docs/ai/*`
**Status:** superseded → see “Table module decomposition” above

---

## 2026-07-02 — Text chat runtime moved into `modules/chat`

**Area:** Chat / module migration
**Decision:** Text chat auth, message types, Supabase API helpers, message
history/realtime state and `ChatPanel` UI now live in `modules/chat/*`.
`GameTable.tsx` consumes `useChat` and composes table-specific voice/master
flows around it.
**Reason:** Chat is a self-contained pluggable feature keyed by chronicle/room.
Moving it out of the table monolith reduces `GameTable.tsx` ownership without
changing the `table_chat_messages` Supabase contract.
**Consequences:** Keep `table_chat_messages` column names unchanged unless there
is a documented Supabase migration. Voice chat and master-private messages are
still table-specific and can move later as separate slices.
**Affected files:** `modules/chat/*`, `components/table/GameTable.tsx`,
`lib/table/types.ts`, `lib/table/mappers.ts`, `lib/table/layer-utils.ts`
**Status:** active

---

## 2026-07-02 — Music runtime moved into `modules/music`

**Area:** Music/media / module migration
**Decision:** The shared room music runtime now lives in `modules/music/*`.
`app/layout.tsx` mounts `GlobalMusicEngineMount` from the module, and
`GameTable.tsx` renders `MusicPlayer` from the module for controls and library
management.
**Reason:** Music is a self-contained pluggable feature with playback adapters,
sync, library helpers and a persistent global engine. Moving it out of
`components/music/*` makes the module boundary explicit without changing
Supabase contracts or playback behavior.
**Consequences:** Keep playback/source-specific behavior in `modules/music`
adapters and keep the root engine mount stable so music survives App Router
navigation. Do not rename `table_music`, `table_music_library`, or the
`table-music` bucket without a Supabase migration decision.
**Affected files:** `modules/music/*`, `app/layout.tsx`,
`components/table/GameTable.tsx`, `lib/table/mappers.ts`
**Status:** active

---

## 2026-07-02 — VTM5 runtime rules moved into `core/systems/vtm5/rules`

**Area:** VTM mechanics / core migration
**Decision:** The TypeScript VTM mechanics runtime has moved from `lib/vtm/*` to
`core/systems/vtm5/rules/*`. Project imports should use the new core path.
**Reason:** This makes the VTM5 rules layer the first concrete Game System Core
under the Hub + Game System Cores + Pluggable Modules architecture.
**Consequences:** Keep `core/systems/vtm5/rules/*` pure and framework-independent.
Legacy duplicates (`public/vtm-health.js`, `public/vtm-humanity.js`) still need
alignment checks when behavior changes. `lib/vtm/*` is no longer the runtime
location.
**Affected files:** `core/systems/vtm5/rules/*`, `components/table/GameTable.tsx`,
`lib/table/types.ts`, `lib/table/mappers.ts`, `scripts/test-discipline-engine.ts`
**Status:** active

---

## 2026-07-02 — Target architecture is Hub + Game System Cores + Pluggable Modules

**Area:** Architecture / migration
**Decision:** The project migrates toward a Hub + Game System Cores + Pluggable
Modules architecture. Next.js routes and global providers form the Hub;
framework-independent VTM rules remain the first game-system core; table,
character sheet, music, media, journal and reference become modules with explicit
contracts.
**Reason:** The app already has a load-bearing legacy sheet and a large React
table orchestrator. A modular target keeps refactoring incremental while making
future game-system and feature boundaries explicit.
**Consequences:** Refactors should first extract pure core logic and stable
module contracts, then API/hooks, then UI folders. `GameTable.tsx` and legacy
files must shrink through small verified steps, not rewrites. See
`docs/architecture.md`.
**Affected files:** `docs/architecture.md`, future `core/systems/vtm5/rules/*` /
`core/systems/vtm5/*`, `components/table/*`, `lib/table/*`, future `modules/*`
**Status:** active

---

## 2026-07-01 — Legacy character sheet stays behind the iframe

**Area:** Character sheet / bridge
**Decision:** The full character sheet remains the legacy `public/old-sheet.html`
+ `public/main.js` app, embedded via `<iframe>` from
`components/screens/CharacterSheetScreen.tsx`, until there is a dedicated
migration task.
**Reason:** The legacy sheet is large (~11k + ~5k lines) and load-bearing.
Rewriting it inline with other work would be high-risk and out of scope.
**Consequences:** New sheet work happens in legacy JS following
`workflows/legacy-edit-protocol.md`; the bridge contract (params, localStorage,
`vtm-character-saved` postMessage) must be preserved.
**Affected files:** `components/screens/CharacterSheetScreen.tsx`,
`public/old-sheet.html`, `public/main.js`
**Status:** active

---

## 2026-07-01 — `GameTable.tsx` is an orchestrator, extract new logic outward

**Area:** Game table
**Decision:** `components/table/GameTable.tsx` is treated as an orchestrator. New
sizeable features go into child components (`components/table/*`), hooks, or
`lib/table/*` / `core/systems/vtm5/rules/*` — not inline into `GameTable.tsx`.
**Reason:** The file is already ~9k lines and concentrates room state, Supabase
I/O, rolls, chat, scenes, layers, media, and modals. Growth increases regression
risk.
**Consequences:** Reviewers should reject changes that grow the monolith when
extraction is feasible. See `workflows/react-table-edit-protocol.md`.
**Affected files:** `components/table/GameTable.tsx`, `components/table/*`,
`lib/table/*`
**Status:** active

---

## 2026-07-01 — VTM mechanics live in `core/systems/vtm5/rules/*` as pure modules

**Area:** VTM mechanics
**Decision:** VTM rules logic (health, humanity, damage, derived stats,
disciplines) is progressively moved into `core/systems/vtm5/rules/*` as pure,
framework-independent, testable modules.
**Reason:** Reuse across React and (eventually) the sheet; testability via the
discipline scripts; a single source of truth over time.
**Consequences:** Where a legacy duplicate exists (`public/vtm-health.js`,
`public/vtm-humanity.js`, discipline parsing in `main.js`), changes must note and
where needed sync the duplicate. See `workflows/vtm-mechanics-edit-protocol.md`.
**Affected files:** `core/systems/vtm5/rules/*`, `public/vtm-health.js`, `public/vtm-humanity.js`
**Status:** active

---

## 2026-07-01 — `rules.json` / `rules_eng.json` are a data layer

**Area:** Rules data
**Decision:** `public/rules.json` (RU) and `public/rules_eng.json` (EN) are the
data layer for clans, skills, disciplines, merits, flaws and predator types. No
UI or behavior logic belongs in them.
**Reason:** Separation of data from logic; both the legacy sheet and
`core/systems/vtm5/rules/disciplines/rules-loader/index.ts` consume them.
**Consequences:** RU and EN must stay structurally in sync; identity is by stable
IDs, not display names (see `subsystems/i18n.md`). Discipline edits run
`audit:disciplines`.
**Affected files:** `public/rules.json`, `public/rules_eng.json`,
`core/systems/vtm5/rules/disciplines/rules-loader/index.ts`, `lib/i18n/ruleNames.ts`
**Status:** active

---

## 2026-07-01 — Supabase contract changes must be documented

**Area:** Supabase persistence
**Decision:** Any change to Supabase table names, storage buckets, or the shape
of saved data must be recorded here (with a migration note) before/with the code
change.
**Reason:** The schema is shared by the React table and the legacy sheet;
undocumented drift breaks save/load and room sync across both layers.
**Consequences:** Follow `workflows/supabase-edit-protocol.md`; update
`lib/table/constants.ts`, mappers, and `supabase/*.sql` together.
**Affected files:** `lib/table/constants.ts`, `lib/table/mappers.ts`,
`lib/supabase.ts`, `public/supabase.js`, `supabase/*.sql`
**Status:** active
