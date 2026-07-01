# Agent Notes: ChatGPT

Entry points: `../../AGENTS.md` then `../INDEX.md`.

## Strengths to lean on
- Planning and task breakdown.
- UX reasoning and debugging explanations.
- Turning a vague request into a concrete task card
  (`../templates/task-card-template.md`).

## Guardrails
- **If you are not connected to the repo, ask for exact file contents** — do not
  invent the current repo state, file paths, or APIs.
- Do not assume a file exists; confirm via `../FILE-MAP.md` or ask for it.
- Ground answers in the subsystem docs and the file map, not general VTM/Next.js
  knowledge.
- Respect the same rules as everyone: no monolith rewrites, preserve the bridge/
  Supabase/rules contracts, keep changes small.
- When proposing changes, name the files and the workflow to follow.
