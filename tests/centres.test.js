import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { signupUser, startTestApp, uniqueEmail } from "./helpers.js";

let app;
let adminToken;
let patientToken;

before(async () => {
  app = await startTestApp();
  const admin = await signupUser(app.request, { email: "admin@eve.local", name: "Admin" });
  adminToken = admin.data.token;
  const patient = await signupUser(app.request);
  patientToken = patient.data.token;
});

after(async () => {
  await app.close();
});

test("patients cannot create centres", async () => {
  const anon = await app.request("/centres", {
    method: "POST",
    body: { name: "Blocked Centre", location: "Pune" },
  });
  assert.equal(anon.status, 401);

  const denied = await app.request("/centres", {
    method: "POST",
    token: patientToken,
    body: { name: "Blocked Centre", location: "Pune" },
  });
  assert.equal(denied.status, 403);
});

test("admin can create a centre and a test, then anyone can read them", async () => {
  const created = await app.request("/centres", {
    method: "POST",
    token: adminToken,
    body: { name: "EVE HSR", location: "Bengaluru" },
  });
  assert.equal(created.status, 201);
  const centreId = created.data.centre.id;

  const badPrice = await app.request(`/centres/${centreId}/tests`, {
    method: "POST",
    token: adminToken,
    body: { name: "CBC", price: 49.5 },
  });
  assert.equal(badPrice.status, 400);

  const denied = await app.request(`/centres/${centreId}/tests`, {
    method: "POST",
    token: patientToken,
    body: { name: "CBC", price: 499 },
  });
  assert.equal(denied.status, 403);

  const testRow = await app.request(`/centres/${centreId}/tests`, {
    method: "POST",
    token: adminToken,
    body: { name: "CBC", price: 499, description: "Blood count" },
  });
  assert.equal(testRow.status, 201);
  assert.equal(testRow.data.test.price, 499);

  const duplicate = await app.request(`/centres/${centreId}/tests`, {
    method: "POST",
    token: adminToken,
    body: { name: "CBC", price: 500 },
  });
  assert.equal(duplicate.status, 409);

  const detail = await app.request(`/centres/${centreId}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.centre.tests.length, 1);
  assert.equal(detail.data.centre.tests[0].name, "CBC");

  const missing = await app.request("/centres/99999");
  assert.equal(missing.status, 404);
});

test("centre list is paginated and can filter by location", async () => {
  const stamp = uniqueEmail("loc").split("@")[0];
  await app.request("/centres", {
    method: "POST",
    token: adminToken,
    body: { name: `${stamp} One`, location: "Mysuru" },
  });
  await app.request("/centres", {
    method: "POST",
    token: adminToken,
    body: { name: `${stamp} Two`, location: "Mysuru" },
  });
  await app.request("/centres", {
    method: "POST",
    token: adminToken,
    body: { name: `${stamp} Three`, location: "Jaipur" },
  });

  const page = await app.request("/centres?location=Mysuru&limit=1&page=2");
  assert.equal(page.status, 200);
  assert.equal(page.data.limit, 1);
  assert.equal(page.data.page, 2);
  assert.equal(page.data.total, 2);
  assert.equal(page.data.centres.length, 1);

  const badLimit = await app.request("/centres?limit=500");
  assert.equal(badLimit.status, 400);
});

test("same centre name is allowed in a different location", async () => {
  const name = `Shared ${uniqueEmail("centre").split("@")[0]}`;
  const first = await app.request("/centres", {
    method: "POST",
    token: adminToken,
    body: { name, location: "Delhi" },
  });
  const second = await app.request("/centres", {
    method: "POST",
    token: adminToken,
    body: { name, location: "Chennai" },
  });
  const third = await app.request("/centres", {
    method: "POST",
    token: adminToken,
    body: { name, location: "Delhi" },
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(third.status, 409);
});
