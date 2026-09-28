import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { futureIso, signupUser, startTestApp, uniqueEmail } from "./helpers.js";

let app;
let adminToken;
let slotDay = 20;

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

function paymentCount() {
  return app.db.prepare("SELECT COUNT(*) AS count FROM payments").get().count;
}

function eventCount() {
  return app.db.prepare("SELECT COUNT(*) AS count FROM webhook_events").get().count;
}

async function makeOffering(price = 499) {
  const centreRes = await app.request("/centres", {
    method: "POST",
    token: adminToken,
    body: { name: `Pay Centre ${uniqueEmail("p").split("@")[0]}`, location: "Mumbai" },
  });
  const testRes = await app.request(`/centres/${centreRes.data.centre.id}/tests`, {
    method: "POST",
    token: adminToken,
    body: { name: "Lipid Profile", price, description: "Lipids" },
  });
  return { centre: centreRes.data.centre, test: testRes.data.test };
}

async function book(token, offering, appointmentAt = nextSlot()) {
  return app.request("/bookings", {
    method: "POST",
    token,
    body: {
      centre_id: offering.centre.id,
      test_id: offering.test.id,
      appointment_at: appointmentAt,
    },
  });
}

function webhook(body, secret = "test-webhook-secret") {
  return app.request("/payments/webhook/", {
    method: "POST",
    headers: { "x-webhook-secret": secret },
    body,
  });
}

test("successful payment confirms the booking", async () => {
  const offering = await makeOffering(499);
  const patient = await signupUser(app.request);
  const booked = await book(patient.data.token, offering);
  const beforeCount = paymentCount();

  const paid = await app.request("/payments/", {
    method: "POST",
    token: patient.data.token,
    body: { booking_id: booked.data.booking.id, outcome: "SUCCESS" },
  });
  assert.equal(paid.status, 200);
  assert.equal(paid.data.applied, true);
  assert.equal(paid.data.booking.status, "CONFIRMED");
  assert.equal(paid.data.payment.status, "SUCCESS");
  assert.equal(paid.data.payment.amount, 499);
  assert.equal(paymentCount(), beforeCount + 1);

  const again = await app.request("/payments", {
    method: "POST",
    token: patient.data.token,
    body: { booking_id: booked.data.booking.id },
  });
  assert.equal(again.status, 409);
  assert.equal(paymentCount(), beforeCount + 1);

  const cannotCancel = await app.request(`/bookings/${booked.data.booking.id}/cancel`, {
    method: "POST",
    token: patient.data.token,
  });
  assert.equal(cannotCancel.status, 409);
});

test("failed payment can be retried", async () => {
  const offering = await makeOffering(700);
  const patient = await signupUser(app.request);
  const booked = await book(patient.data.token, offering);
  const beforeCount = paymentCount();

  const failed = await app.request("/payments", {
    method: "POST",
    token: patient.data.token,
    body: { booking_id: booked.data.booking.id, outcome: "FAILED" },
  });
  assert.equal(failed.status, 200);
  assert.equal(failed.data.booking.status, "FAILED");

  const retried = await app.request("/payments", {
    method: "POST",
    token: patient.data.token,
    body: { booking_id: booked.data.booking.id, outcome: "SUCCESS" },
  });
  assert.equal(retried.status, 200);
  assert.equal(retried.data.booking.status, "CONFIRMED");
  assert.equal(paymentCount(), beforeCount + 2);
});

test("a user cannot pay for someone else's booking", async () => {
  const offering = await makeOffering();
  const owner = await signupUser(app.request);
  const other = await signupUser(app.request);
  const booked = await book(owner.data.token, offering);

  const denied = await app.request("/payments", {
    method: "POST",
    token: other.data.token,
    body: { booking_id: booked.data.booking.id },
  });
  assert.equal(denied.status, 403);

  const missing = await app.request("/payments", {
    method: "POST",
    token: owner.data.token,
    body: { booking_id: 99999 },
  });
  assert.equal(missing.status, 404);
});

