# Decisions

Long-term architectural decisions. One entry per real decision (not per bug).
Use `templates/decision-entry-template.md`. Newest at the top. When a decision is
replaced, set the old one to `superseded` and link the new one.

---

## 2026-07-11 — Master scenes shell reuses table scene engine

**Area:** Master console / scenes / layers
**Decision:** `modules/master-scenes` is a master UI shell over
`table_scenes` / `table_images` / `table_scene_music` APIs. Preview selects a
scene without activating it; **Publish** sets `is_active`, deactivates others,
broadcasts one `scene-active` event (`fade: true`) on the existing `table-room`
channel, and logs `scenes.publish`. Light presets are pure data applied to
master preview only until publish. Interactives live in master-only
`master_scene_objects` with a public projection table that omits
`private_config`. Player canvas filters out `owner_role=master` layers.
Music uses `table_music` / global engine only.
**Reason:** One scene engine for table and master; no GameTable fork.
**Consequences:** Deploy `supabase/master_scenes.sql` for meta/interactives.
Reorder of scene list is meta-local until sort_order is provisioned.
**Affected files:** `modules/master-scenes/*`, `supabase/master_scenes.sql`,
`modules/table/GameTable.tsx` (GM layer filter), `useTableRealtime.ts` (fade)
**Status:** active

---

## 2026-07-11 — Night overview aggregates; does not copy domain data

**Area:** Master console / overview
**Decision:** `modules/master-overview` is a read-model + light master-only
writes module. Coterie/NPC cards are selectors over `modules/actors` + active
`table_scenes`; timeline merges `master_action_log` and public `table_rolls`;
macros call actors hunger APIs and `master-rolls` services. Session notes and
plot hooks use `master_session_notes` / `master_plot_hooks` (master RLS) with
localStorage fallback when Auth/SQL are undeployed. No demo seed data.
**Reason:** Command center must stay current with source entities and must not
fork character/scene/roll storage.
**Consequences:** Cards deep-link to actors module or full sheet; lore deep-link
is a stub until the lore module exists. Deploy `supabase/master_overview.sql`.
**Affected files:** `modules/master-overview/*`, `supabase/master_overview.sql`,
`modules/master-console/contributions.ts`
**Status:** active

---

## 2026-07-11 — Master roller reuses RollMessage; hidden rolls are not table_rolls

**Area:** Master console / rolls / privacy
**Decision:** The permanent `/master` right rail mounts `modules/master-rolls`
and does not unmount on central module change. Public rolls use the same
`RollMessage` + `insertRollRecord` / `table_rolls` path as `/table`. Hidden rolls
never broadcast and never insert into `table_rolls` until explicit reveal; they
persist in `master_hidden_rolls` (master RLS only) or a master-local fallback if
Auth/schema is undeployed. Actor pools/hunger come from `modules/actors`
(`actorToRollCharacter` + `normalizeActor`). Undo uses typed inverse operations
on a session stack (Ctrl/Cmd+Z skips focused editors), not state snapshots.
**Reason:** One roll format for table compatibility; physical separation so
players cannot SELECT or realtime-subscribe to hidden results.
**Consequences:** Deploy `supabase/master_hidden_rolls.sql` with master
membership. Contested rolls against chronicle actors resolve both sides on the
master client; live player opposed proposals remain table-owned.
**Affected files:** `modules/master-rolls/*`, `supabase/master_hidden_rolls.sql`,
`modules/master-console/components/MasterRightRail.tsx`, `core/hub/{types,presets}.ts`
**Status:** active (SQL/Auth pending for durable hidden storage)

---

## 2026-07-11 — Master NPC module is a contribution over the actors domain

