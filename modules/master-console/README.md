# Master Console

Desktop-first shell for `/master?room=<room-id>`. It bootstraps the same VTM5
Hub runtime and canonical room resolver as the table, but does not import or
render `GameTable`.

This phase contains only the route shell, existing local master-password gate,
three-column layout and placeholder states. It adds no Supabase tables, realtime
subscriptions or business modules. URL role values never bypass the gate.

The localStorage password is compatibility behavior, not server authorization.
Real master privacy still requires the Auth/RLS foundation documented in
`docs/design/master-console/SECURITY-MODEL.md`.
