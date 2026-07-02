# File Map

Practical map of the files an agent is most likely to touch. Read this **before
opening code**. Risk levels drive how careful you must be.

## Risk levels
- **critical** — do **not** edit without reading the matching workflow first; a
  mistake breaks core flows (sheet save/load, room sync, rules).
- **high** — check all cross-references/usages before editing.
- **medium** — local verification required (types, the affected route).
- **low** — safe to edit in a focused, local way.

## Routes & screens
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `app/page.tsx` | `/` route → MainScreen | low | before-any-change | Thin wrapper |
| `app/character-sheet/page.tsx` | `/character-sheet` route | low | before-any-change | Thin wrapper |
| `app/table/page.tsx` | `/table` route | low | before-any-change | Thin wrapper |
| `app/old/page.tsx` | legacy redirect | low | before-any-change | Redirects to `/character-sheet` |
| `components/screens/MainScreen.tsx` | landing / entry | medium | react-table-edit-protocol | Character/room selection |
| `components/screens/CharacterSheetScreen.tsx` | iframe bridge shell | **high** | legacy-edit-protocol | Owns room/role/characterId/new + postMessage |

## Game table (React)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `components/table/GameTable.tsx` | room orchestrator (~7.4k lines) | **critical** | react-table-edit-protocol | Do not grow it; extract to `modules/table` |
| `components/table/TableCanvas.tsx` | tldraw canvas | high | react-table-edit-protocol | Media/layer rendering |
| `components/table/{TableLeftPanel,TableRightPanel,MasterPanel}.tsx` | panels | medium | react-table-edit-protocol | UI shells |
| `components/table/{SceneManager,LayerManager,MediaLibrary}.tsx` | scenes/layers/media UI | high | react-table-edit-protocol | Uses `lib/table/*` utils |
| `components/table/DiceRollOverlay.tsx` | roll UI/overlay | high | vtm-mechanics-edit-protocol | See dice-and-rolls subsystem |
| `components/table/JournalPanel.tsx` | in-table journal | medium | react-table-edit-protocol | |
| `components/table/GameTableStyles.tsx` | global table styles | medium | react-table-edit-protocol | Large style block |
| `components/table/VampireTable.tsx`, `components/VampireTable.tsx`, `components/CharacterSheet.tsx` | React sheet/table variants | high | react-table-edit-protocol | Confirm which is live before editing |

## Table module (`modules/table/*`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `modules/table/types.ts` | table data model (canonical) | high | react-table-edit-protocol | Chat types re-exported from `modules/chat/types` |
| `modules/table/constants.ts` | table/bucket names, keys (canonical) | **critical** | supabase-edit-protocol | Includes `constants/roll-traits.ts` |
| `modules/table/mappers.ts` | DB ↔ app mapping (canonical) | high | supabase-edit-protocol | |
| `modules/table/utils/*` | scene/layer/media/roll helpers (canonical) | medium | react-table-edit-protocol | `lib/table/*-utils.ts` shims |
| `modules/table/api/*` | Supabase API (scene/layer/roll/character) | high | supabase-edit-protocol | Wired from `GameTable.tsx` |
| `modules/table/hooks/*` | room/rolls/scenes/layers/realtime | high | react-table-edit-protocol | Wired in `GameTable.tsx` |
| `modules/table/components/*` | modals + roll UI slices | medium | react-table-edit-protocol | See `components/README.md` |
| `modules/table/index.ts` | public module barrel | low | before-any-change | |
| `lib/table/{types,constants,mappers,*-utils}.ts` | compatibility shims | low | before-any-change | Re-export `@/modules/table/*` |

## Chat, music, journal, reference
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `modules/chat/components/ChatPanel.tsx` | chat UI | medium | react-table-edit-protocol | `table_chat_messages` |
| `modules/chat/hooks/useChat.ts` | chat state/auth/realtime | high | react-table-edit-protocol + supabase-edit-protocol | Supabase realtime + localStorage user |
| `modules/chat/api/chat-api.ts` | chat Supabase API/mappers | high | supabase-edit-protocol | Do not rename `table_chat_messages` |
| `modules/music/components/MusicPlayer.tsx` | music UI | medium | react-table-edit-protocol | |
| `modules/music/components/GlobalMusicEngineMount.tsx` | persistent hidden music mount | medium | react-table-edit-protocol | Root layout mount; keep stable across navigation |
| `modules/music/MusicSyncEngine.ts` | music sync | high | react-table-edit-protocol | Realtime sync + autoplay limits |
| `modules/music/adapters/{localAudioAdapter,youtubeAdapter}.ts` | playback adapters | medium | react-table-edit-protocol | Browser/YouTube limits |
| `components/journal/*` | TipTap journal | medium | before-any-change | |
| `components/reference/*` | markdown reference | low | before-any-change | |

