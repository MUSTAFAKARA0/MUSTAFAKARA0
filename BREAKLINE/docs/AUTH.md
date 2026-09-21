# BREAKLINE — Auth (Phase 8 — NOT STARTED)

No authentication exists yet. `MainMenu` has no login UI; the game is fully
playable and saves progress locally without any account (see SAVE_SYSTEM.md).

## Plan for later

- Real auth (Google OAuth + email) is added only when Phase 8 (Backend)
  begins, via Supabase Auth. No Google Cloud Console project or OAuth
  client is needed before then.
- Until Phase 8, if a "logged in" concept is needed for testing UI flows,
  use a fake/local account object — never wire up real Google credentials
  early, and never block gameplay behind a login screen.

## Non-requirement

Do not request or expect: Google OAuth client ID/secret, Supabase project
URL/anon key/service role key, or any other real credential before Phase 8
is explicitly underway.
