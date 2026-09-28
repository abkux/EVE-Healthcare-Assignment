import { readFileSync } from "node:fs";
import express from "express";
import authRoutes from "./auth/auth.routes.js";
import bookingRoutes from "./bookings/bookings.routes.js";
import centreRoutes from "./centres/centres.routes.js";
import { getConfig } from "./config/index.js";
import { openDatabase } from "./db/index.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import paymentRoutes from "./payments/payments.routes.js";

const openapi = readFileSync(new URL("../openapi.json", import.meta.url), "utf8");

function trimTrailingSlash(req, res, next) {
  if (req.path.length > 1 && req.path.endsWith("/")) {
    const queryAt = req.url.indexOf("?");
    const query = queryAt === -1 ? "" : req.url.slice(queryAt);
    req.url = req.path.slice(0, -1) + query;
  }
  next();
}

export function createApp({ db } = {}) {
  const database = db || openDatabase(getConfig().databasePath);
  const app = express();
  app.disable("x-powered-by");
  app.locals.db = database;

  app.use(trimTrailingSlash);
  app.use(express.json({ limit: "100kb" }));
  app.use(requestLogger);

  app.get("/", (req, res) => {
    res.json({
      service: "eve-healthcare-bookings",
      health: "/health",
      docs: "/openapi.json",
    });
  });

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  app.get("/openapi.json", (req, res) => {
    res.type("application/json").send(openapi);
  });

  app.use("/auth", authRoutes);
  app.use("/centres", centreRoutes);
  app.use("/bookings", bookingRoutes);
  app.use("/payments", paymentRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
