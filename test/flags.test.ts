import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { migrate } from "../src/migrate.ts";
import { FLAGS } from "../src/config.ts";
import { listFlags, parseValue, readStored, resolve, setFlag, TypeChangeError } from "../src/flags.ts";

test("detects the type from the string", () => {
  const cases: [string, string, unknown][] = [
    ["true", "boolean", true],
    ["false", "boolean", false],
    ["6", "integer", 6],
    ["-3", "integer", -3],
    ["0.15", "number", 0.15],
    ['{"accent":"#2563eb"}', "json", { accent: "#2563eb" }],
    ["[1,2]", "json", [1, 2]],
    ["Free shipping", "string", "Free shipping"],
    ['"2026"', "string", "2026"],
    ['"true"', "string", "true"],
    ["True", "string", "True"],
    ["01", "string", "01"],
    ["", "string", ""],
    ["null", "string", "null"],
    ["12345678901234567890", "number", 12345678901234567890],
  ];
  for (const [raw, type, value] of cases) {
    assert.deepEqual(parseValue(raw), { type, value }, raw);
  }
});

test("a value of the wrong type keeps the default", () => {
  const warnings: string[] = [];
  const stored = new Map([
    ["max_items", "twenty"],
    ["new_checkout", "true"],
    ["discount", "0.15"],
    ["banner_text", "42"],
    ["not_in_code", "true"],
  ]);
  const config = resolve(FLAGS, stored, (message) => warnings.push(message));
  assert.equal(config.max_items, FLAGS.max_items.default);
  assert.equal(config.new_checkout, true);
  assert.equal(config.discount, 0.15);
  assert.equal(config.banner_text, FLAGS.banner_text.default);
  assert.equal("not_in_code" in config, false);
  assert.equal(warnings.length, 2);
});

test("a decimal flag accepts a whole number, an integer flag rejects a decimal", () => {
  const config = resolve(FLAGS, new Map([["discount", "1"], ["max_items", "2.5"]]), () => {});
  assert.equal(config.discount, 1);
  assert.equal(config.max_items, FLAGS.max_items.default);
});

test("migrations, seed and type changes against Postgres", async () => {
  const db = new PGlite(); // in memory
  await migrate(db);
  assert.deepEqual(await migrate(db), [], "second run applies nothing");

  const types = Object.fromEntries((await listFlags(db)).map((row) => [row.key, row.type]));
  assert.deepEqual(types, {
    banner_text: "string",
    discount: "number",
    max_items: "integer",
    new_checkout: "boolean",
    promo_code: "string",
    theme: "json",
  });

  assert.equal(await setFlag(db, "max_items", "10"), "integer");
  assert.equal((await readStored(db)).get("max_items"), "10");
  await assert.rejects(setFlag(db, "max_items", "ten"), TypeChangeError);
  assert.equal(await setFlag(db, "max_items", "ten", { force: true }), "string");

  // With the spec: a decimal flag takes a whole number, an integer flag refuses a decimal.
  assert.equal(await setFlag(db, "discount", "1", { spec: FLAGS.discount }), "integer");
  await assert.rejects(setFlag(db, "new_checkout", "yes", { spec: FLAGS.new_checkout }), TypeChangeError);

  await assert.rejects(db.query("insert into flags (key, value) values ('Bad-Key', '1')"));
  await db.close();
});
