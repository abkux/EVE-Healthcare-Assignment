import { getConfig } from "../config/index.js";
import { HttpError } from "../utils/errors.js";
import { checkPassword, hashPassword } from "../utils/passwords.js";
import { signToken } from "../utils/tokens.js";

export function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
  };
}

export function getUserById(db, id) {
  const row = db.prepare(`
    SELECT id, name, email, role, created_at
    FROM users
    WHERE id = ?
  `).get(id);
  return row ? publicUser(row) : null;
}

export function signup(db, input) {
  const config = getConfig();
  const role = config.adminEmail && input.email === config.adminEmail ? "admin" : "patient";
  const now = new Date().toISOString();

  try {
    const info = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(input.name, input.email, hashPassword(input.password), role, now);

    const user = publicUser({
      id: Number(info.lastInsertRowid),
      name: input.name,
      email: input.email,
      role,
      created_at: now,
    });
    return { user, token: signToken(user) };
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      throw new HttpError(409, "Email already registered");
    }
    throw err;
  }
}

export function login(db, input) {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(input.email);
  if (!row || !checkPassword(input.password, row.password_hash)) {
    throw new HttpError(401, "Invalid email or password");
  }
  const user = publicUser(row);
  return { user, token: signToken(user) };
}
