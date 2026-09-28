import bcrypt from "bcryptjs";
import { getConfig } from "../config/index.js";

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, getConfig().bcryptRounds);
}

export function checkPassword(plain, passwordHash) {
  return bcrypt.compareSync(plain, passwordHash);
}
