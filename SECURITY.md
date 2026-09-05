# Security Policy

Round Table Draft is a private fantasy league. A public GitHub Security tab
template does not describe this repo.

## Reporting

Email the repo owner privately. Do not open a public issue for anything that
would let someone impersonate a manager, read another table's roster, or send
push to the league.

## What is public by design

The Supabase anon key ships in the web client. Row Level Security is the access
control. A leaked anon key is not a breach.

## What is not

- `SUPABASE_SERVICE_ROLE_KEY`
- APNs `.p8` / `APNS_PRIVATE_KEY`
- Admin session cookies
- Anyone's email, push token, or draft picks

The service-role key, the APNs key, and admin session secrets never belong in
the client, in git, or in a support email.

## Native

Archive only the bundled shell (`npm run ios:sync:bundled`). A hosted
`server.url` in a store binary is a Guideline 4.2 defect and points the binary
at a server we do not control at review time.

Live APNs sends from `send-lock-reminder` require `APNS_ENV=production`.
TestFlight and App Store both use the production APNs host. Sandbox is only for
Xcode-signed development builds. A mismatch returns `BadDeviceToken`, which the
function used to treat as a dead device and delete.