**Area:** Master console / actors UI
**Decision:** The «НПС и SPC» screen is `modules/actors` UI registered as a
static `MasterConsoleContribution` in `modules/master-console/contributions.ts`.
`MasterConsoleContribution` / `MasterModuleProps` live in
`modules/master-console/types.ts` (not `core/hub`). The module reuses actor
API/hooks/services, table character-sheet URLs, scene id for “in scene”, and
master action log append; it never imports `GameTable.tsx`. Quick roll/Rouse
emit a typed `MasterRollRequest` into the right rail until `master-rolls` owns
the full roller. Create templates are data in `utils/actor-templates.ts`.
Linked-sheet hunger edits use `manual_overrides.stats` so master clients do not
rewrite player-owned `characters.data`.
**Reason:** Keep one actor domain, one console shell, and a reviewable UI PR
without a second table orchestrator or JSX-per-template branches.
**Consequences:** Other master features register the same contribution contract.
Full roller, multi-window layouts, and Auth-backed create/load still depend on
later phases and SQL deploy.
**Affected files:** `modules/actors/{components,utils,contribution,services}/*`,
`modules/master-console/{types,contributions,components,MasterConsoleShell}.*`
**Status:** active (SQL/Auth still pending for live persistence)

---

## 2026-07-11 — Actors reference character sheets instead of copying them

**Area:** Actors / character persistence / VTM adapters
**Decision:** `chronicle_actors` is the unified identity for PC, full NPC and
compact SPC records. A linked actor stores only `character_id`; every hydration
loads the canonical `characters` row. Compact actors store a small stat block.
GM-only fields live in `chronicle_actor_private`, and normalized/public actor
payloads cannot contain that object. VTM vitals and simple pools are computed in
`core/systems/vtm5/adapters/actors.ts`.
**Reason:** Copying `characters.data` would create drift and could leak secrets.
A separate compact representation is still needed for SPCs without full sheets.
**Consequences:** A partial unique index prevents duplicate character links per
chronicle. Unlink never deletes a character. Compact-to-full conversion creates
a sheet through the canonical ownership flow and links its returned ID. Bulk
updates use one room-scoped, whitelisted RPC.
**Affected files:** `supabase/chronicle_actors.sql`, `modules/actors/*`,
`modules/table/api/character-api.ts`, `core/systems/vtm5/adapters/actors.ts`
**Status:** pending SQL deploy and Auth provisioning

---

## 2026-07-11 — Master persistence requires Auth membership and has no room self-claim

**Area:** Master console / Supabase / security
**Decision:** Master persistence is scoped by `chronicles.id` and protected by
`chronicle_members(user_id, chronicle_id, role)` using `auth.uid()`. All master
tables revoke anon privileges. A first master cannot claim a room from the
browser; the initial chronicle and membership are provisioned by service role or
an administrator. `room` remains an indexed compatibility slug and is checked
against `chronicle_id` by triggers.
**Reason:** The existing localStorage identity and master password cannot enforce
RLS. Client self-claim would let the first authenticated user take over an
existing legacy room.
**Consequences:** The current `/master` shell remains persistence-disabled until
the login flow supplies a Supabase Auth session and an administrator provisions
membership. Master Realtime uses separate room-filtered postgres subscriptions;
players cannot select the rows under RLS. `master_action_log` exposes only
SELECT/INSERT and is append-only to clients.
**Affected files:** `supabase/master_console_persistence.sql`,
`modules/master-console/{persistence,api,hooks}/*`
**Status:** pending SQL deploy and Auth provisioning

---

## 2026-07-11 — Master console is a separate Hub module, not a second GameTable

**Area:** Master console / routing / Hub
**Decision:** `/master?room=...` mounts `modules/master-console` as a VTM5 Hub
module. It bootstraps the same chronicle runtime and canonical room resolver as
the table, composes its own desktop shell, and does not import `GameTable`.
The current local master-password contract is shared through
`modules/table/utils/room-session.ts` and is always required regardless of URL role.
**Reason:** Establish a reviewable shell and module boundary without duplicating
table orchestration, persistence, scenes, rolls or music.
**Consequences:** Business contributions and Supabase data are deferred. The
compatibility gate blocks URL-only access but does not provide real privacy;
Auth/RLS remains a prerequisite for master secrets.
**Affected files:** `app/master/page.tsx`, `modules/master-console/*`,
`core/hub/{types,presets}.ts`, `modules/table/hooks/useRoomSession.ts`,
`modules/table/utils/room-session.ts`
**Status:** active

