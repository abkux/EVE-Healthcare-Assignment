import { asObject, fail } from "../validators/common.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(body) {
  const input = asObject(body);
  const errors = [];
  let name = "";
  let email = "";
  let password = "";

  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 80) {
    errors.push("name must be between 2 and 80 characters");
  } else {
    name = input.name.trim();
  }

  if (typeof input.email !== "string") {
    errors.push("email is required");
  } else {
    const cleaned = input.email.trim().toLowerCase();
    if (!emailPattern.test(cleaned) || cleaned.length > 120) errors.push("email is not valid");
    else email = cleaned;
  }

  if (typeof input.password !== "string" || input.password.length < 8 || input.password.length > 72) {
    errors.push("password must be between 8 and 72 characters");
  } else {
    password = input.password;
  }

  if (errors.length) fail(errors);
  return { name, email, password };
}

export function validateLogin(body) {
  const input = asObject(body);
  const errors = [];
  let email = "";
  let password = "";

  if (typeof input.email !== "string" || !input.email.trim()) {
    errors.push("email is required");
  } else {
    email = input.email.trim().toLowerCase();
  }

  if (typeof input.password !== "string" || !input.password) {
    errors.push("password is required");
  } else {
    password = input.password;
  }

  if (errors.length) fail(errors);
  return { email, password };
}
