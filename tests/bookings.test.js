import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { futureIso, signupUser, startTestApp, uniqueEmail } from "./helpers.js";

let app;
let adminToken;
let slotDay = 3;

before(async () => {
  app = await startTestApp();
  const admin = await signupUser(app.request, { email: "admin@eve.local", name: "Admin" });
  adminToken = admin.data.token;
});

after(async () => {
  await app.close();
});

function nextSlot() {
  slotDay += 1;
  return futureIso(slotDay);
}

async function makeOffering(price = 499) {
  const name = `Centre ${uniqueEmail("c").split("@")[0]}`;
  const centreRes = await app.request("/centres", {
    method: "POST",
    token: adminToken,
    body: { name, location: "Bengaluru" },
  });
  assert.equal(centreRes.status, 201);
  const testRes = await app.request(`/centres/${centreRes.data.centre.id}/tests`, {
    method: "POST",
    token: adminToken,
    body: { name: "CBC", price, description: "Blood count" },
  });
  assert.equal(testRes.status, 201);
  return { centre: centreRes.data.centre, test: testRes.data.test };
}

test("booking requires auth and copies the test price", async () => {
  const offering = await makeOffering(899);
  const patient = await signupUser(app.request);
  const anon = await app.request("/bookings", {
    method: "POST",
    body: {
      centre_id: offering.centre.id,
      test_id: offering.test.id,
      appointment_at: nextSlot(),
    },
  });
  assert.equal(anon.status, 401);

  const booked = await app.request("/bookings", {
    method: "POST",
    token: patient.data.token,
    body: {
      centre_id: offering.centre.id,
      test_id: offering.test.id,
      appointment_at: nextSlot(),
      amount: 1,
      status: "CONFIRMED",
    },
  });
  assert.equal(booked.status, 201);
  assert.equal(booked.data.booking.amount, 899);
  assert.equal(booked.data.booking.status, "PENDING");
  assert.equal(booked.data.booking.user_id, patient.data.user.id);
});

test("rejects a past slot and a test from another centre", async () => {
  const offering = await makeOffering();
  const other = await makeOffering();
  const patient = await signupUser(app.request);

  const past = await app.request("/bookings", {
    method: "POST",
    token: patient.data.token,
    body: {
      centre_id: offering.centre.id,
      test_id: offering.test.id,
      appointment_at: "2020-01-01T00:00:00.000Z",
    },
  });
  assert.equal(past.status, 400);

  const mismatch = await app.request("/bookings", {
    method: "POST",
    token: patient.data.token,
    body: {
      centre_id: other.centre.id,
      test_id: offering.test.id,
      appointment_at: nextSlot(),
    },
  });
  assert.equal(mismatch.status, 400);
  assert.equal(mismatch.data.error, "Test is not offered at this centre");
});

test("a slot can only be held by one active booking", async () => {
  const offering = await makeOffering();
  const slot = nextSlot();
  const first = await signupUser(app.request);
  const second = await signupUser(app.request);

  const ok = await app.request("/bookings", {
    method: "POST",
    token: first.data.token,
    body: { centre_id: offering.centre.id, test_id: offering.test.id, appointment_at: slot },
  });
  assert.equal(ok.status, 201);

  const clash = await app.request("/bookings", {
    method: "POST",
    token: second.data.token,
    body: { centre_id: offering.centre.id, test_id: offering.test.id, appointment_at: slot },
  });
  assert.equal(clash.status, 409);
});

test("users can only see and cancel their own bookings", async () => {
  const offering = await makeOffering();
  const owner = await signupUser(app.request);
  const other = await signupUser(app.request);
  const booked = await app.request("/bookings", {
    method: "POST",
    token: owner.data.token,
    body: {
      centre_id: offering.centre.id,
      test_id: offering.test.id,
      appointment_at: nextSlot(),
    },
  });
  const bookingId = booked.data.booking.id;

  const hidden = await app.request(`/bookings/${bookingId}`, { token: other.data.token });
  assert.equal(hidden.status, 403);

  const blockedCancel = await app.request(`/bookings/${bookingId}/cancel`, {
    method: "POST",
    token: other.data.token,
  });
  assert.equal(blockedCancel.status, 403);

  const ownList = await app.request("/bookings", { token: other.data.token });
  assert.equal(ownList.data.bookings.some((row) => row.id === bookingId), false);

  const ownerList = await app.request("/bookings", { token: owner.data.token });
  assert.equal(ownerList.data.bookings.some((row) => row.id === bookingId), true);

  const cancelled = await app.request(`/bookings/${bookingId}/cancel`, {
    method: "POST",
    token: owner.data.token,
  });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.booking.status, "CANCELLED");

  const again = await app.request(`/bookings/${bookingId}/cancel`, {
    method: "POST",
    token: owner.data.token,
  });
  assert.equal(again.status, 200);
  assert.equal(again.data.booking.status, "CANCELLED");

  const missing = await app.request("/bookings/99999", { token: owner.data.token });
  assert.equal(missing.status, 404);
});

test("admin can list every booking", async () => {
  const offering = await makeOffering();
  const patient = await signupUser(app.request);
  await app.request("/bookings", {
    method: "POST",
    token: patient.data.token,
    body: {
      centre_id: offering.centre.id,
      test_id: offering.test.id,
      appointment_at: nextSlot(),
    },
  });

  const all = await app.request("/bookings?limit=50", { token: adminToken });
  assert.equal(all.status, 200);
  assert.ok(all.data.total >= 1);

  const filtered = await app.request(`/bookings?user_id=${patient.data.user.id}`, { token: adminToken });
  assert.equal(filtered.status, 200);
  assert.ok(filtered.data.bookings.every((row) => row.user_id === patient.data.user.id));
});
