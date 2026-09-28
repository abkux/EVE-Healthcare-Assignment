import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { signupUser, startTestApp, uniqueEmail } from "./helpers.js";

let app;

before(async () => {
  app = await startTestApp();
});

after(async () => {
  await app.close();
});

test("health and docs are public", async () => {
  const health = await app.request("/health");
  assert.equal(health.status, 200);
  assert.equal(health.data.ok, true);

  const docs = await app.request("/openapi.json");
  assert.equal(docs.status, 200);
  assert.equal(docs.data.openapi, "3.0.3");
});

test("signup creates a patient and returns a token", async () => {
  const res = await signupUser(app.request, { name: "Asha Rao", email: uniqueEmail("asha") });
  assert.equal(res.status, 201);
  assert.equal(res.data.user.role, "patient");
  assert.equal(res.data.user.name, "Asha Rao");
  assert.ok(res.data.token);
  assert.equal(res.data.user.password_hash, undefined);
});

test("signup rejects a short password and a bad email", async () => {
  const res = await app.request("/auth/signup", {
    method: "POST",
    body: { name: "A", email: "not-an-email", password: "short" },
  });
  assert.equal(res.status, 400);
  assert.ok(Array.isArray(res.data.details));
  assert.ok(res.data.details.length >= 2);
});

test("duplicate email is rejected", async () => {
  const email = uniqueEmail("dup");
  const first = await signupUser(app.request, { email });
  assert.equal(first.status, 201);
  const second = await signupUser(app.request, { email });
  assert.equal(second.status, 409);
});

test("matching ADMIN_EMAIL signs up as admin", async () => {
  const res = await signupUser(app.request, { email: "admin@eve.local", name: "EVE Admin" });
  assert.equal(res.status, 201);
  assert.equal(res.data.user.role, "admin");
});

test("login works and a wrong password does not", async () => {
  const email = uniqueEmail("login");
  await signupUser(app.request, { email, password: "password123" });

  const bad = await app.request("/auth/login", {
    method: "POST",
    body: { email, password: "wrong-password" },
  });
  assert.equal(bad.status, 401);
  assert.equal(bad.data.error, "Invalid email or password");

  const missing = await app.request("/auth/login", {
    method: "POST",
    body: { email: uniqueEmail("missing"), password: "password123" },
  });
  assert.equal(missing.status, 401);
  assert.equal(missing.data.error, bad.data.error);

  const ok = await app.request("/auth/login", {
    method: "POST",
    body: { email, password: "password123" },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.user.email, email);
});

test("me requires a valid bearer token", async () => {
  const anon = await app.request("/auth/me");
  assert.equal(anon.status, 401);

  const junk = await app.request("/auth/me", { token: "not-a-real-token" });
  assert.equal(junk.status, 401);

  const created = await signupUser(app.request);
  const me = await app.request("/auth/me", { token: created.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.data.user.id, created.data.user.id);
});

test("invalid json is rejected", async () => {
  const res = await app.request("/auth/signup", { method: "POST", body: "{" });
  assert.equal(res.status, 400);
  assert.equal(res.data.error, "Invalid JSON");
});