---

## 2026-07-11 — Shared VTM UI tokens have one canonical owner

**Area:** UI architecture / game table / master console
**Decision:** Shared VTM colors, typography, spacing, radii, control heights,
shadows, glow, grid, focus, scrollbar and reduced-motion rules live in
`modules/ui/vtm-theme/*`. Feature roots opt into scoped behavior with
`VTM_THEME_CLASS`; feature-specific selectors remain in their feature module.
**Reason:** The future master console must reuse the table design system without
copying the large `GameTableStyles.tsx` block or introducing a second token set.
**Consequences:** Add or change shared VTM variables only in `tokens.css`. Do not
move table layout/component selectors into the shared theme.
**Affected files:** `modules/ui/vtm-theme/*`, `app/globals.css`,
`modules/table/GameTable.tsx`, `modules/table/components/GameTableStyles.tsx`
**Status:** active

---

## 2026-07-08 — Deprecated module compatibility shims removed

**Area:** Architecture / module migration
**Decision:** Deprecated re-export shims under `components/*` and `lib/table/*`
were removed after their runtime code moved into `modules/*`. Imports should use
canonical module paths directly, such as `@/modules/table`,
`@/modules/home`, `@/modules/journal`, `@/modules/reference`, and
`@/modules/character-sheet`.
**Reason:** The app routes now follow the thin `app/*/page.tsx` →
`modules/*Route` pattern, and repo-wide imports no longer need the old
compatibility layer.
**Consequences:** Do not add new imports from deleted `components/*` shims or
`@/lib/table/*`. Use `modules/table/constants.ts`, `modules/table/mappers.ts`,
and `modules/table/utils/*` directly.
**Affected files:** `components/*`, `lib/table/*`, `modules/*`,
`docs/ai/FILE-MAP.md`, `docs/ai/CURRENT-STATE.md`
**Status:** active

---

## 2026-07-07 — Character autosave patches `data` through RPC

**Area:** Supabase persistence / legacy character sheet
**Decision:** Legacy `autoSaveCharacterPatch` now attempts
`rpc('vtm_patch_character_data', { p_id, p_user_id, p_patch })` before falling
back to the old read-merge-write path. The RPC is defined in
`supabase/patch_character_data.sql` and uses `vtm_jsonb_deep_merge`: nested
objects merge recursively, while arrays, scalars, and JSON `null` replace the
previous value. The RPC filters by both `characters.id` and `characters.user_id`
and returns the updated `data` JSON.
**Reason:** Autosave was downloading and uploading the whole character `data`
blob on each small change, which wasted bandwidth and let concurrent tabs
overwrite unrelated keys.
**Consequences:** Deploy `supabase/patch_character_data.sql` to enable the light
atomic path. Until then, the browser logs a warning and uses the old
select+merge+update fallback. Full `saveCharacter` and `updateCurrentCharacterData`
still use their existing full-data paths.
**Affected files:** `public/supabase.js`, `supabase/patch_character_data.sql`
**Status:** pending SQL deploy

---

## 2026-07-07 — Performance pass: light list selects + static caching

