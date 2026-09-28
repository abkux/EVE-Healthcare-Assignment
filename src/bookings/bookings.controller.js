import { readId, readPage } from "../validators/common.js";
import { cancelBooking, createBooking, getBooking, listBookings } from "./bookings.service.js";
import { readStatusFilter, validateBooking } from "./bookings.validator.js";

export function create(req, res) {
  const input = validateBooking(req.body);
  const booking = createBooking(req.app.locals.db, req.user, input);
  res.status(201).json({ booking });
}

export function list(req, res) {
  const page = readPage(req.query);
  const status = readStatusFilter(req.query.status);
  const userId = req.user.role === "admin" && req.query.user_id !== undefined
    ? readId(req.query.user_id, "user_id")
    : null;
  const result = listBookings(req.app.locals.db, req.user, { ...page, status, userId });
  res.json(result);
}

export function show(req, res) {
  const booking = getBooking(req.app.locals.db, req.user, readId(req.params.id, "booking id"));
  res.json({ booking });
}

export function cancel(req, res) {
  const booking = cancelBooking(req.app.locals.db, req.user, readId(req.params.id, "booking id"));
  res.json({ booking });
}
