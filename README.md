# remote-config-example

Remote config with one table and two columns: `{ key, value }`. The value is **always a string**; the app reads it as JSON to know if it is a boolean, an integer, a decimal number, a JSON object or plain text.

[Leer en español](README.es.md)

```
key            value                                 detected type
new_checkout   false                                 boolean
max_items      6                                     integer
discount       0.15                                  number
banner_text    Free shipping this week               string   (not valid JSON)
promo_code     "2026"                                string   (quoted on purpose)
theme          {"accent":"#2563eb","rounded":true}   json
```

## Run it

Needs **Node.js 22.18 or newer**. No Docker: the database is [PGlite](https://pglite.dev), Postgres compiled to WebAssembly, stored in `.data/`.

```bash
git clone https://github.com/efrain26/remote-config-example.git
cd remote-config-example
npm install
cp .env.example .env      # then change ADMIN_TOKEN
npm run db:migrate        # creates the table and the example flags
npm test
npm run dev               # http://localhost:3000
```

In another terminal, change a flag without restarting anything:

```bash
npm run flag -- list
npm run flag -- set new_checkout true
npm run flag -- set max_items 10
npm run flag -- set banner_text "Back on Monday"
npm run flag -- set promo_code '"0042"'   # quoted: stays the text "0042"
```

Reload the page: the change is there.

> Using Claude Code? The repo has a skill in `.claude/skills/remote-config-local/` that does the setup and explains the project. Ask it "set up this repo".

## How the type is detected

`src/flags.ts`, `parseValue()`: the value goes through `JSON.parse`.

| Value in the table | Type | What the app gets |
|---|---|---|
| `true`, `false` | boolean | `true`, `false` |
| `6`, `-3` | integer | `6`, `-3` |
| `0.15` | number | `0.15` |
| `{"a":1}`, `[1,2]` | json | the object or array |
| `"2026"` | string | `2026` as text |
| `hello`, `True`, `01` | string | the same text (not valid JSON) |

`True` with a capital T and `01` are **not** a boolean and a number: JSON is strict. If you need the text `"true"` or `"20"`, write it with quotes.

## Detecting is not enough: the code says what it expects

`src/config.ts` declares every flag with its type and default:

```ts
export const FLAGS = {
  new_checkout: flag("boolean", false),
  max_items: flag("integer", 3),
  discount: flag("number", 0),
  banner_text: flag("string", ""),
  theme: flag("json", { accent: "#111827", rounded: false }),
};
```

If someone saves `max_items = twenty`, the app keeps `3` and logs a warning instead of breaking. The CLI also refuses to change a flag's type unless you pass `--force`.

## Endpoints

| Route | What |
|---|---|
| `GET /` | Page rendered on the server with the flags, plus a box filled on the client |
| `GET /api/config` | The typed JSON a client downloads |
| `GET /api/flags` | Raw rows with the detected type (needs `ADMIN_TOKEN`) |
| `PUT /api/flags/:key` | Body `{"value": "…", "force": false}` (needs `ADMIN_TOKEN`) |
| `DELETE /api/flags/:key` | Deletes the row; the app goes back to the default |

## Migrations

`migrations/*.sql` run in name order; `schema_migrations` records which ones already ran. They are plain Postgres SQL, so they also work in Supabase or any Postgres.

```bash
npm run db:migrate   # applies the pending ones
npm run db:reset     # deletes .data/ and starts over
```

To add a migration, create `migrations/003_<name>.sql`. Never edit one that already ran: write a new one.

PGlite only lets **one process** open the database: stop `npm run dev` before `npm run db:migrate`. That's why `npm run flag` talks to the server instead of the database.

## Project layout

```
migrations/        SQL, in order
src/flags.ts       type detection, specs, cache, reads and writes
src/config.ts      the flags the app uses (type + default)
src/server.ts      HTTP server and endpoints
src/page.html      demo page
scripts/           migrate, reset, flag CLI
test/              node:test
```

## License

MIT
