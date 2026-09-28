import jwt from "jsonwebtoken";
import { getConfig } from "../config/index.js";

export function signToken(user) {
  return jwt.sign({ sub: String(user.id) }, getConfig().jwtSecret, {
    expiresIn: "7d",
    algorithm: "HS256",
  });
}

export function readToken(token) {
  return jwt.verify(token, getConfig().jwtSecret, { algorithms: ["HS256"] });
}
