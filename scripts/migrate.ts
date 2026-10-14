import { DATABASE_DIR, openDb } from "../src/db.ts";
import { migrate } from "../src/migrate.ts";

// Stop the server first: only one process can open the database folder.
const db = await openDb();
const applied = await migrate(db);
for (const file of applied) console.log(`applied ${file}`);
console.log(applied.length ? `${applied.length} migration(s) applied in ${DATABASE_DIR}` : "database is up to date");
await db.close();
