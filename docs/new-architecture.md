# Новая архитектура проекта

> Актуальный справочник по целевой модели **Infrastructure → Hub → Game Systems → Modules**.
> Детальный миграционный план и legacy-контракты — в [`architecture.md`](./architecture.md).
> Карта runtime для агентов — в [`ai/ARCHITECTURE-MAP.md`](./ai/ARCHITECTURE-MAP.md).

Проект — живой VTM V5 character sheet + online game table. Архитектура вырастает
вокруг работающего legacy-листа и React-стола **маленькими проверяемыми шагами**.
Ни один рефакторинг не должен ломать маршруты, Supabase-схему, iframe-bridge или
сохранённые данные.

---

## Четыре слоя

| Слой | Папка | Ответственность | Не должен знать |
|------|-------|-----------------|-----------------|
| **Infrastructure** | `core/infrastructure/` | Низкоуровневые контракты: result types, ids, clocks, logging, storage abstractions | VTM-правила, React, feature-модули |
| **Hub** | `core/hub/` | Хроники, регистрация систем и модулей, bootstrap runtime | Правила конкретной игры, Supabase feature-запросы |
| **Game Systems** | `core/systems/{id}/` | Чистые правила + адаптеры для модулей | React, DOM, Supabase |
| **Modules** | `modules/{id}/` | UI, hooks, API, realtime, storage конкретной фичи | Правила других игровых систем |

Дополнительные зоны (не слои Hub, но важны):

- **`app/`** — тонкие route shells Next.js App Router.
- **`components/`** — экраны и оркестраторы на переходном этапе (`GameTable.tsx`).
- **`lib/`** — shared infra (`supabase`, `i18n`) и compatibility shims (`lib/table/*`).
- **`public/`** — legacy character sheet (vanilla JS, iframe).

---

## Диаграмма связей

```text
┌─────────────────────────────────────────────────────────────────┐
│  app/layout.tsx, app/*/page.tsx          (route shells)         │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  core/hub/                                                      │
│  createVtm5ChronicleHub() → register systems + modules          │
│  bootstrapChronicleRuntime(chronicle) → wire adapters            │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
┌────────────▼────────────┐    ┌─────────────▼────────────────────┐
│  core/systems/vtm5/     │    │  modules/                        │
│  rules/*  (pure TS)     │    │  table, chat, music, rolls, …    │
│  adapters/*             │───►│  configure*Module(adapter)       │
│  createVtm5SystemCore() │    │  api/, hooks/, components/       │
└─────────────────────────┘    └──────────────┬───────────────────┘
                                              │
┌─────────────────────────────────────────────▼───────────────────┐
│  core/infrastructure/  (placeholder)                              │
│  lib/supabase.ts, lib/i18n/*                                      │
└───────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│  Supabase (tables, buckets, realtime) + public/ legacy sheet    │
└─────────────────────────────────────────────────────────────────┘
```

### Поток bootstrap хроники VTM5

```text
createVtm5ChronicleHub()
  → регистрирует Vtm5System + tableModuleDefinition + rollsModuleDefinition

bootstrapChronicleRuntime(hub, chronicle)
  → hub.resolveModulesForChronicle(chronicle)
  → createVtm5SystemCore()
  → configureTableModule(vtm5.adapters.table)
  → configureRollsModule(vtm5.adapters.rolls)
  → ChronicleRuntime { chronicle, resolved, adapters }
```

**Runtime:** `app/table/page.tsx` → `TableRoute` → `bootstrapTableForRoom(room)` →
`GameTable`. Адаптеры VTM5 активны до монтирования оркестратора.

---

## Game System Core (VTM5)

Путь: `core/systems/vtm5/`

| Часть | Содержимое | Статус |
|-------|------------|--------|
| `rules/*` | health, humanity, damage, derived-stats, disciplines | ✅ перенесено, pure TS |
| `adapters/table.ts` | health, derived stats, discipline roll effects | ✅ реализовано |
| `adapters/rolls.ts` | willpower reroll eligibility | ✅ реализовано |
| `system-core.ts` | `createVtm5SystemCore()` — система + адаптеры | ✅ реализовано |

