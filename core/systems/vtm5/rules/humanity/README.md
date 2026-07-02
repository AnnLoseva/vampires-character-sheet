# Humanity Rules

Runtime home for humanity, stains, and remorse rules implemented in
`core/systems/vtm5/rules/humanity/index.ts`.

Key exports: `getHumanityState`, `addHumanityStains`, `getRemorseDice`,
`applyRemorseCheckResult` (pure state transition; callers roll dice).

Legacy mirror: `public/vtm-humanity.js` — keep in sync via `npm run test:vtm-parity`.
