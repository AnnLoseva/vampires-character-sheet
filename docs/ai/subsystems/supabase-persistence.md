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
- `lib/table/constants.ts` — centralizes table + bucket names + keys.
- `lib/table/mappers.ts` — maps Supabase rows ↔ app objects.
- `supabase/*.sql` — table definitions, RLS policies, and storage bucket setup.

## Tables and buckets
Tables (from `lib/table/constants.ts` and `supabase/*.sql`):

| Table | Used by | Purpose |
|---|---|---|
| `characters` | legacy sheet + table | Character records (save/load) |
| `users` | app | User records |
| `table_rolls` | table | Dice rolls per room |
| `table_chat_messages` | table | Room chat |
| `table_images` | table | Images/media placed on the table |
| `table_scenes` | table | Scenes |
| `table_scene_music` | table | Music attached to scenes |
| `table_music` | table | Music state/playback |
| `table_music_library` | table | Saved music library entries |
| `media_studio_layers` | table | Layer definitions for media |

Storage buckets: `table-images` (constant `TABLE_IMAGE_BUCKET`) and a music
bucket. RLS/permissions in `supabase/{users_characters_rls,media_storage_permissions}.sql`.

## Character persistence
Handled by the **legacy** `public/supabase.js` against the `characters` table
(the React table also reads `characters` to load player sheets). Saving emits the
`vtm-character-saved` postMessage back to the bridge (see
`character-sheet-bridge.md`). Changing the character row shape affects both
layers.

## Table persistence
`GameTable.tsx` reads/writes the `table_*` tables and subscribes to a per-room
realtime channel (`table-room:{room}`). Names must come from
`lib/table/constants.ts`; row mapping goes through `lib/table/mappers.ts`.

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
