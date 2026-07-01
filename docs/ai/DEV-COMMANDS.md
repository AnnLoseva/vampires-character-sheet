# Dev Commands

From `package.json`. Run the relevant checks after edits (see
`workflows/verification-checklist.md`).

> Environment note: some sessions run without a local Node/npm toolchain. If a
> command cannot run here, state that honestly and describe what it *would*
> verify — never report a pass you did not observe.

## `npm run dev`
- **What:** starts the Next.js dev server.
- **When:** manual/interactive testing of routes and UI.
- **Failure means:** build/runtime error in an App Router route or a client
  component.
- **Usual culprits:** `app/*/page.tsx`, `components/screens/*`,
  `components/table/GameTable.tsx`, client/server component boundaries.

## `npm run build`
- **What:** full production build (`next build`) — the strongest local gate.
- **When:** before considering a non-trivial change done.
- **Failure means:** type error, invalid import, or a route that fails to compile.
- **Usual culprits:** `lib/*`, `components/table/*`, type mismatches from
  `lib/table/types.ts` or `lib/vtm/*`.

## `npm run lint`
- **What:** `tsc --noEmit --incremental false` — a full TypeScript type check
  (this is the "lint" here; it is a type check, not ESLint).
- **When:** after almost any TS/TSX edit.
- **Failure means:** a type error somewhere in the graph.
- **Usual culprits:** changed shapes in `lib/table/types.ts`, `lib/vtm/*`,
  `lib/i18n/ruleNames.ts`, or component props.

## `npm run audit:structure`
- **What:** `scripts/audit-project-structure.ts` — audits project structure /
  duplication.
- **When:** after moving/extracting files, or before a structural change.
- **Failure means:** structure drifted from expectations or new duplication.
- **Usual culprits:** duplicated logic between legacy JS and `lib/*`, misplaced
  modules.

## `npm run audit:disciplines`
- **What:** `scripts/audit-discipline-rules.ts` — audits discipline rules data.
- **When:** after editing disciplines in `rules.json` / `rules_eng.json` or
  `lib/vtm/disciplines/*`.
- **Failure means:** discipline rules data is inconsistent or incomplete.
- **Usual culprits:** `public/rules.json`, `public/rules_eng.json`,
  `lib/vtm/disciplines/rules-loader.ts`, `schema.ts`.

## `npm run validate:disciplines`
- **What:** `scripts/validate-discipline-mechanics.ts` — validates discipline
  mechanics.
- **When:** after changing discipline costs/durations/effects logic.
- **Failure means:** a mechanic doesn't validate against the schema/expectations.
- **Usual culprits:** `lib/vtm/disciplines/{costs,durations,effects,engine}.ts`.

## `npm run test:disciplines`
- **What:** `scripts/test-discipline-engine.ts` — tests the discipline engine.
- **When:** after any change to the discipline engine.
- **Failure means:** engine behavior regressed.
- **Usual culprits:** `lib/vtm/disciplines/engine.ts` and its inputs.

## Recommended order after a change
1. `npm run lint` (fast type check)
2. area audit/validate/test scripts (if VTM/disciplines touched)
3. `npm run build` (final gate)
4. manual smoke of affected routes (`workflows/verification-checklist.md`)
