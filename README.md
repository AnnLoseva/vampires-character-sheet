# vampires-character-sheet

VTM V5 character sheet and online campaign table (Next.js + Supabase + legacy iframe sheet).

## Routes

| Route | Description |
|-------|-------------|
| `/` | Main screen |
| `/character-sheet` | Character sheet (React shell → legacy iframe) |
| `/table` | Campaign table (scenes, layers, rolls, chat, music) |
| `/journal` | Chronicle journal |
| `/reference` | Rules reference |

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # TypeScript check (tsc --noEmit)
npm run build    # production build
```

Discipline mechanics audits:

```bash
npm run audit:disciplines
npm run validate:disciplines
npm run test:disciplines
```

## Architecture

The project is migrating to a layered model:

```text
Infrastructure → Hub → Game Systems → Modules
```

| Layer | Path | Role |
|-------|------|------|
| Infrastructure | `core/infrastructure/` | Low-level shared contracts (placeholder) |
| Hub | `core/hub/` | Chronicle setup, module/system registry, runtime bootstrap |
| Game Systems | `core/systems/vtm5/` | Pure VTM5 rules + adapters for modules |
| Modules | `modules/*/` | Feature areas: table, chat, music, rolls, … |

**Full documentation:** [`docs/new-architecture.md`](docs/new-architecture.md)

Quick bootstrap example (not yet wired into routes):

```ts
import { bootstrapChronicleRuntime, createVtm5ChronicleHub } from '@/core/hub'

const hub = createVtm5ChronicleHub()
const runtime = bootstrapChronicleRuntime(hub, {
  id: 'chronicle-1',
  name: 'Campaign',
  systemId: 'vtm5',
  roomId: 'campaign-666',
})
```

### Key folders

- `app/` — Next.js route shells
- `components/` — screens and `GameTable` orchestrator (transition)
- `modules/table/` — table data layer, API, hooks, components
- `modules/chat/`, `modules/music/` — extracted feature modules
- `core/systems/vtm5/rules/` — framework-independent VTM5 mechanics
- `lib/table/` — compatibility shims → `@/modules/table`
- `public/` — legacy character sheet (`main.js`, `old-sheet.html`)

### Legacy sheet

The full character sheet runs as vanilla JS inside an iframe (`public/old-sheet.html`).
Do not rewrite `public/main.js` in wide PRs — see `docs/architecture.md`.

## Docs

- [`docs/new-architecture.md`](docs/new-architecture.md) — target architecture and migration status
- [`docs/architecture.md`](docs/architecture.md) — detailed migration plan and contracts
- [`docs/ai/`](docs/ai/) — agent context (file map, workflows, risks)