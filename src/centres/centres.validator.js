import { asObject, fail } from "../validators/common.js";
import { HttpError } from "../utils/errors.js";

export function readLocationFilter(value) {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > 80) {
    throw new HttpError(400, "location must be between 2 and 80 characters");
  }
  return value.trim();
}

export function validateCentre(body) {
  const input = asObject(body);
  const errors = [];
  let name = "";
  let location = "";

  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 120) {
    errors.push("name must be between 2 and 120 characters");
  } else {
    name = input.name.trim();
  }

  if (typeof input.location !== "string" || input.location.trim().length < 2 || input.location.trim().length > 120) {
    errors.push("location must be between 2 and 120 characters");
  } else {
    location = input.location.trim();
  }

  if (errors.length) fail(errors);
  return { name, location };
}

export function validateTest(body) {
  const input = asObject(body);
  const errors = [];
  let name = "";
  let price = 0;
  let description = "";

  if (typeof input.name !== "string" || input.name.trim().length < 2 || input.name.trim().length > 120) {
    errors.push("name must be between 2 and 120 characters");
  } else {
    name = input.name.trim();
  }

  if (typeof input.price !== "number" || !Number.isInteger(input.price) || input.price < 1 || input.price > 1000000) {
    errors.push("price must be a whole number of INR between 1 and 1000000");
  } else {
    price = input.price;
  }

  if (input.description !== undefined && input.description !== null) {
    if (typeof input.description !== "string" || input.description.trim().length > 500) {
      errors.push("description must be 500 characters or less");
    } else {
      description = input.description.trim();
    }
  }

  if (errors.length) fail(errors);
  return { name, price, description };
}
