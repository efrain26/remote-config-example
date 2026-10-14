---
name: remote-config-local
description: Teach remote config (what it is, why it helps, how this repo implements it, what the computer needs) and set up this remote-config-example repo on the local machine (Node version, install, .env, migrations, tests, dev server) and explain how it works (the { key, value } table, how the type is detected from the string, flag specs in code, the flag CLI, adding flags and migrations). Use when the user wants to learn what remote config or feature flags are, or asks to install, set up, run, configure or understand this repo, add a flag, add a migration, or when something in the local setup fails.
---

# remote-config-example: local setup and how it works

Answer in the user's language. Assume the user may not be a programmer: run every command yourself, explain each step in one plain sentence, and never ask them to type commands unless something needs their password or permission.

If the repo is not on the machine yet, clone it first (`git clone https://github.com/efrain26/remote-config-example.git`) and work inside that folder.

## 0. Teach remote config (when the user wants to learn)

Go one idea at a time, check they follow, and show each idea working in the running project (set it up first if needed). Plain words, no jargon unless they ask.

1. **What it is**: settings your app reads while it runs, stored outside the code. Changing one changes the app without publishing a new version.
2. **Why it helps**: turn a new feature on or off, fix a text or a number, or switch off something broken in seconds. Show it: `npm run flag -- set new_checkout true`, reload the page.
3. **How it is built here**: one table, each row a `{ key, value }`. The value is always text; the app recognizes yes/no, numbers and text (section 2). Show it: `npm run flag -- list`.
4. **Safety net**: every flag has a type and a default in `src/config.ts`. Show it: `npm run flag -- set max_items twenty` is refused.
5. **What you need**: Node.js 22.18+ on the computer, and a database. Here it is PGlite (Postgres in a folder); in a real app the same SQL migrations run in Supabase or any Postgres.
6. **Next steps**, only if they ask: percentages of users, segments, change history; that is when a hosted feature flag service starts to make sense.


Run from the repo root, in order. Stop at the first failure and use "Troubleshooting".

1. **Node**: `node -v` must be **22.18 or newer** (it runs `.ts` files directly, no build step).
   - Missing or older: tell the user in one sentence why it is needed, then guide the install. If `nvm` exists, `nvm install` (the repo has `.nvmrc`). Otherwise point them to the LTS installer at https://nodejs.org and wait until they confirm. Installers can ask for their password: that part is theirs.
   - Do not continue on an older Node.
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
7. Tell the user it is ready: give them http://localhost:3000 (open it for them if you can), and offer two or three things to try from "Change flags when asked" below.

## 2. How it works (explain when asked)

Start simple: each flag is a name and a value, the value is saved as text, and the app recognizes whether it is a yes/no, a number or text. Go into the details below only if the user asks.

- **Table** (`migrations/001_create_flags.sql`): `flags(key text primary key, value text not null, updated_at)`. The value is always text.
- **Type detection** (`src/flags.ts`, `parseValue`): the value goes through `JSON.parse`.
  - `true`/`false` → boolean · `6` → integer · `0.15` → number · `{...}`/`[...]` → json
  - `"2026"` (with quotes) → string `2026` · anything that is not valid JSON (`hello`, `True`, `01`) → string, as written
- **Specs in code** (`src/config.ts`): `flag("integer", 3)` says what type the app expects and the default. `resolve()` joins rows with specs: a row of another type is ignored (default + one warning). A decimal flag accepts whole numbers; an integer flag rejects decimals. Rows without a spec are not sent to clients.
- **Cache**: rows are cached in memory and cleared on every write through the API. A failed read throws; it is never cached.
- **Server vs client**: `GET /` renders with the flags on the server (what is off never reaches the browser). The box at the bottom is filled in the browser from `/api/config`, starting from defaults.
- **Writes**: only through `PUT`/`DELETE /api/flags/:key` with `Authorization: Bearer $ADMIN_TOKEN`. `npm run flag` wraps them. A value that does not fit the type declared in `src/config.ts` (or, for a flag not declared there, the type of its current row) returns 409 unless `--force`.

## 3. Change flags when asked

Users ask in plain words. Map the request to a flag, run the command with the server running, and tell them to reload the page.

| The user says | Run |
|---|---|
| "Turn on the new checkout" | `npm run flag -- set new_checkout true` |
| "Turn it off" / "something broke" | `npm run flag -- set new_checkout false` |
| "Show 10 products" | `npm run flag -- set max_items 10` |
| "Change the banner to Back on Monday" | `npm run flag -- set banner_text "Back on Monday"` |
| "Remove the banner" | `npm run flag -- set banner_text '""'` (empty text) |
| "What flags are there?" | `npm run flag -- list`, then explain each one in a sentence |

- Text that looks like a number, `true` or JSON must keep its quotes to stay text: `npm run flag -- set promo_code '"0042"'`.
- If the command answers 409 (wrong type), explain it in plain words ("max_items only takes whole numbers") instead of retrying with `--force`. Use `--force` only if the user really wants to change the type, and then update `src/config.ts` too.
- For a flag that does not exist yet, follow "Add a flag" below.

## 4. Common tasks

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
