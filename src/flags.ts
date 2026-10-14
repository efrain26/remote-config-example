import type { PGlite } from "@electric-sql/pglite";

export type FlagType = "boolean" | "integer" | "number" | "string" | "json";
export type Json = { [key: string]: unknown } | unknown[];
export type FlagValue = boolean | number | string | Json;

export interface FlagRow {
  key: string;
  value: string;
  updated_at: Date;
}

// The only rule: `value` is read as JSON.
//   "true" / "false"   -> boolean
//   "6"                -> integer
//   "0.15"             -> number
//   "{...}" / "[...]"  -> json
//   "\"2026\""         -> string (quoted on purpose: stays text)
//   anything that is not valid JSON ("Free shipping", "True", "01") -> string, as written
// "null" stays the text "null": a flag that should not exist is deleted, not set to null.
export function parseValue(raw: string): { type: FlagType; value: FlagValue } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { type: "string", value: raw };
  }
  if (typeof parsed === "boolean") return { type: "boolean", value: parsed };
  if (typeof parsed === "number") {
    return { type: Number.isSafeInteger(parsed) ? "integer" : "number", value: parsed };
  }
  if (typeof parsed === "string") return { type: "string", value: parsed };
  if (parsed !== null && typeof parsed === "object") return { type: "json", value: parsed as Json };
  return { type: "string", value: raw };
}

// What each type looks like once parsed.
export interface TypeMap {
  boolean: boolean;
  integer: number;
  number: number;
  string: string;
  json: Json;
}

export interface FlagSpec<T extends FlagType = FlagType, V = TypeMap[T]> {
  type: T;
  default: V;
}

// Declares a flag in code: the type the app expects and the value it uses without a valid row.
export function flag<T extends FlagType, V extends TypeMap[T]>(type: T, fallback: V): FlagSpec<T, V> {
  return { type, default: fallback };
}

// json keeps the shape of its default ({ accent: string, ... }); the rest widen (false -> boolean).
export type ConfigOf<S extends Record<string, FlagSpec>> = {
  [K in keyof S]: S[K] extends FlagSpec<"json", infer V> ? V : TypeMap[S[K]["type"]];
};

// A decimal flag also accepts a whole number ("1" is a fine discount); an integer flag rejects 0.5.
function fits(expected: FlagType, actual: FlagType): boolean {
  return expected === actual || (expected === "number" && actual === "integer");
}

const warned = new Set<string>();
const warnOnce = (message: string) => {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
};

// Joins the rows with the specs. A row of another type ("twenty" where an integer goes)
// is ignored: the app keeps the default and warns. Rows without a spec are not sent.
export function resolve<S extends Record<string, FlagSpec>>(
  specs: S,
  stored: Map<string, string>,
  warn: (message: string) => void = warnOnce,
): ConfigOf<S> {
  const config: Record<string, unknown> = {};
  for (const [key, spec] of Object.entries(specs)) {
    config[key] = spec.default;
    const raw = stored.get(key);
    if (raw === undefined) continue;
    const { type, value } = parseValue(raw);
    if (fits(spec.type, type)) config[key] = value;
    else warn(`flag "${key}": expected ${spec.type}, got ${type} (${raw}). Using the default.`);
  }
  return config as ConfigOf<S>;
}

// Cache in memory until a flag changes (setFlag/deleteFlag clear it).
// A failed read throws and is not cached: better a visible error than the defaults for hours.
let cache: Map<string, string> | null = null;

export async function readStored(db: PGlite): Promise<Map<string, string>> {
  if (cache) return cache;
  const { rows } = await db.query<{ key: string; value: string }>("select key, value from flags");
  cache = new Map(rows.map((row) => [row.key, row.value]));
  return cache;
}

export function clearCache(): void {
  cache = null;
}

export async function listFlags(db: PGlite): Promise<(FlagRow & { type: FlagType })[]> {
  const { rows } = await db.query<FlagRow>("select key, value, updated_at from flags order by key");
  return rows.map((row) => ({ ...row, type: parseValue(row.value).type }));
}

export class TypeChangeError extends Error {}

// Changing a flag's type is almost always a mistake ("20" -> "twenty"), so it needs `force`.
// The expected type is the spec's (from src/config.ts); without a spec, the current row's.
export async function setFlag(
  db: PGlite,
  key: string,
  value: string,
  { spec, force = false }: { spec?: FlagSpec; force?: boolean } = {},
): Promise<FlagType> {
  const type = parseValue(value).type;
  let expected = spec?.type;
  if (!expected) {
    const current = await db.query<{ value: string }>("select value from flags where key = $1", [key]);
    expected = current.rows[0] ? parseValue(current.rows[0].value).type : undefined;
  }
  if (expected && !fits(expected, type) && !force) {
    throw new TypeChangeError(`"${key}" is ${expected}; the new value is ${type}. Use --force to change the type.`);
  }
  await db.query(
    `insert into flags (key, value) values ($1, $2)
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, value],
  );
  clearCache();
  return type;
}

export async function deleteFlag(db: PGlite, key: string): Promise<boolean> {
  const { affectedRows } = await db.query("delete from flags where key = $1", [key]);
  clearCache();
  return (affectedRows ?? 0) > 0;
}
