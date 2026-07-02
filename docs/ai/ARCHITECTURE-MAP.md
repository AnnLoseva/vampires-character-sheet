# Architecture Map

How the app fits together at runtime. For per-file risk/protocol see `FILE-MAP.md`.
For a prose RU overview see `../architecture.md`.

## Runtime overview
Next.js App Router serves React routes. The **game table, journal and reference**
are modern React/TypeScript. The **full character sheet** is a legacy vanilla
HTML/JS app served from `public/` and embedded via an `<iframe>`. Both layers
persist to the same Supabase project.

## Routes
| Route | Component | Layer |
|---|---|---|
| `/` | `components/screens/MainScreen.tsx` | React |
| `/character-sheet` | `components/screens/CharacterSheetScreen.tsx` | React shell → legacy iframe |
| `/table` | `components/table/GameTable.tsx` | React |
| `/journal` | `components/journal/*` | React |
| `/reference` | `components/reference/*` | React |
| `/old` | `app/old/page.tsx` | redirect → `/character-sheet` |

## Flow: character sheet
```text
/character-sheet
 → CharacterSheetScreen              (React shell: reads room/role/characterId/new)
 → <iframe src="/old-sheet.html?room=&role=&characterId=&new=">
 → public/main.js                    (legacy sheet logic)
 → public/supabase.js                (legacy Supabase client + character CRUD)
 → public/rules.json / rules_eng.json (rules data)
 → public/vtm-health.js, vtm-humanity.js, creation-wizard.js, i18n-*.js
 ← postMessage { type: 'vtm-character-saved', characterId }  (iframe → shell)
```

## Flow: game table
```text
/table
 → GameTable                         (orchestrator: room state + Supabase I/O)
 → components/table/*                (Canvas, panels, chat, dice, scenes, media, journal)
 → lib/table/*                       (types, constants, mappers, media/layer/scene utils)
 → core/systems/vtm5/rules/*        (pure rules: health, humanity, damage, disciplines)
 → Supabase tables + storage buckets (realtime room sync)
```

## Legacy layer (`public/`)
Vanilla, no build step. `old-sheet.html` (markup/styles) + `main.js` (logic) +
`supabase.js` (data) + `creation-wizard.js` (creation) + `vtm-health.js` /
`vtm-humanity.js` (mechanics duplicates) + `i18n-runtime.js` / `i18n-dictionary.js`
(translation). Reads `rules.json` / `rules_eng.json`. Communicates with the React
shell only through URL params, localStorage, and `postMessage`.

## React / Next layer (`app/`, `components/`)
App Router routes render screen/table components. `components/screens/*` are
entry screens; `components/table/*` is the room; `modules/music/*`,
`components/journal/*`, `components/reference/*` are feature areas. Shared state
and Supabase I/O for the table currently concentrate in `GameTable.tsx`.

## VTM mechanics layer (`core/systems/vtm5/rules/*`)
Pure, framework-independent rules: `health/index.ts`, `humanity/index.ts`,
`damage/index.ts`, `derived-stats/index.ts`, and `disciplines/*` (engine, costs,
durations, effects, schema, rules-loader, character-disciplines, active-effects,
legacy-cost-parser).
This is the runtime home for TypeScript rules that may still have legacy JS
duplicates.

## Data / rules layer
`public/rules.json` (RU, ~34k lines) and `public/rules_eng.json` (EN) define
clans, skills, disciplines, merits, flaws, predator types. Consumed by both the
legacy sheet and `core/systems/vtm5/rules/disciplines/rules-loader/index.ts`. `lib/i18n/ruleNames.ts`
maps display names ↔ stable identifiers.

## Supabase layer
- Client: `lib/supabase.ts` (React), `public/supabase.js` (legacy).
- Tables: `characters`, `users`, `table_rolls`, `table_chat_messages`,
  `table_images`, `table_scenes`, `table_scene_music`, `table_music`,
  `table_music_library`, `media_studio_layers`.
- Buckets: `table-images` and a music bucket.
- Table names centralized in `lib/table/constants.ts`.
- Schema/policies live in `supabase/*.sql`.

## Media / table layer
Images, video, files and layers on the table canvas (tldraw). Utilities in
`lib/table/media-utils.ts`, `layer-utils.ts`, `scene-utils.ts`; UI in
`components/table/{TableCanvas,LayerManager,MediaLibrary,SceneManager}.tsx`.
Music in `modules/music/*` with local-audio and YouTube adapters. The root
layout mounts `GlobalMusicEngineMount` so playback survives route navigation.

## Known duplication
- Health logic: `core/systems/vtm5/rules/health/index.ts` ↔ `public/vtm-health.js`.
- Humanity logic: `core/systems/vtm5/rules/humanity/index.ts` ↔ `public/vtm-humanity.js`.
- Discipline/cost parsing: `core/systems/vtm5/rules/disciplines/*` ↔ legacy parsing in `main.js`.
- Supabase access exists in both `lib/supabase.ts` and `public/supabase.js`.
- Rules names duplicated RU/EN across the two rules JSON files.

## Direction of future refactor
Extract legacy logic into `core/systems/vtm5/rules/*` and `lib/table/*` in small, verified steps;
keep the iframe until a dedicated migration task exists; never regress the UI or
change VTM rules content during a refactor. See `ROADMAP.md` and `DECISIONS.md`.
