# Master Console

Desktop-first shell for `/master?room=<room-id>`. It bootstraps the same VTM5
Hub runtime and canonical room resolver as the table, but does not import or
render `GameTable`.

Business modules register as static `MasterConsoleContribution` entries in
`contributions.ts` and are lazy-loaded by `MasterModuleHost`. First live module:
**actors** (НПС и SPC). URL `?module=<id>` only resolves allow-listed ids.

Persistence contracts live in `persistence/`, browser APIs in `api/`, and
room-filtered Realtime subscriptions in `hooks/`. SQL:
`supabase/master_console_persistence.sql`.

The localStorage password is compatibility behavior, not server authorization.
Master tables require Supabase Auth + `chronicle_members.role = 'master'`.
