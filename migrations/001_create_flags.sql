-- One row per flag: { key, value }. `value` is always text; the app detects the type
-- by reading it as JSON (src/flags.ts). Plain Postgres: works in Supabase or any Postgres.
create table flags (
  key text primary key
    check (key ~ '^[a-z][a-z0-9_]{0,62}$'),
  value text not null
    check (char_length(value) <= 10000),
  updated_at timestamptz not null default now()
);
