import { HttpError } from "../utils/errors.js";

export function createRateLimit({ windowMs, max }) {
  const hits = new Map();

  return function allow(key, now = Date.now()) {
    const recent = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    return true;
  };
}

const authHits = createRateLimit({ windowMs: 60_000, max: 20 });

export function limitAuth(req, res, next) {
  if (process.env.NODE_ENV === "test") return next();
  const key = req.ip || "unknown";
  if (!authHits(key)) return next(new HttpError(429, "Too many requests"));
  next();
}
