# Supabase Persistence

## Purpose
Supabase is the shared backend for both layers: it stores characters and all
game-table state (rolls, chat, scenes, media, layers, music) and provides
realtime room sync. Its schema is a **contract** shared by the React table and
the legacy sheet — undocumented drift breaks save/load and sync everywhere.

## Main files
- `lib/supabase.ts` — the React/Next Supabase client.
- `public/supabase.js` — the legacy client + `characters` CRUD (create/update/
  load/list, with `charactersListCache`).
- `modules/table/constants.ts` — centralizes table + bucket names + keys.
- `modules/table/mappers.ts` — maps Supabase rows ↔ app objects.
- `supabase/*.sql` — table definitions, RLS policies, and storage bucket setup.
  `supabase/patch_character_data.sql` defines the character autosave patch RPC.

## Tables and buckets
Tables (from `modules/table/constants.ts` and `supabase/*.sql`):

| Table | Used by | Purpose |
|---|---|---|
| `characters` | legacy sheet + table | Character records (save/load) |
| `users` | app | User records |
| `table_rolls` | table + master public rolls | Dice rolls per room (player-visible) |
| `master_hidden_rolls` | master-rolls | Master-only hidden rolls until reveal |
| `table_chat_messages` | table | Room chat |
| `table_images` | table | Images/media placed on the table |
| `table_scenes` | table | Scenes |
| `table_scene_music` | table | Music attached to scenes |
| `table_music` | table | Music state/playback |
| `table_music_library` | table | Saved music library entries |
| `media_studio_layers` | table | Layer definitions for media |
| `chronicles` | master console security | Authoritative room/chronicle identity |
| `chronicle_members` | master console security | Supabase Auth membership and role |
| `chronicle_sessions` | master console | Session/night metadata and master summaries |
| `master_layouts` | master console | Per-owner versioned desktop layouts |
| `master_macros` | master console | Shared or owner-scoped macro definitions |
| `chronicle_entity_links` | master console | Validated generic entity relations |
| `master_action_log` | master console | Append-only master action history |
| `chronicle_actors` | actors | Chronicle actor metadata, compact stat blocks and character links |
| `chronicle_actor_private` | actors | Physically separate GM-only actor fields |

Storage buckets: `table-images` (constant `TABLE_IMAGE_BUCKET`), a music bucket,
and `character-portraits` (portraits + touchstone images; see
`supabase/character_portraits_storage.sql`). RLS/permissions in
`supabase/{users_characters_rls,media_storage_permissions,character_portraits_storage}.sql`.

**Images are never embedded as base64 in rows.** Portraits/touchstone images go
through `uploadPortraitDataUrl` (`public/supabase.js`) into `character-portraits`;
`characters.data` and `table_chat_messages.character_image` hold public URLs
(base64 only as upload-failure fallback). See the 2026-07-07 DECISIONS entry.

## Character persistence
Handled by the **legacy** `public/supabase.js` against the `characters` table
(the React table also reads `characters` to load player sheets). Saving emits the
`vtm-character-saved` postMessage back to the bridge (see
`character-sheet-bridge.md`). Changing the character row shape affects both
layers.

Legacy autosave patching uses the `vtm_patch_character_data(p_id, p_user_id,
p_patch)` RPC when deployed. The RPC deep-merges object keys atomically in
Postgres and replaces arrays/scalars/nulls whole, matching `mergeCharacterPatch`
in `public/supabase.js`; the browser keeps a select+merge+update fallback while
the SQL is not deployed.

## Table persistence
`GameTable.tsx` reads/writes most `table_*` tables and subscribes to a per-room
realtime channel (`table-room:{room}`). Chat is handled by `modules/chat/*`
against `table_chat_messages`. Names must come from `modules/table/constants.ts`;
row mapping belongs in the relevant module/API.

## Master console persistence

`supabase/master_console_persistence.sql` is the schema/RLS contract;
`modules/master-console/persistence/*` owns constants, types, validation and
mappers. APIs and Realtime hooks are in the adjacent `api/` and `hooks/`
directories. Every subscription is filtered by `room` and cleaned up on effect
teardown. These tables revoke anon access and require Supabase Auth plus a
`chronicle_members` master role. They are deliberately not connected to the
legacy localStorage password gate. Initial chronicle/master provisioning is an
administrator/service-role operation.

Actor persistence is defined separately in `supabase/chronicle_actors.sql` and
depends on the master foundation. A partial unique index prevents linking the
same `characters.id` twice within one chronicle. Linked character data is loaded
from `characters` on hydration and is never copied wholesale into the actor row.
GM-only fields use `chronicle_actor_private`; both actor tables require master
membership. Bulk actor changes use one whitelisted, room-scoped RPC.

## Music / media persistence
Images/media → `table_images` + `table-images` bucket; music → `table_music`,
`table_music_library`, `table_scene_music` + the music bucket; layers →
`media_studio_layers`. See `music-and-media.md`.

## Schema drift risks
- Renaming a table/bucket without updating `constants.ts` + `supabase/*.sql` +
  both clients breaks that feature.
- Changing a row's columns/shape without a migration note breaks save/load.
- Two clients (`lib/supabase.ts`, `public/supabase.js`) can diverge in config.
- RLS changes can silently block anon/authenticated access.

## Safe edit protocol
1. Read `../workflows/supabase-edit-protocol.md`.
2. Never rename tables/buckets casually. Change name in `constants.ts`, both
   clients, mappers, and `supabase/*.sql` together.
3. Never change saved-data shape without a migration note in `DECISIONS.md`.
4. Verify master and player room flow after any change.

## Related docs
`game-table.md`, `character-sheet-bridge.md`, `music-and-media.md`,
`../workflows/supabase-edit-protocol.md`.
