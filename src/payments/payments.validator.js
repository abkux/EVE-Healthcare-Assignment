import { paymentStatuses } from "../utils/constants.js";
import { asObject, fail } from "../validators/common.js";

function readPaymentStatus(value) {
  if (typeof value !== "string") return null;
  const status = value.trim().toUpperCase();
  if (!paymentStatuses.includes(status)) return null;
  return status;
}

export function validatePayment(body) {
  const input = asObject(body);
  const errors = [];
  let bookingId = null;
  let outcome = "SUCCESS";

  if (typeof input.booking_id !== "number" || !Number.isInteger(input.booking_id) || input.booking_id < 1) {
    errors.push("booking_id must be a positive integer");
  } else {
    bookingId = input.booking_id;
  }

  if (input.outcome !== undefined) {
    const parsed = readPaymentStatus(input.outcome);
    if (!parsed) errors.push("outcome must be SUCCESS or FAILED");
    else outcome = parsed;
  }

  if (errors.length) fail(errors);
  return { booking_id: bookingId, outcome };
}

export function validateWebhook(body) {
  const input = asObject(body);
  const errors = [];
  let eventId = "";
  let bookingId = null;
  let status = null;
  let amount = null;

  if (typeof input.event_id !== "string" || !/^[A-Za-z0-9_-]{6,80}$/.test(input.event_id)) {
    errors.push("event_id must be 6 to 80 letters, numbers, underscores, or hyphens");
  } else {
    eventId = input.event_id;
  }

  if (typeof input.booking_id !== "number" || !Number.isInteger(input.booking_id) || input.booking_id < 1) {
    errors.push("booking_id must be a positive integer");
  } else {
    bookingId = input.booking_id;
  }

  const parsedStatus = readPaymentStatus(input.status);
  if (!parsedStatus) errors.push("status must be SUCCESS or FAILED");
  else status = parsedStatus;

  if (typeof input.amount !== "number" || !Number.isInteger(input.amount) || input.amount < 1) {
    errors.push("amount must be a positive integer");
  } else {
    amount = input.amount;
  }

  if (errors.length) fail(errors);
  return { event_id: eventId, booking_id: bookingId, status, amount };
}
