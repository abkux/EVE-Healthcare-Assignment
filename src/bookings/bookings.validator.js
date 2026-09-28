import { bookingStatuses } from "../utils/constants.js";
import { HttpError } from "../utils/errors.js";
import { asObject, fail, readAppointment } from "../validators/common.js";

export function readStatusFilter(value) {
  if (value === undefined) return null;
  if (!bookingStatuses.includes(value)) {
    throw new HttpError(400, "status must be PENDING, CONFIRMED, FAILED, or CANCELLED");
  }
  return value;
}

export function validateBooking(body) {
  const input = asObject(body);
  const errors = [];
  let centreId = null;
  let testId = null;

  if (typeof input.centre_id !== "number" || !Number.isInteger(input.centre_id) || input.centre_id < 1) {
    errors.push("centre_id must be a positive integer");
  } else {
    centreId = input.centre_id;
  }

  if (typeof input.test_id !== "number" || !Number.isInteger(input.test_id) || input.test_id < 1) {
    errors.push("test_id must be a positive integer");
  } else {
    testId = input.test_id;
  }

  let appointmentAt = null;
  try {
    appointmentAt = readAppointment(input.appointment_at);
  } catch (err) {
    if (err instanceof HttpError) errors.push(err.message);
    else throw err;
  }

  if (errors.length) fail(errors);
  return { centre_id: centreId, test_id: testId, appointment_at: appointmentAt };
}