test("webhook is idempotent and does not downgrade a confirmed booking", async () => {
  const offering = await makeOffering(650);
  const patient = await signupUser(app.request);
  const booked = await book(patient.data.token, offering);
  const bookingId = booked.data.booking.id;
  const beforePayments = paymentCount();
  const beforeEvents = eventCount();

  const first = await webhook({
    event_id: "evt_confirm_once",
    booking_id: bookingId,
    status: "SUCCESS",
    amount: 650,
  });
  assert.equal(first.status, 200);
  assert.equal(first.data.replayed, false);
  assert.equal(first.data.booking.status, "CONFIRMED");
  assert.equal(paymentCount(), beforePayments + 1);

  const replay = await webhook({
    event_id: "evt_confirm_once",
    booking_id: bookingId,
    status: "FAILED",
    amount: 650,
  });
  assert.equal(replay.status, 200);
  assert.equal(replay.data.replayed, true);
  assert.equal(replay.data.booking.status, "CONFIRMED");
  assert.equal(replay.data.payment.id, first.data.payment.id);
  assert.equal(paymentCount(), beforePayments + 1);
  assert.equal(eventCount(), beforeEvents + 1);

  const conflict = await webhook({
    event_id: "evt_late_failure",
    booking_id: bookingId,
    status: "FAILED",
    amount: 650,
  });
  assert.equal(conflict.status, 200);
  assert.equal(conflict.data.applied, false);
  assert.equal(conflict.data.note, "ignored_conflict");
  assert.equal(conflict.data.booking.status, "CONFIRMED");
  assert.equal(paymentCount(), beforePayments + 1);

  const live = await app.request(`/bookings/${bookingId}`, { token: patient.data.token });
  assert.equal(live.data.booking.status, "CONFIRMED");
});

test("webhook rejects a bad secret, a bad amount, and an unknown booking without storing them", async () => {
  const offering = await makeOffering(400);
  const patient = await signupUser(app.request);
  const booked = await book(patient.data.token, offering);
  const eventsBefore = eventCount();
  const paymentsBefore = paymentCount();

  const badSecret = await webhook({
    event_id: "evt_bad_secret",
    booking_id: booked.data.booking.id,
    status: "SUCCESS",
    amount: 400,
  }, "nope");
  assert.equal(badSecret.status, 401);

  const badAmount = await webhook({
    event_id: "evt_bad_amount",
    booking_id: booked.data.booking.id,
    status: "SUCCESS",
    amount: 1,
  });
  assert.equal(badAmount.status, 400);

  const missing = await webhook({
    event_id: "evt_missing_booking",
    booking_id: 99999,
    status: "SUCCESS",
    amount: 400,
  });
  assert.equal(missing.status, 404);
  const missingAgain = await webhook({
    event_id: "evt_missing_booking",
    booking_id: 99999,
    status: "SUCCESS",
    amount: 400,
  });
  assert.equal(missingAgain.status, 404);

  assert.equal(eventCount(), eventsBefore);
  assert.equal(paymentCount(), paymentsBefore);
  const live = await app.request(`/bookings/${booked.data.booking.id}`, { token: patient.data.token });
  assert.equal(live.data.booking.status, "PENDING");
});

test("a cancelled booking cannot be confirmed by a webhook", async () => {
  const offering = await makeOffering(510);
  const patient = await signupUser(app.request);
  const booked = await book(patient.data.token, offering);
  const bookingId = booked.data.booking.id;
  await app.request(`/bookings/${bookingId}/cancel`, { method: "POST", token: patient.data.token });
  const paymentsBefore = paymentCount();

  const update = await webhook({
    event_id: "evt_after_cancel",
    booking_id: bookingId,
    status: "SUCCESS",
    amount: 510,
  });
  assert.equal(update.status, 200);
  assert.equal(update.data.note, "booking_cancelled");
  assert.equal(update.data.applied, false);
  assert.equal(update.data.booking.status, "CANCELLED");
  assert.equal(paymentCount(), paymentsBefore);

  const replay = await webhook({
    event_id: "evt_after_cancel",
    booking_id: bookingId,
    status: "SUCCESS",
    amount: 510,
  });
  assert.equal(replay.data.replayed, true);
  assert.equal(paymentCount(), paymentsBefore);
});

test("a failed booking cannot take a slot that was confirmed by someone else", async () => {
  const offering = await makeOffering(880);
  const slot = nextSlot();
  const first = await signupUser(app.request);
  const second = await signupUser(app.request);
  const firstBooking = await book(first.data.token, offering, slot);

  const failed = await app.request("/payments", {
    method: "POST",
    token: first.data.token,
    body: { booking_id: firstBooking.data.booking.id, outcome: "FAILED" },
  });
  assert.equal(failed.data.booking.status, "FAILED");

  const secondBooking = await book(second.data.token, offering, slot);
  assert.equal(secondBooking.status, 201);
  const confirmed = await app.request("/payments", {
    method: "POST",
    token: second.data.token,
    body: { booking_id: secondBooking.data.booking.id, outcome: "SUCCESS" },
  });
  assert.equal(confirmed.data.booking.status, "CONFIRMED");

  const retry = await app.request("/payments", {
    method: "POST",
    token: first.data.token,
    body: { booking_id: firstBooking.data.booking.id, outcome: "SUCCESS" },
  });
  assert.equal(retry.status, 409);
  assert.equal(retry.data.booking.status, "FAILED");

  const stillHeld = await app.request(`/bookings/${secondBooking.data.booking.id}`, { token: second.data.token });
  assert.equal(stillHeld.data.booking.status, "CONFIRMED");
});
