import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../src/db/index.js";

test("seed can be run twice without duplicating centres", async () => {
  process.env.ADMIN_EMAIL = "seed-admin@eve.local";
  process.env.ADMIN_PASSWORD = "seed-password";
  process.env.ADMIN_NAME = "Seed Admin";
  process.env.BCRYPT_ROUNDS = "4";

  const { seedDatabase } = await import("../src/db/seed.js");
  const db = openDatabase(":memory:");
  const first = seedDatabase(db);
  const second = seedDatabase(db);

  const centres = db.prepare("SELECT COUNT(*) AS count FROM centres").get().count;
  const tests = db.prepare("SELECT COUNT(*) AS count FROM tests").get().count;
  const admins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count;

  assert.equal(centres, 2);
  assert.equal(tests, 6);
  assert.equal(admins, 1);
  assert.equal(first.centres.length, 2);
  assert.match(second.admin, /already present/);
  db.close();
});
