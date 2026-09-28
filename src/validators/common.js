import { HttpError } from "../utils/errors.js";

export function asObject(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "Invalid request body");
  }
  return body;
}

export function fail(errors) {
  throw new HttpError(400, "Invalid request", errors);
}

export function readId(value, field = "id") {
  const raw = String(value ?? "");
  if (!/^\d{1,15}$/.test(raw) || Number(raw) < 1) {
    throw new HttpError(400, `${field} must be a positive integer`);
  }
  return Number(raw);
}

export function readPage(query) {
  const rawPage = query.page === undefined ? "1" : String(query.page);
  const rawLimit = query.limit === undefined ? "10" : String(query.limit);
  if (!/^\d{1,5}$/.test(rawPage) || !/^\d{1,5}$/.test(rawLimit)) {
    throw new HttpError(400, "page and limit must be positive integers");
  }
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (page < 1 || page > 10000) throw new HttpError(400, "page is out of range");
  if (limit < 1 || limit > 50) throw new HttpError(400, "limit must be between 1 and 50");
  return { page, limit, offset: (page - 1) * limit };
}

export function readAppointment(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "appointment_at is required");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "appointment_at must be a valid date");
  }
  const now = Date.now();
  if (date.getTime() <= now) {
    throw new HttpError(400, "appointment_at must be in the future");
  }
  const maxAhead = now + 180 * 24 * 60 * 60 * 1000;
  if (date.getTime() > maxAhead) {
    throw new HttpError(400, "appointment_at must be within 180 days");
  }
  return date.toISOString();
}
