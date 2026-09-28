import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'admin')),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS centres (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (name, location)
) STRICT;

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY,
  centre_id INTEGER NOT NULL REFERENCES centres(id),
  name TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price > 0),
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (centre_id, name)
) STRICT;

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  centre_id INTEGER NOT NULL REFERENCES centres(id),
  test_id INTEGER NOT NULL REFERENCES tests(id),
  appointment_at TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED', 'CANCELLED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
  event_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  booking_id INTEGER,
  status TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_tests_centre_id ON tests(centre_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(centre_id, test_id, appointment_at);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
`;

export function openDatabase(dbPath) {
  if (dbPath !== ":memory:") {
    const folder = path.dirname(path.resolve(dbPath));
    fs.mkdirSync(folder, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.exec(schema);
  return db;
}
