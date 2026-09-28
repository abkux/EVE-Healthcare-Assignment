import { HttpError } from "../utils/errors.js";

const bookingSelect = `
  SELECT
    b.id,
    b.user_id,
    b.appointment_at,
    b.amount,
    b.status,
    b.created_at,
    b.updated_at,
    c.id AS centre_id,
    c.name AS centre_name,
    c.location AS centre_location,
    t.id AS test_id,
    t.name AS test_name,
    t.price AS test_price
  FROM bookings b
  JOIN centres c ON c.id = b.centre_id
  JOIN tests t ON t.id = b.test_id
`;

export function shapeBookingRow(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    centre: {
      id: row.centre_id,
      name: row.centre_name,
      location: row.centre_location,
    },
    test: {
      id: row.test_id,
      name: row.test_name,
      price: row.test_price,
    },
    appointment_at: row.appointment_at,
    amount: row.amount,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function shapeBookingById(db, id) {
  const row = db.prepare(`${bookingSelect} WHERE b.id = ?`).get(id);
  return row ? shapeBookingRow(row) : null;
}

export function createBooking(db, user, input) {
  const run = db.transaction(() => {
    const centre = db.prepare("SELECT id FROM centres WHERE id = ?").get(input.centre_id);
    if (!centre) throw new HttpError(404, "Centre not found");

    const testRow = db.prepare("SELECT id, centre_id, price FROM tests WHERE id = ?").get(input.test_id);
    if (!testRow || testRow.centre_id !== input.centre_id) {
      throw new HttpError(400, "Test is not offered at this centre");
    }

    const clash = db.prepare(`
      SELECT id FROM bookings
      WHERE centre_id = ? AND test_id = ? AND appointment_at = ?
        AND status IN ('PENDING', 'CONFIRMED')
    `).get(input.centre_id, input.test_id, input.appointment_at);
    if (clash) throw new HttpError(409, "This slot is already booked");

    const now = new Date().toISOString();
    const info = db.prepare(`
      INSERT INTO bookings (
        user_id, centre_id, test_id, appointment_at, amount, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `).run(user.id, input.centre_id, input.test_id, input.appointment_at, testRow.price, now, now);

    return shapeBookingById(db, Number(info.lastInsertRowid));
  });

  return run.immediate();
}

export function listBookings(db, user, { page, limit, offset, status, userId }) {
  const where = ["1 = 1"];
  const params = [];

  if (user.role !== "admin") {
    where.push("b.user_id = ?");
    params.push(user.id);
  } else if (userId) {
    where.push("b.user_id = ?");
    params.push(userId);
  }

  if (status) {
    where.push("b.status = ?");
    params.push(status);
  }

  const clause = where.join(" AND ");
  const total = db.prepare(`SELECT COUNT(*) AS count FROM bookings b WHERE ${clause}`).get(...params).count;
  const rows = db.prepare(`
    ${bookingSelect}
    WHERE ${clause}
    ORDER BY b.appointment_at ASC, b.id ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return {
    bookings: rows.map(shapeBookingRow),
    page,
    limit,
    total,
  };
}

export function getBooking(db, user, id) {
  const row = db.prepare(`${bookingSelect} WHERE b.id = ?`).get(id);
  if (!row) throw new HttpError(404, "Booking not found");
  if (user.role !== "admin" && row.user_id !== user.id) {
    throw new HttpError(403, "You cannot view this booking");
  }
  return shapeBookingRow(row);
}

export function cancelBooking(db, user, id) {
  const run = db.transaction(() => {
    const row = db.prepare("SELECT id, user_id, status FROM bookings WHERE id = ?").get(id);
    if (!row) throw new HttpError(404, "Booking not found");
    if (user.role !== "admin" && row.user_id !== user.id) {
      throw new HttpError(403, "You cannot cancel this booking");
    }
    if (row.status === "CANCELLED") return shapeBookingById(db, id);
    if (row.status === "CONFIRMED") {
      throw new HttpError(409, "Confirmed bookings cannot be cancelled");
    }
    if (row.status !== "PENDING" && row.status !== "FAILED") {
      throw new HttpError(409, "Booking cannot be cancelled");
    }

    const now = new Date().toISOString();
    db.prepare("UPDATE bookings SET status = 'CANCELLED', updated_at = ? WHERE id = ?").run(now, id);
    return shapeBookingById(db, id);
  });

  return run.immediate();
}
