# Actors

UI-independent actor domain for player characters, full NPC sheets and compact
SPCs. A linked `characters` row remains the source of truth and is hydrated on
load; `chronicle_actors` stores only chronicle metadata, compact fallback stats
and explicit manual overrides. GM-only fields live in the separate
`chronicle_actor_private` table and are excluded from normalized/public payloads.

Compact-to-full conversion is deliberately two-step: prepare a character draft,
create it through the canonical character-sheet ownership flow, then link the
returned `characters.id`. Unlinking never deletes the character.

Realtime subscriptions are room-filtered for actor tables and ID-filtered for
linked character sheets. Bulk changes use the single
`bulk_update_chronicle_actors` RPC.
