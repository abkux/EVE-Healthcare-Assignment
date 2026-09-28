import { randomUUID } from "node:crypto";
import { shapeBookingById } from "../bookings/bookings.service.js";
import { HttpError } from "../utils/errors.js";

export function applyPaymentEvent(db, input) {
  const run = db.transaction(() => {
    const seen = db.prepare("SELECT result_json FROM webhook_events WHERE event_id = ?").get(input.eventId);
    if (seen) {
      return {
        replayed: true,
        httpStatus: 200,
        body: JSON.parse(seen.result_json),
      };
    }

    const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(input.bookingId);
    if (!booking) {
      return {
        replayed: false,
        httpStatus: 404,
        body: { error: "Booking not found" },
      };
    }

    if (input.amount !== booking.amount) {
      return {
        replayed: false,
        httpStatus: 400,
        body: { error: "Amount does not match the booking" },
      };
    }

    const now = new Date().toISOString();
    let applied = false;
    let note = "ignored";
    let nextStatus = booking.status;
    let paymentStatus = input.status;

    if (booking.status === "CANCELLED") {
      note = "booking_cancelled";
    } else if (booking.status === "CONFIRMED" && input.status === "SUCCESS") {
      note = "already_confirmed";
    } else if (booking.status === "CONFIRMED" && input.status === "FAILED") {
      note = "ignored_conflict";
    } else if (booking.status === "FAILED" && input.status === "FAILED") {
      note = "already_failed";
    } else if ((booking.status === "PENDING" || booking.status === "FAILED") && input.status === "SUCCESS") {
      const clash = db.prepare(`
        SELECT id FROM bookings
        WHERE centre_id = ? AND test_id = ? AND appointment_at = ?
          AND status = 'CONFIRMED' AND id != ?
      `).get(booking.centre_id, booking.test_id, booking.appointment_at, booking.id);

      if (clash) {
        nextStatus = "FAILED";
        note = "slot_unavailable";
        paymentStatus = "FAILED";
        applied = true;
      } else {
        nextStatus = "CONFIRMED";
        note = "applied";
        paymentStatus = "SUCCESS";
        applied = true;
      }
    } else if (booking.status === "PENDING" && input.status === "FAILED") {
      nextStatus = "FAILED";
      note = "applied";
      paymentStatus = "FAILED";
      applied = true;
    }

    let payment = null;
    if (applied) {
      db.prepare("UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?").run(nextStatus, now, booking.id);
      const info = db.prepare(`
        INSERT INTO payments (booking_id, amount, status, event_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(booking.id, booking.amount, paymentStatus, input.eventId, now);
      payment = {
        id: Number(info.lastInsertRowid),
        booking_id: booking.id,
        amount: booking.amount,
        status: paymentStatus,
        event_id: input.eventId,
        created_at: now,
      };
    }

    const body = {
      event_id: input.eventId,
      applied,
      note,
      payment,
      booking: shapeBookingById(db, booking.id),
    };

    db.prepare(`
      INSERT INTO webhook_events (event_id, booking_id, status, result_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.eventId, booking.id, input.status, JSON.stringify(body), now);

    return { replayed: false, httpStatus: 200, body };
  });

  return run.immediate();
}

export function payForBooking(db, user, input) {
  const booking = db.prepare("SELECT id, user_id, amount FROM bookings WHERE id = ?").get(input.booking_id);
  if (!booking) throw new HttpError(404, "Booking not found");
  if (booking.user_id !== user.id) {
    throw new HttpError(403, "You cannot pay for this booking");
  }

  const result = applyPaymentEvent(db, {
    eventId: randomUUID(),
    bookingId: booking.id,
    status: input.outcome,
    amount: booking.amount,
  });

  const note = result.body && result.body.note;
  if (note === "booking_cancelled") {
    throw new HttpError(409, "Booking is cancelled");
  }
  if (note === "already_confirmed" || note === "ignored_conflict") {
    throw new HttpError(409, "Booking is already confirmed");
  }
  if (note === "slot_unavailable") {
    return {
      status: 409,
      body: {
        error: "This slot is no longer available",
        booking: result.body.booking,
      },
    };
  }
  if (result.httpStatus >= 400) {
    throw new HttpError(result.httpStatus, result.body.error || "Payment could not be processed");
  }
  return { status: 200, body: result.body };
}
