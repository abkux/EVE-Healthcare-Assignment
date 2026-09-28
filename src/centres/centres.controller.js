import { readId, readPage } from "../validators/common.js";
import { createCentre, createTest, getCentre, listCentres, listTests } from "./centres.service.js";
import { readLocationFilter, validateCentre, validateTest } from "./centres.validator.js";

export function list(req, res) {
  const page = readPage(req.query);
  const location = readLocationFilter(req.query.location);
  const result = listCentres(req.app.locals.db, { ...page, location });
  res.json(result);
}

export function create(req, res) {
  const input = validateCentre(req.body);
  const centre = createCentre(req.app.locals.db, input);
  res.status(201).json({ centre });
}

export function show(req, res) {
  const centreId = readId(req.params.id, "centre id");
  const centre = getCentre(req.app.locals.db, centreId);
  res.json({ centre });
}

export function listCentreTests(req, res) {
  const centreId = readId(req.params.id, "centre id");
  const page = readPage(req.query);
  const result = listTests(req.app.locals.db, centreId, page);
  res.json(result);
}

export function addTest(req, res) {
  const centreId = readId(req.params.id, "centre id");
  const input = validateTest(req.body);
  const test = createTest(req.app.locals.db, centreId, input);
  res.status(201).json({ test });
}
