import { rm } from "node:fs/promises";
import { DATABASE_DIR } from "../src/db.ts";

// Deletes the local database folder. `npm run db:reset` runs the migrations again afterwards.
await rm(DATABASE_DIR, { recursive: true, force: true });
console.log(`deleted ${DATABASE_DIR}`);