Правила core:

- без React, DOM, `window`, Supabase, Next.js;
- UI вызывает core (через адаптеры), core не вызывает UI;
- legacy-дубликаты (`public/vtm-health.js`, `public/vtm-humanity.js`) синхронизировать осознанно.

---

## Hub

Путь: `core/hub/`

| Файл | Назначение |
|------|------------|
| `types.ts` | `GameSystem`, `Module`, `Chronicle`, `ModuleRegistration`, `ChronicleHub` |
| `registry.ts` | `createHubRegistry()` — регистрация и резолв модулей |
| `hub.ts` | `createChronicleHub()` |
| `presets.ts` | `createVtm5ChronicleHub()` — preset для VTM5 |
| `chronicle-runtime.ts` | `bootstrapChronicleRuntime()` — проводка адаптеров |

Hub не содержит VTM-правил и не делает Supabase-запросов.

---

## Modules

| Модуль | Путь | Lifecycle | Что перенесено |
|--------|------|-----------|----------------|
| **table** | `modules/table/` | active | types, constants, mappers, utils, api/*, hooks/*, components (modals, controls), system-adapter, configure |
| **chat** | `modules/chat/` | active | api, hooks, ChatPanel |
| **music** | `modules/music/` | active | player, sync engine, adapters (YouTube, local audio), global mount |
| **rolls** | `modules/rolls/` | active | utils, hooks, DiceRollOverlay, system-adapter, configure |
| **character-sheet** | `modules/character-sheet/` | active | legacy bridge, CharacterSheetRoute, screen component |
| **journal** | `modules/journal/` | active | JournalRoute, JournalPage, JournalPanel, editor |
| **reference** | `modules/reference/` | active | ReferenceRoute, ReferencePage, sidebar, markdown |

### Контракт модуля

Каждый модуль описывается через `Module` из `@/core/hub`:

- `id`, `name`, `lifecycle`
- `supportedSystems` — например `['vtm5']`
- `capabilities` — `table`, `rolls`, `chat`, `music`, …
- `routes`, `persistence`, `browser` — опциональные контракты

Модули с игровой механикой принимают адаптер от системы:

```ts
// modules/table
configureTableModule(adapter: TableSystemAdapter)

// modules/rolls
configureRollsModule(adapter: RollsSystemAdapter)
```

---

## Правила разработки новых модулей

1. **Создать границу до переноса кода** — `types.ts`, `module-definition.ts`, README.
2. **Определить `ModuleRegistration`** и зарегистрировать в Hub preset или `createChronicleHub({ modules: [...] })`.
3. **Если модуль использует правила игры** — описать `*SystemAdapter` в модуле; реализацию положить в `core/systems/{id}/adapters/`.
4. **Supabase I/O** — только в `modules/{id}/api/`, через constants + mappers модуля.
5. **React state** — в `modules/{id}/hooks/`, не в route shells.
6. **UI** — в `modules/{id}/components/`; route shell импортирует один entry-компонент.
7. **Не импортировать** `@/core/systems/vtm5/rules/*` напрямую, если есть адаптер (целевое правило; table пока на переходе).
8. **Compatibility shims** — при переносе путей оставлять re-export в старом месте (`lib/table/*`).
9. **Проверки** — `npm run lint` + `npm run build` после каждого значимого шага.
10. **Не менять** Supabase table/bucket names и shape сохранённых данных без migration note.

### Шаблон нового модуля

```text
modules/my-feature/
  types.ts              # MyFeatureModule = Module<'my-feature', 'vtm5'>
  module-definition.ts  # myFeatureModuleDefinition
  system-adapter.ts     # (если нужны правила игры)
  configure.ts          # configureMyFeatureModule()
  api/
  hooks/
  components/
  index.ts
```

---

## Правила добавления новых игровых систем

1. **Создать** `core/systems/{systemId}/` с `types.ts`, `rules/`, `adapters/`.
2. **Зарегистрировать** `GameSystem` в Hub: `{ id, name, version?, rulesNamespace }`.
3. **Реализовать адаптеры** под контракты существующих модулей (`TableSystemAdapter`, `RollsSystemAdapter`, …).
4. **Экспортировать** `create{SystemId}SystemCore()` по образцу `createVtm5SystemCore()`.
5. **Добавить preset** в `core/hub/presets.ts` (например `createDnd5eChronicleHub()`).
6. **Расширить** `bootstrapChronicleRuntime()` веткой для нового `systemId`.
7. **Обновить** `supportedSystems` в module definitions затронутых модулей.
8. **Не трогать** VTM5 rules при добавлении другой системы — только новая папка в `core/systems/`.

---

## Текущий статус миграции (2026-07-02)

### ✅ Сделано

| Область | Детали |
|---------|--------|
| VTM5 rules core | `core/systems/vtm5/rules/*` — health, humanity, damage, derived-stats, disciplines |
| VTM5 adapters | table + rolls адаптеры, `createVtm5SystemCore()` |
| Hub foundation | registry, `createChronicleHub`, `createVtm5ChronicleHub`, `bootstrapChronicleRuntime` |
| Table module | api (scene, layer, roll, character, music, realtime), hooks (session, scenes, layers, rolls, realtime), utils, key components |
| Table Supabase | все table-запросы вынесены из `GameTable.tsx` в `modules/table/api/` |
| Chat module | api, hooks, ChatPanel |
| Music module | player, sync, adapters, global engine mount |
| Rolls scaffold | types, adapter contract, configure, module-definition |
| lib/table shims | re-export `@/modules/table/*` |
| Сборка | `npm run build` и `npm run lint` проходят |

### 🟡 В процессе / переходное

| Область | Детали |
|---------|--------|
| `modules/table/GameTable.tsx` | ~6.9k строк — оркестратор; UI-панели в `modules/table/components/*` |
| Прямые импорты VTM5 в GameTable | только `import type`; runtime — через adapters |
| Character state helpers | ✅ `modules/table/utils/character-state.ts` |
| Rolls factory | ✅ `modules/rolls/hooks/useQuickRollFactory.ts` |
| Hub preset | ✅ table + rolls + character-sheet + journal + reference |
| Infrastructure | `core/infrastructure/` — placeholder |
| Legacy iframe (`public/main.js`) | не мигрирован; bridge в `modules/character-sheet/legacy/` |

### ⬜ Не начато / позже

| Область | Детали |
|---------|--------|
| Voice WebRTC hook | в `GameTable.tsx` |
| Master reveals / whispers API | будущий `master-api` |
| Полный rolls UI module | отделение от table |
| React character sheet | замена legacy iframe |
| Синхронизация legacy JS | `public/vtm-health.js` ↔ TS core |
| DI / runtime registry | полноценная оркестрация Hub |

---

## Legacy-зона (не трогать широкими PR)

```text
/character-sheet → CharacterSheetScreen → iframe /old-sheet.html
  → public/main.js, public/supabase.js, public/vtm-*.js
  ← postMessage { type: 'vtm-character-saved', characterId }
```

Маршруты `/`, `/character-sheet`, `/table`, `/journal`, `/reference` — стабильны.
`app/table/page.tsx` по-прежнему рендерит `GameTable` без изменений контракта.

---

## Проверки после архитектурных изменений

```bash
npm run lint    # tsc --noEmit
npm run build   # next build
```

Дополнительно для VTM-механик:

```bash
npm run audit:disciplines
npm run validate:disciplines
npm run test:disciplines
```

Ручная smoke-проверка UI:

- `/table?room=campaign-666&role=master` и `role=player`
- `/character-sheet`, `/character-sheet?new=1`
- `/journal`, `/reference`

---

## Связанные документы

- [`architecture.md`](./architecture.md) — полный миграционный план, legacy-контракты, Definition of Done
- [`ai/CURRENT-STATE.md`](./ai/CURRENT-STATE.md) — краткий статус для агентов
- [`ai/ARCHITECTURE-MAP.md`](./ai/ARCHITECTURE-MAP.md) — runtime-карта файлов
- [`core/hub/README.md`](../core/hub/README.md) — границы Hub
- [`modules/table/README.md`](../modules/table/README.md) — статус table module