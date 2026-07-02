# Character Sheet Module

React shell for `/character-sheet` and the legacy iframe bridge.

## Layout
- `CharacterSheetRoute.tsx` — route entry
- `components/CharacterSheetScreen.tsx` — nav + iframe mount
- `legacy/params.ts` — URL/localStorage param contract (`room`, `role`, `characterId`, `new`)
- `legacy/events.ts` — `vtm-character-saved` message validation (origin check)
- `legacy/bridge.ts` — postMessage subscription, URL replace/push, draft clearing

## Legacy iframe (unchanged)
The actual sheet UI/logic remains in `public/old-sheet.html` + `public/main.js`.
Do not rewrite inline — follow `docs/ai/workflows/legacy-edit-protocol.md`.

## Parity
Health/humanity mechanics in `public/vtm-health.js` and `public/vtm-humanity.js`
must match `core/systems/vtm5/rules/{health,humanity}/`. Run after edits:
```bash
npm run test:vtm-parity
```

## Next incremental work
1. Humanity / stains / remorse UX in `main.js`
2. Character creation wizard improvements (`creation-wizard.js`)
3. Sync full sheet ↔ table quick-preview representations
4. Extract more pure logic from `main.js` into `core/` (one function at a time)