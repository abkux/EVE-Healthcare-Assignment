import { timingSafeEqual } from "node:crypto";
import { getConfig } from "../config/index.js";
import { HttpError } from "../utils/errors.js";
import { applyPaymentEvent, payForBooking } from "./payments.service.js";
import { validatePayment, validateWebhook } from "./payments.validator.js";

function webhookSecretOk(headerValue) {
  const expected = getConfig().webhookSecret;
  if (!expected) return false;
  const given = Buffer.from(String(headerValue || ""));
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length) return false;
  return timingSafeEqual(given, wanted);
}

export function handleWebhook(req, res) {
  if (!webhookSecretOk(req.headers["x-webhook-secret"])) {
    throw new HttpError(401, "Invalid webhook secret");
  }
  const input = validateWebhook(req.body);
  const result = applyPaymentEvent(req.app.locals.db, {
    eventId: input.event_id,
    bookingId: input.booking_id,
    status: input.status,
    amount: input.amount,
  });

  if (result.httpStatus !== 200) {
    return res.status(result.httpStatus).json(result.body);
  }
  res.status(200).json({ ...result.body, replayed: result.replayed });
}

export function pay(req, res) {
  const input = validatePayment(req.body);
  const result = payForBooking(req.app.locals.db, req.user, input);
  res.status(result.status).json(result.body);
}
