# Project Brief

## One-line description
A Vampire: The Masquerade V5 digital character sheet plus an online game table
(campaign room) for a master and players.

## Product goal
Let a VTM V5 group run a chronicle online: each player keeps a full character
sheet, and everyone shares a real-time game table with scenes, media, dice rolls,
chat, journal, music, and a rules reference — persisted so a room can be left and
resumed.

## Target user
- **Players** — fill in and maintain their vampire character sheet, roll dice,
  take damage, track hunger/willpower/humanity.
- **Master (Storyteller)** — runs the room: scenes, media layers, music, NPCs,
  and adjudicates rolls.

Single app, two roles, driven by a `role` (`master` | `player`) parameter.

## Main modes
1. **Character sheet** — the full V5 sheet (currently the legacy sheet in an
   iframe) with creation, saving, health/humanity, disciplines.
2. **Game table** — the shared campaign room (`GameTable`): scenes, media,
   layers, dice, chat, journal, music.
3. **Journal** — `/journal`, a TipTap-based rich journal.
4. **Reference** — `/reference`, a markdown rules reference.
5. **Chronicle library** — `/library/chronicles`, a private Markdown archive
   with membership-scoped official history and owner-only processed player
   transcripts/personal recaps.
6. **Master console** — `/master?room=...`, a desktop shell for future
   Storyteller modules; currently protected by the compatibility master-password gate.

Typical flow: **main screen → pick/create character → open room → jump between
sheet and table**, carrying `room`, `role`, `characterId`.

## Current tech stack
- **Next.js 16 (App Router)**, **React 19**, **TypeScript**
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`) for DB + storage
- **tldraw** (table canvas), **three** (3D), **framer-motion** (animation)
- **TipTap** (journal editor), **react-markdown / remark-gfm** (reference)
- Legacy character sheet: **vanilla HTML/CSS/JS** in `public/` (no build step)

## Core routes
| Route | Renders | Notes |
|---|---|---|
| `/` | `HomeRoute` → `MainScreen` | Landing / entry (character & room selection) |
| `/character-sheet` | `CharacterSheetScreen` → iframe `/old-sheet.html` | The full legacy sheet |
| `/table` | `GameTable` | The shared campaign room |
| `/journal` | Journal editor | Rich-text journal |
| `/reference` | Reference pages | Markdown rules reference |
| `/library/chronicles` | `ChronicleLibraryRoute` | Official Chronicle reader, Storyteller upload and owner-only player transcript processing |
| `/master?room=<room-id>` | `MasterConsoleRoute` → `MasterConsoleShell` | Desktop Storyteller workspace shell; room is required |
| `/old` | redirect | Legacy redirect → `/character-sheet` |

## Main data sources
- **`public/rules.json` / `public/rules_eng.json`** — clans, skills, disciplines,
  merits, flaws, predator types (RU + EN). The rules data layer.
- **Supabase tables** — `characters`, `users`, `table_rolls`,
  `table_chat_messages`, `table_images`, `table_scenes`, `table_scene_music`,
  `table_music`, `table_music_library`, `media_studio_layers`, plus private
  `library_chronicles`, `library_chronicle_members` and
  `library_chronicle_chunks`, plus owner-only personal Chronicle jobs,
  source chunks and final documents.
- **Supabase storage buckets** — `table-images` and a music bucket for uploaded
  table/media assets.
- **localStorage** — room/role and character-creation drafts (bridge state).

## Non-goals
- Not rebuilding the app from scratch or imposing a "perfect" architecture.
- Not migrating the legacy sheet out of the iframe (no task for it yet).
- Not refactoring `GameTable.tsx` wholesale.
- Not changing VTM rules content as a side effect of other work.
- Not a generic AI-memory system — this context is specific to this site.

## Design direction
Dark, blood-red VTM aesthetic. Keep the current UI stable. Evolve gradually from
the legacy monolith toward modular React + `core/systems/vtm5/rules/*` rules, in small safe steps
— without abrupt rewrites or UI regressions.