**Area:** Supabase persistence / static assets
**Decision:** (1) Character *lists* select only `id, name, clan,
image:data->>characterImage` (PostgREST JSON-field select) — full `data` is
fetched only when a sheet is actually opened. Applied in `MainScreen.tsx` and
legacy `fetchMyCharacters` (`public/supabase.js`). (2) Heavy legacy statics
(`rules*.json`, `main.js`, etc.) get `Cache-Control: max-age=300,
stale-while-revalidate=604800` via `vercel.json` headers. (3) Storage portraits
are uploaded/served with `max-age=31536000` (migrated objects' metadata updated
in-place). (4) `preconnect` to Supabase in `app/layout.tsx` + `old-sheet.html`.
(5) The React table no longer statically imports `public/rules.json`; mappers and
table damage fallback use generated `modules/table/rules-subset.ts`, built from the
passive tracker/damage mechanics in `public/rules.json`.
**Reason:** List queries pulled ~273 KB where 3 KB suffices; rules.json (1.8 MB)
was bundled into Next client chunks; portraits re-validated/re-downloaded on
every visit.
**Consequences:** New list-consuming code must not expect full `data` from list
queries. Legacy statics may be up to 5 min stale after a deploy (SWR refreshes in
background). If passive discipline mechanics that affect tracker max or damage
fallback change, rerun `node --import tsx scripts/generate-table-rules-subset.ts`.
**Affected files:** `modules/home/components/MainScreen.tsx`, `public/supabase.js`,
`vercel.json`, `app/layout.tsx`, `public/old-sheet.html`,
`modules/table/mappers.ts`, `modules/table/GameTable.tsx`,
`modules/table/rules-subset.ts`, `scripts/generate-table-rules-subset.ts`
**Status:** active

---

## 2026-07-07 — Voice chat uses Cloudflare TURN (server-issued credentials)

**Area:** Game table / voice (WebRTC)
**Decision:** `app/api/turn-credentials/route.ts` issues short-lived Cloudflare TURN
credentials (key `vtm-voice-turn`, env `CLOUDFLARE_TURN_KEY_ID` +
`CLOUDFLARE_TURN_KEY_API_TOKEN` on Vercel, server-side only). `useTableVoice`
fetches them on voice start (`ensureVoiceIceServers`, 12h cache) and merges with
the default STUN list; without env vars it degrades to STUN-only as before.
Also fixed: ICE candidates arriving before `setRemoteDescription` are now queued
(`pendingIceCandidatesRef`) and flushed, instead of being silently dropped.
**Reason:** P2P voice failed between real players (VPN, RF CGNAT) while
self-testing worked; STUN alone cannot traverse symmetric NAT. Cloudflare TURN
includes `turns:...:443?transport=tcp`, which passes almost any network.
**Consequences:** The TURN secret must never reach the client (no `NEXT_PUBLIC_`).
Rotating the key = create new TURN key in Cloudflare (Realtime → TURN) + update
both Vercel env vars.
**Affected files:** `app/api/turn-credentials/route.ts`,
`modules/table/hooks/useTableVoice.ts`
**Status:** active

---

## 2026-07-07 — Character images live in Storage, not in JSON

**Area:** Supabase persistence / legacy character sheet / chat
**Decision:** Portraits and touchstone images are uploaded to the public Storage
bucket `character-portraits` (`public/supabase.js: uploadPortraitDataUrl`);
`characters.data` and `table_chat_messages.character_image` store only the public
URL. Base64 data-URLs remain a fallback when the upload fails, and old base64
values still render (any `<img src>` accepts both).
**Reason:** Base64 images were embedded up to 4× per sheet (`characterImage`,
`touchstones[].image`, `sheetLock.snapshot`, `sheetLock.baseState`), bloating rows
to 300–840 KB; chat rows carried ~110 KB each. Loading the character list pulled
~7 MB, chat history ~4 MB — the "Supabase is slow" symptom. After migration: avg
character row 13 KB, chat history ~9 KB.
**Consequences:** All existing rows were migrated on 2026-07-07 (backups:
`characters_backup_20260707`, `table_chat_messages_backup_20260707` — drop after
verification). New image code paths must upload to Storage and store URLs, never
embed base64. Bucket + policies: `supabase/character_portraits_storage.sql`.
Replacing an image orphans the old Storage file (acceptable for now).
**Affected files:** `public/supabase.js`, `public/main.js`,
`supabase/character_portraits_storage.sql`
**Status:** active

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
