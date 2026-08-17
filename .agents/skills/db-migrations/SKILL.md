# DB Migrations

Raptor uses numbered SQL migration files in `backend/migrations/` (e.g. `010_sessions.sql`),
applied on startup by the migration runner in `backend/app/services/migrations.py` (also
runnable standalone via `backend/scripts/run_migrations.py`, e.g. in CI or manually against a
DB). There is no ORM-driven autogeneration — migrations are hand-written SQL.

## Before writing a migration

1. Check the highest existing number in `backend/migrations/`. New migration = next number,
   zero-padded to match the existing width (e.g. `011_*.sql` after `010_*.sql`).
2. Never renumber or edit an already-applied migration. If a past migration shipped broken,
   write a new migration that fixes it forward.
3. Never hand-run SQL against the production database, even "just to check." If you need to
   verify schema state, add a read-only query to a script, run it against a local/staging DB.

## Writing the migration

- Idempotent where possible: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.
- pgvector columns: specify dimension explicitly (`vector(1536)` etc.) — mismatched dimensions
  fail silently in some pgvector versions, not loudly.
- Every migration that adds a table used by an auth/session path needs to be verified against
  the migration runner actually picking it up on startup — this repo has shipped a `relation
  "X" does not exist` production incident from a migration not being applied. Don't assume the
  runner "just works"; check the startup logs path that lists applied migrations.

## After writing

- Run the migration locally against a throwaway DB before merging.
- Confirm `backend/app/services/migrations.py`'s startup runner logs the new migration as
  applied — grep for the migration filename in startup logs, don't just trust that it ran.
