import { HttpError } from "../utils/errors.js";

function shapeCentre(row, tests) {
  const centre = {
    id: row.id,
    name: row.name,
    location: row.location,
    created_at: row.created_at,
  };
  if (row.test_count !== undefined) centre.test_count = row.test_count;
  if (tests) centre.tests = tests;
  return centre;
}

function shapeTest(row) {
  return {
    id: row.id,
    centre_id: row.centre_id,
    name: row.name,
    price: row.price,
    description: row.description,
    created_at: row.created_at,
  };
}

export function createCentre(db, input) {
  const now = new Date().toISOString();
  try {
    const info = db.prepare(`
      INSERT INTO centres (name, location, created_at)
      VALUES (?, ?, ?)
    `).run(input.name, input.location, now);
    return shapeCentre({
      id: Number(info.lastInsertRowid),
      name: input.name,
      location: input.location,
      created_at: now,
    });
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new HttpError(409, "A centre with this name and location already exists");
    }
    throw err;
  }
}

export function listCentres(db, { limit, offset, page, location }) {
  const where = [];
  const params = [];
  if (location) {
    where.push("lower(c.location) LIKE ?");
    params.push(`%${location.toLowerCase().replace(/[%_]/g, "")}%`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) AS count FROM centres c ${clause}`).get(...params).count;
  const rows = db.prepare(`
    SELECT c.id, c.name, c.location, c.created_at,
      (SELECT COUNT(*) FROM tests t WHERE t.centre_id = c.id) AS test_count
    FROM centres c
    ${clause}
    ORDER BY c.name ASC, c.id ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  return {
    centres: rows.map((row) => shapeCentre(row)),
    page,
    limit,
    total,
  };
}

export function getCentre(db, id) {
  const row = db.prepare("SELECT id, name, location, created_at FROM centres WHERE id = ?").get(id);
  if (!row) throw new HttpError(404, "Centre not found");
  const tests = db.prepare(`
    SELECT id, centre_id, name, price, description, created_at
    FROM tests
    WHERE centre_id = ?
    ORDER BY name ASC
  `).all(id).map(shapeTest);
  return shapeCentre(row, tests);
}

export function listTests(db, centreId, { limit, offset, page }) {
  const centre = db.prepare("SELECT id FROM centres WHERE id = ?").get(centreId);
  if (!centre) throw new HttpError(404, "Centre not found");
  const total = db.prepare("SELECT COUNT(*) AS count FROM tests WHERE centre_id = ?").get(centreId).count;
  const tests = db.prepare(`
    SELECT id, centre_id, name, price, description, created_at
    FROM tests
    WHERE centre_id = ?
    ORDER BY name ASC, id ASC
    LIMIT ? OFFSET ?
  `).all(centreId, limit, offset).map(shapeTest);
  return { tests, page, limit, total };
}

export function createTest(db, centreId, input) {
  const centre = db.prepare("SELECT id FROM centres WHERE id = ?").get(centreId);
  if (!centre) throw new HttpError(404, "Centre not found");
  const now = new Date().toISOString();
  try {
    const info = db.prepare(`
      INSERT INTO tests (centre_id, name, price, description, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(centreId, input.name, input.price, input.description, now);
    return shapeTest({
      id: Number(info.lastInsertRowid),
      centre_id: centreId,
      name: input.name,
      price: input.price,
      description: input.description,
      created_at: now,
    });
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new HttpError(409, "This centre already offers a test with that name");
    }
    throw err;
  }
}
