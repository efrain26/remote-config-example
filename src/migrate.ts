import { readdir, readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";

const MIGRATIONS_DIR = new URL("../migrations/", import.meta.url);

// Runs every .sql file in migrations/ that has not run yet, in name order.
// Each file runs in a transaction together with its row in schema_migrations:
// if it fails, nothing from that file stays applied.
export async function migrate(db: PGlite): Promise<string[]> {
  await db.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  const { rows } = await db.query<{ name: string }>("select name from schema_migrations");
  const applied = new Set(rows.map((row) => row.name));
  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  const pending = files.filter((file) => !applied.has(file));

  for (const file of pending) {
    const sql = await readFile(new URL(file, MIGRATIONS_DIR), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
    });
  }
  return pending;
}
