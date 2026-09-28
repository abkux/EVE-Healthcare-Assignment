import { getUserById } from "../auth/auth.service.js";
import { HttpError } from "../utils/errors.js";
import { readToken } from "../utils/tokens.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const space = header.indexOf(" ");
  const scheme = space === -1 ? "" : header.slice(0, space);
  const token = space === -1 ? "" : header.slice(space + 1).trim();

  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "Missing or invalid token"));
  }

  try {
    const payload = readToken(token);
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      return next(new HttpError(401, "Missing or invalid token"));
    }
    const user = getUserById(req.app.locals.db, userId);
    if (!user) return next(new HttpError(401, "Missing or invalid token"));
    req.user = user;
    next();
  } catch {
    next(new HttpError(401, "Missing or invalid token"));
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return next(new HttpError(403, "Admin access required"));
  }
  next();
}
