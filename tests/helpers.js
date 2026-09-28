import { openDatabase } from "../src/db/index.js";
import { createApp } from "../src/app.js";

let emailSeq = 0;

export function uniqueEmail(prefix = "user") {
  emailSeq += 1;
  return `${prefix}${emailSeq}@example.com`;
}

export function futureIso(daysAhead) {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  date.setUTCMinutes(0, 0, 0);
  return date.toISOString();
}

export async function startTestApp() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-jwt-secret";
  process.env.WEBHOOK_SECRET = "test-webhook-secret";
  process.env.ADMIN_EMAIL = "admin@eve.local";
  process.env.BCRYPT_ROUNDS = "4";

  const db = openDatabase(":memory:");
  const app = createApp({ db });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    let body;
    if (options.body !== undefined) {
      headers["content-type"] = headers["content-type"] || "application/json";
      body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    }
    const res = await fetch(baseUrl + path, {
      method: options.method || "GET",
      headers,
      body,
    });
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    return { status: res.status, data };
  }

  async function close() {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    db.close();
  }

  return { request, close, db };
}

export async function signupUser(request, overrides = {}) {
  const res = await request("/auth/signup", {
    method: "POST",
    body: {
      name: overrides.name || "Test User",
      email: overrides.email || uniqueEmail(),
      password: overrides.password || "password123",
    },
  });
  return res;
}
