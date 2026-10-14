---
name: remote-config-local
description: Set up this remote-config-example repo on the local machine (Node version, install, .env, migrations, tests, dev server) and explain how it works (the { key, value } table, how the type is detected from the string, flag specs in code, the flag CLI, adding flags and migrations). Use when the user asks to install, set up, run, configure or understand this repo, add a flag, add a migration, or when something in the local setup fails.
---

# remote-config-example: local setup and how it works

Answer in the user's language. Run the commands yourself; explain each step in one line.

## 1. Set up

Run from the repo root, in order. Stop at the first failure and use "Troubleshooting".

1. **Node**: `node -v` must be **22.18 or newer** (it runs `.ts` files directly, no build step). If it is older, tell the user and suggest `nvm install` (the repo has `.nvmrc`). Do not continue on an older Node.
2. **Dependencies**: `npm install`.
3. **Environment**: if `.env` does not exist, `cp .env.example .env` and replace `ADMIN_TOKEN=change-me` with a random value:
   ```bash
   node -e "console.log(crypto.randomUUID())"
   ```
   Do not print the token back in chat. Never overwrite an existing `.env`.
4. **Database**: `npm run db:migrate`. Expect `applied 001_create_flags.sql` and `applied 002_seed_flags.sql` the first time, `database is up to date` after.
5. **Tests**: `npm test`. All must pass.
6. **Server**: `npm run dev` (run it in the background). Then check:
   ```bash
   curl -s localhost:3000/api/config
   npm run flag -- list
   ```
   `/api/config` returns typed values (`true`, `6`, `0.15`, `"..."`, `{...}`); `flag list` shows each row with its detected type.
7. Tell the user it is ready: open http://localhost:3000 and try `npm run flag -- set new_checkout true`, then reload.

## 2. How it works (explain when asked)

- **Table** (`migrations/001_create_flags.sql`): `flags(key text primary key, value text not null, updated_at)`. The value is always text.
- **Type detection** (`src/flags.ts`, `parseValue`): the value goes through `JSON.parse`.
  - `true`/`false` → boolean · `6` → integer · `0.15` → number · `{...}`/`[...]` → json
  - `"2026"` (with quotes) → string `2026` · anything that is not valid JSON (`hello`, `True`, `01`) → string, as written
- **Specs in code** (`src/config.ts`): `flag("integer", 3)` says what type the app expects and the default. `resolve()` joins rows with specs: a row of another type is ignored (default + one warning). A decimal flag accepts whole numbers; an integer flag rejects decimals. Rows without a spec are not sent to clients.
- **Cache**: rows are cached in memory and cleared on every write through the API. A failed read throws; it is never cached.
- **Server vs client**: `GET /` renders with the flags on the server (what is off never reaches the browser). The box at the bottom is filled in the browser from `/api/config`, starting from defaults.
- **Writes**: only through `PUT`/`DELETE /api/flags/:key` with `Authorization: Bearer $ADMIN_TOKEN`. `npm run flag` wraps them. A value that does not fit the type declared in `src/config.ts` (or, for a flag not declared there, the type of its current row) returns 409 unless `--force`.

## 3. Common tasks

**Add a flag**
1. Add it to `FLAGS` in `src/config.ts` with its type and a safe default.
2. Use it from the config (`config.my_flag`); TypeScript knows its type.
3. Give it a value: `npm run flag -- set my_flag <value>` (server running), or a new migration if every environment must have it.
4. `npm test` and `npm run typecheck`.

**Add a migration**
1. New file `migrations/NNN_<what>.sql` with the next number. Never edit one that already ran.
2. Stop the server (PGlite allows one process), `npm run db:migrate`, start it again.
3. Prefer additive changes (`add column if not exists`, `on conflict do nothing`).

**Start over**: stop the server, `npm run db:reset`.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `SyntaxError` / `ERR_UNKNOWN_FILE_EXTENSION ".ts"` | Node older than 22.18 | Upgrade Node |
| `cannot reach http://localhost:3000/api/flags` | Server not running, or another `PORT` | `npm run dev`; the CLI reads `PORT` from `.env` |
| `missing or wrong ADMIN_TOKEN` (401) | `.env` missing or token changed while the server ran | Check `.env`, restart the server |
| Migrate hangs or the database errors while the server runs | Two processes opened `.data/pgdata` | Stop the server, then migrate |
| `"x" is integer; the new value is string` (409) | Value is not valid JSON for that type (`ten`, `True`, `01`) | Fix the value, or `--force` if the type change is intended |
| Flag changed but the page shows the default | Row type does not match the spec | Check the server log warning; fix the value |
