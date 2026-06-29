# Архитектура проекта

Этот проект сейчас живет в двух зонах: современная React-зона для стола, журнала и справочника, и legacy-зона полного листа персонажа. Цель ближайшей уборки - уменьшать монолиты маленькими безопасными шагами, не меняя пользовательский интерфейс и не добавляя новые правила VTM внутри рефакторинга.

## Текущая картина

- `app/` содержит маршруты Next.js.
- `components/table/` содержит игровой стол. Главный риск здесь - `GameTable.tsx`: он одновременно оркестрирует состояние комнаты, запросы к Supabase, броски, персонажей, чат, сцены, слои, медиа и модальные окна.
- `components/table/GameTableStyles.tsx` содержит большой набор глобальных стилей стола.
- `lib/table/` содержит типы, константы, мапперы и утилиты стола. Сюда нужно постепенно переносить API-слой Supabase.
- `lib/vtm/` - основной дом для чистых правил VTM: здоровье, человечность, дисциплины, урон и будущие модули бросков, голода и силы воли.
- `public/` содержит статические файлы и legacy-лист персонажа.

## Legacy-зона

Полный лист персонажа сейчас открывается через `components/screens/CharacterSheetScreen.tsx` в iframe и опирается на файлы:

- `public/old-sheet.html`
- `public/main.js`
- `public/supabase.js`
- `public/vtm-health.js`
- `public/vtm-humanity.js`
- `public/creation-wizard.js`

Эту зону нельзя удалять или резко переписывать, пока React-лист персонажа не заменит iframe. Новую VTM-логику нельзя добавлять прямо в `public/main.js`: чистые расчеты должны появляться в `lib/vtm/*.ts`, а legacy-страница может временно получать их через bridge-файлы.

## React-зона

React-код должен оставаться тонким слоем интерфейса и оркестрации:

- UI-компоненты живут в `components/`.
- Чистая логика VTM живет в `lib/vtm/`.
- Запросы к таблицам Supabase для игрового стола должны жить в `lib/table/*-api.ts`.
- Маппинг строк базы в UI-типы должен оставаться в `lib/table/mappers.ts` или рядом с API-слоем.

`GameTable.tsx` должен постепенно становиться оркестратором, а не контейнером всей логики. Переносить код нужно маленькими PR: сначала типы и константы, затем броски, затем hunger/rouse, затем API-слой, затем крупные UI-секции.

## VTM-механика

Один источник истины для правил - `lib/vtm/`.

Сейчас `lib/vtm/health.ts` считается основным TypeScript-модулем здоровья. `public/vtm-health.js` остается временным legacy bridge для старого листа. Новые механики нужно добавлять в TypeScript-модули:

- `lib/vtm/health.ts`
- `lib/vtm/humanity.ts`
- `lib/vtm/damage.ts`
- `lib/vtm/rolls.ts`
- `lib/vtm/hunger.ts`
- `lib/vtm/willpower.ts`
- `lib/vtm/blood-potency.ts`
- `lib/vtm/disciplines/*`

UI не должен самостоятельно считать правила, если расчет можно выразить чистой функцией в `lib/vtm`.

## Целевая структура

```txt
app/
  table/page.tsx
  character-sheet/page.tsx
  journal/page.tsx
  reference/page.tsx

components/
  screens/
  table/
    canvas/
    panels/
    rolls/
    character/
    media/
    chat/
    master/
    styles/
  character-sheet/
  character-creation/
  journal/
  music/
  reference/

lib/
  supabase.ts
  table/
    types.ts
    constants.ts
    mappers.ts
    chat-api.ts
    scene-api.ts
    layer-api.ts
    roll-api.ts
    character-api.ts
  vtm/
    rolls.ts
    hunger.ts
    willpower.ts
    health.ts
    humanity.ts
    blood-potency.ts
    disciplines/
  character-creation/
    types.ts
    validation.ts
    rules.ts
    progress.ts

public/
  rules.json
  reference/
  assets/
  legacy-sheet/
    old-sheet.html
    old-sheet.css
    index.js
```

## Правила дальнейших изменений

- Не менять `public/rules.json` в архитектурных PR.
- Не менять большие справочники в `public/reference/` в архитектурных PR.
- Не добавлять новую VTM-логику в `public/main.js`.
- Не переписывать весь `old-sheet.html` или `GameTable.tsx` за один PR.
- Не удалять рабочие функции только потому, что они выглядят устаревшими.
- Каждый шаг должен проходить `npm run build`.
