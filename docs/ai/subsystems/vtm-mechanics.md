# VTM Mechanics

## Purpose
Pure, framework-independent VTM V5 rules logic. These modules take data and
return data — no React, no DOM, no Supabase. They are the intended single source
of truth as logic migrates out of the legacy sheet.

## Modules (`lib/vtm/*`)
- `health.ts` — health/damage tracker (superficial/aggravated, max, impaired,
  physical state for vampire/mortal/ghoul/thinblood/custom).
- `humanity.ts` — humanity, stains, remorse.
- `damage.ts` — damage helpers/utilities.
- `derived-stats.ts` — derived statistics from attributes/skills.
- `disciplines/` — the discipline engine and supporting data:
  - `engine.ts` — evaluates disciplines/powers.
  - `schema.ts` — discipline data schema.
  - `rules-loader.ts` — loads disciplines from `rules.json` / `rules_eng.json`.
  - `costs.ts`, `durations.ts`, `effects.ts` — mechanics of powers.
  - `character-disciplines.ts` — a character's disciplines.
  - `active-effects.ts` — currently active effects.
  - `legacy-cost-parser.ts` — parses legacy cost strings (bridge from old data).

## Health
`health.ts` exposes typed trackers (`HealthTracker`, `NormalizedHealth`) and
damage application. Damage has severity (superficial/aggravated), a target
(health/willpower), and options (source, weapon tags, armor, halving, margin…).
Physical states include healthy/impaired/torpor/dead. **Legacy duplicate:**
`public/vtm-health.js` — keep behavior aligned.

## Willpower
Willpower damage is modeled via the same damage/target machinery (`target:
'willpower'`) rather than a separate module. Check `health.ts`/`damage.ts` before
adding a parallel implementation.

## Humanity / stains / remorse
`humanity.ts` handles the humanity track, stains, and remorse rolls/flow.
**Legacy duplicate:** `public/vtm-humanity.js`. The end-to-end
stains→remorse→humanity UX is a roadmap item.

## Derived stats
`derived-stats.ts` computes values derived from core traits (e.g. health/willpower
maxima, other derived numbers). Changing derivation affects the sheet and the
table — verify both.

## Disciplines
The discipline layer loads rules from the JSON data, validates them against
`schema.ts`, and evaluates costs/durations/effects through `engine.ts`. This is
the most test-covered area — use the scripts below.

## Legacy duplication
- `lib/vtm/health.ts` ↔ `public/vtm-health.js`
- `lib/vtm/humanity.ts` ↔ `public/vtm-humanity.js`
- discipline cost/effect parsing ↔ legacy parsing in `public/main.js`
  (`legacy-cost-parser.ts` exists to bridge old cost strings)

When you change one side, decide whether the other must change too, and record
divergence in `DECISIONS.md`.

## Tests and validation
- `npm run audit:disciplines` — audits discipline rules data.
- `npm run validate:disciplines` — validates discipline mechanics.
- `npm run test:disciplines` — tests the discipline engine.
- `npm run lint` — type check.

## Safe edit protocol
1. Read `../workflows/vtm-mechanics-edit-protocol.md`.
2. Keep the module pure; no React/DOM/Supabase imports.
3. Check disciplines and derived stats for knock-on effects.
4. If a legacy duplicate exists, note it and sync if needed.
5. Run the discipline scripts + `npm run lint`.

## Related docs
`rules-data.md`, `dice-and-rolls.md`, `legacy-character-sheet.md`,
`../workflows/vtm-mechanics-edit-protocol.md`.
