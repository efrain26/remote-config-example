import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";

// PGlite is Postgres compiled to WebAssembly: a real database in a folder, no Docker.
// Only one process can open the folder at a time: the server owns it while it runs.
export const DATABASE_DIR = process.env.DATABASE_DIR ?? ".data/pgdata";

export async function openDb(dir = DATABASE_DIR): Promise<PGlite> {
  await mkdir(dirname(dir), { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return db;
}
