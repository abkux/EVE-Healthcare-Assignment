import { log } from "../utils/logger.js";

export function requestLogger(req, res, next) {
  if (process.env.NODE_ENV === "test") return next();
  const started = Date.now();
  res.on("finish", () => {
    const pathOnly = req.originalUrl.split("?")[0];
    log.info("request", {
      method: req.method,
      path: pathOnly,
      status: res.statusCode,
      ms: Date.now() - started,
    });
  });
  next();
}
