import { HttpError } from "../utils/errors.js";
import { log } from "../utils/logger.js";

export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const badJson = err.type === "entity.parse.failed" || (err instanceof SyntaxError && err.status === 400);
  if (badJson) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (err instanceof HttpError) {
    const body = { error: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }

  log.error("unhandled error", { message: err.message });
  res.status(500).json({ error: "Something went wrong" });
}