## VTM mechanics (`core/systems/vtm5/rules/*`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `core/systems/vtm5/rules/health/index.ts` | health/damage tracker | **critical** | vtm-mechanics-edit-protocol | Legacy dup: `public/vtm-health.js` |
| `core/systems/vtm5/rules/humanity/index.ts` | humanity/stains/remorse | **critical** | vtm-mechanics-edit-protocol | Legacy dup: `public/vtm-humanity.js` |
| `core/systems/vtm5/rules/damage/index.ts` | damage helpers | high | vtm-mechanics-edit-protocol | |
| `core/systems/vtm5/rules/derived-stats/index.ts` | derived stats | high | vtm-mechanics-edit-protocol | |
| `core/systems/vtm5/rules/disciplines/*` | discipline engine | high | vtm-mechanics-edit-protocol | Run discipline scripts after edits |

## Table libs (`lib/table/*` — utils + shims)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `lib/table/constants.ts` | shim → `modules/table/constants` | low | before-any-change | Prefer `@/modules/table` |
| `lib/table/types.ts` | shim → `modules/table/types` | low | before-any-change | Prefer `@/modules/table` |
| `lib/table/mappers.ts` | shim → `modules/table/mappers` | low | before-any-change | Prefer `@/modules/table` |
| `lib/table/media-utils.ts` | shim → `modules/table/utils/media-utils` | low | before-any-change | |
| `lib/table/layer-utils.ts` | shim → `modules/table/utils/layer-utils` | low | before-any-change | |
| `lib/table/scene-utils.ts` | shim → `modules/table/utils/scene-utils` | low | before-any-change | |
| `lib/table/{roll-utils,dice-display}.ts` | shim → `modules/table/utils/*` | low | before-any-change | |

## i18n & Supabase client
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `lib/i18n/LanguageProvider.tsx` | RU/EN provider (`useLang`, `t`) | medium | before-any-change | |
| `lib/i18n/dictionary.ts` | UI strings | low | before-any-change | |
| `lib/i18n/ruleNames.ts` | display name ↔ stable id | high | before-any-change | Compare IDs, not display names |
| `lib/supabase.ts` | React Supabase client | high | supabase-edit-protocol | |

## Legacy (`public/`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `public/old-sheet.html` | legacy sheet markup/styles (~5k) | **critical** | legacy-edit-protocol | |
| `public/main.js` | legacy sheet logic (~11k) | **critical** | legacy-edit-protocol | Watch global vars |
| `public/supabase.js` | legacy Supabase + character CRUD | **critical** | supabase-edit-protocol | `characters` table |
| `public/vtm-health.js` | legacy health | **critical** | vtm-mechanics-edit-protocol | Sync with `core/systems/vtm5/rules/health/index.ts` |
| `public/vtm-humanity.js` | legacy humanity | **critical** | vtm-mechanics-edit-protocol | Sync with `core/systems/vtm5/rules/humanity/index.ts` |
| `public/creation-wizard.js` | character creation | high | legacy-edit-protocol | |
| `public/i18n-runtime.js` | legacy i18n runtime | high | legacy-edit-protocol | |
| `public/i18n-dictionary.js` | legacy i18n strings | medium | legacy-edit-protocol | |
| `public/rules.json` | rules data (RU, ~34k) | **critical** | see rules-data subsystem | Data layer, no UI logic |
| `public/rules_eng.json` | rules data (EN) | **critical** | see rules-data subsystem | Keep in sync with RU |

## Scripts (`scripts/`)
| Path | Role | Risk | Edit protocol | Notes |
|---|---|---|---|---|
| `scripts/audit-project-structure.ts` | `npm run audit:structure` | low | before-any-change | Structure/duplication audit |
| `scripts/audit-discipline-rules.ts` | `npm run audit:disciplines` | low | before-any-change | Discipline rules audit |
| `scripts/validate-discipline-mechanics.ts` | `npm run validate:disciplines` | low | before-any-change | Mechanics validation |
| `scripts/test-discipline-engine.ts` | `npm run test:disciplines` | low | before-any-change | Engine tests |

> Workflows referenced above live in `docs/ai/workflows/`. "before-any-change" is
> the general checklist; the others are area-specific protocols.
