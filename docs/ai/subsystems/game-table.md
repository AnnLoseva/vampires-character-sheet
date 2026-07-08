# Game Table

## Purpose
The shared campaign room where the master and players meet: scenes, media on a
canvas, layers, dice rolls, chat, an in-table journal, and music — all synced in
real time through Supabase and keyed by `room`.

## Main entry
- Route: `/table` (`app/table/page.tsx`) → `modules/table/TableRoute` →
  `modules/table/GameTable.tsx`.
- `GameTable.tsx` (~2.6k lines) is the **orchestrator**: it holds room state, does
  Supabase reads/writes and realtime subscriptions, and coordinates the child
  panels/modals.

## Major responsibilities (currently concentrated in `GameTable.tsx`)
- Read `room` / `role` (params + localStorage), gate master-only actions
  (`MASTER_PASSWORD_KEY`).
- Load and subscribe to: rolls, chat, images, scenes, scene-music, music library.
- Coordinate scenes, layers, media placement, dice, chat, journal, music panels.
- Manage modals/overlays (e.g. dice roll overlay).

> **Do not grow this file.** New sizeable behavior goes to child components,
> hooks, or `modules/table/utils/*` / `core/systems/vtm5/rules/*`. See
> `../workflows/react-table-edit-protocol.md` and the `DECISIONS.md` entry.

## Important child components (`modules/table/components/*`)
- `TableCanvas.tsx` — the tldraw canvas (media/layer rendering).
- `TableLeftPanel.tsx`, `TableRightPanel.tsx`, `MasterPanel.tsx` — panel shells.
- `SceneManager.tsx`, `LayerManager.tsx`, `MediaLibrary.tsx` — scenes / layers /
  media UI (use `modules/table/utils/*` helpers).
- `DiceRollOverlay.tsx` — roll UI/overlay (see `dice-and-rolls.md`).
- Chat: `modules/chat/*`.
- `JournalPanel.tsx` — in-table journal.
- `GameTableStyles.tsx` — large global style block for the table.
- Music: `modules/music/*` (see `music-and-media.md`).

## Table data model
Canonical types/constants/mappers live in `modules/table/*`:
- `types.ts` — shared table types (rolls, scenes, layers, media…); chat types
  re-exported from `modules/chat/types.ts`.
- `constants.ts` — table/bucket names + keys (see below).
- `mappers.ts` — map Supabase rows ↔ app objects.
- `api/*` — Supabase API scaffolds (stubs; I/O still in `GameTable.tsx`).
- `utils/*` — scene/layer/media/roll/room helpers.

## Supabase dependencies
Table names come from `modules/table/constants.ts` (and a couple defined near their
use): `table_rolls`, `table_chat_messages`, `table_images`, `table_scenes`,
`table_scene_music`, `table_music`, `table_music_library`; plus `characters` for
loading player sheets. Buckets: `table-images` and a music bucket. Realtime is a
per-room channel (`table-room:{room}`). See `supabase-persistence.md`.

## Media / layer model
Media items (images/video/files) are placed on the canvas and organized into
layers within a scene; visibility is scene/layer driven. Root layer drop id is
`ROOT_LAYER_DROP_ID` (`__root__`). Helpers live in `modules/table/utils/*`.
See `music-and-media.md`.

## Dice / roll integration
Rolls are stored in `table_rolls` and surfaced via `DiceRollOverlay.tsx`; the
legacy sheet can also feed rolls (the `vtm-table-rolls` / `vtm-table-last-roll`
signals). See `dice-and-rolls.md`.

## Known risks
- The monolith size makes any inline change risky — prefer extraction.
- Realtime subscriptions and state must stay consistent per `room`.
- Master-only gating must not leak to players.
- Scene/layer/media references cross-reference Supabase rows — mismatches hide or
  duplicate media.

## Safe edit protocol
1. Read `../workflows/react-table-edit-protocol.md`.
2. Put UI in a component, table data in `modules/table/*`, utils in `modules/table/utils/*`,
   rules in `core/systems/vtm5/rules/*`.
3. Keep Supabase table/bucket names in `modules/table/constants.ts` — never
   hardcode new ones.
4. Verify: `/table?room=campaign-666&role=master` and `&role=player` — room/role
   persistence, a dice roll, scene/layer visibility, chat, and the music panel.

## Related docs
`dice-and-rolls.md`, `music-and-media.md`, `supabase-persistence.md`,
`character-sheet-bridge.md`, `../workflows/react-table-edit-protocol.md`.
