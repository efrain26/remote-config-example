# remote-config-example

Remote config con una tabla de dos columnas: `{ key, value }`. El valor **siempre es texto**; la app lo lee como JSON para saber si es booleano, entero, decimal, un objeto JSON o texto normal.

[Read in English](README.md)

```
key            value                                 tipo detectado
new_checkout   false                                 boolean
max_items      6                                     integer
discount       0.15                                  number
banner_text    Free shipping this week               string   (no es JSON válido)
promo_code     "2026"                                string   (con comillas a propósito)
theme          {"accent":"#2563eb","rounded":true}   json
```

## Correrlo

Necesitas **Node.js 22.18 o más nuevo**. Sin Docker: la base es [PGlite](https://pglite.dev), Postgres compilado a WebAssembly, guardado en `.data/`.

```bash
git clone https://github.com/efrain26/remote-config-example.git
cd remote-config-example
npm install
cp .env.example .env      # y cambia ADMIN_TOKEN
npm run db:migrate        # crea la tabla y las banderas de ejemplo
npm test
npm run dev               # http://localhost:3000
```

En otra terminal, cambia una bandera sin reiniciar nada:

```bash
npm run flag -- list
npm run flag -- set new_checkout true
npm run flag -- set max_items 10
npm run flag -- set banner_text "Volvemos el lunes"
npm run flag -- set promo_code '"0042"'   # con comillas: se queda como el texto "0042"
```

Recarga la página: el cambio ya está.

> ¿Usas Claude Code? El repo trae una skill en `.claude/skills/remote-config-local/` que hace la instalación y explica el proyecto. Pídele "configura este repo".

## Cómo se detecta el tipo

`src/flags.ts`, `parseValue()`: el valor pasa por `JSON.parse`.

| Valor en la tabla | Tipo | Lo que recibe la app |
|---|---|---|
| `true`, `false` | boolean | `true`, `false` |
| `6`, `-3` | integer | `6`, `-3` |
| `0.15` | number | `0.15` |
| `{"a":1}`, `[1,2]` | json | el objeto o el arreglo |
| `"2026"` | string | `2026` como texto |
| `hola`, `True`, `01` | string | el mismo texto (no es JSON válido) |

`True` con mayúscula y `01` **no** son booleano ni número: JSON es estricto. Si necesitas el texto `"true"` o `"20"`, escríbelo con comillas.

## Detectar no basta: el código dice qué espera

`src/config.ts` declara cada bandera con su tipo y su valor por defecto:

```ts
export const FLAGS = {
  new_checkout: flag("boolean", false),
  max_items: flag("integer", 3),
  discount: flag("number", 0),
  banner_text: flag("string", ""),
  theme: flag("json", { accent: "#111827", rounded: false }),
};
```

Si alguien guarda `max_items = veinte`, la app se queda con `3` y deja un aviso en el log en vez de romperse. El CLI además rechaza un valor que no cuadra con el tipo declarado (`max_items = 2.5`) si no pasas `--force`.

## Rutas

| Ruta | Qué hace |
|---|---|
| `GET /` | Página armada en el servidor con las banderas, más un recuadro que llena el cliente |
| `GET /api/config` | El JSON con tipos que descarga un cliente |
| `GET /api/flags` | Las filas tal cual, con el tipo detectado (pide `ADMIN_TOKEN`) |
| `PUT /api/flags/:key` | Cuerpo `{"value": "…", "force": false}` (pide `ADMIN_TOKEN`) |
| `DELETE /api/flags/:key` | Borra la fila; la app vuelve al valor por defecto |

## Migraciones

`migrations/*.sql` corren en orden de nombre; `schema_migrations` guarda cuáles ya corrieron. Son SQL de Postgres normal, así que también sirven en Supabase o cualquier Postgres.

```bash
npm run db:migrate   # aplica las pendientes
npm run db:reset     # borra .data/ y empieza de cero
```

Para agregar una, crea `migrations/003_<nombre>.sql`. Nunca edites una que ya corrió: escribe otra.

PGlite solo deja que **un proceso** abra la base: detén `npm run dev` antes de `npm run db:migrate`. Por eso `npm run flag` le habla al servidor y no a la base.

## Licencia

MIT
