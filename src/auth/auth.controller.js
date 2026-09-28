import { login, signup } from "./auth.service.js";
import { validateLogin, validateSignup } from "./auth.validator.js";

export function signupUser(req, res) {
  const input = validateSignup(req.body);
  const result = signup(req.app.locals.db, input);
  res.status(201).json(result);
}

export function loginUser(req, res) {
  const input = validateLogin(req.body);
  const result = login(req.app.locals.db, input);
  res.json(result);
}

export function currentUser(req, res) {
  res.json({ user: req.user });
}
