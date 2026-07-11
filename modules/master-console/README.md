# Master Console

Desktop-first shell for `/master?room=<room-id>`. It bootstraps the same VTM5
Hub runtime and canonical room resolver as the table, but does not import or
render `GameTable`.

The route still contains only the shell and placeholder states. Persistence
contracts live in `persistence/`, browser APIs in `api/`, and room-filtered,
cleaned-up Realtime subscriptions in `hooks/`. The SQL contract is
`supabase/master_console_persistence.sql`.

The localStorage password is compatibility behavior, not server authorization.
The persistence tables require a real Supabase Auth user with an explicit
`chronicle_members.role = 'master'` row. The current shell does not pretend that
its local password satisfies that requirement and does not mount persistence
hooks until Auth migration is connected.
