# EVE Healthcare bookings

Small Node.js API for diagnostic test bookings and a simulated payment flow. Built for the SDE Intern assignment. SQLite is used because this is an MVP, not because Postgres would be the wrong choice later.

I can make this in FastAPI or Java Sprint Boot ( yeah learning this ) - I have used SQLite for MVP. Incase of real production would use PostgreSQL or MongoDB depends on requirments.

Zod or similar library can be use for validations.


## Stack

- Node.js 20 or newer, ES modules
- Express
- better-sqlite3
- JWT auth with bcrypt password hashes

## Run locally

```bash
npm install
copy .env.example .env
npm run seed
npm start
```

On macOS or Linux, use `cp .env.example .env` instead of `copy`.

The API listens on `http://localhost:3000`. `npm run dev` restarts on file changes. `npm test` runs the suite.

On Windows PowerShell, `curl` is often an alias. Use `curl.exe` in the examples below.

If you skip the `.env` file, the server still starts with local defaults. Seed will not create an admin unless `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set.

OpenAPI spec: `GET /openapi.json`

## Auth

Signup always creates a patient, unless the email matches `ADMIN_EMAIL`. That is how the first admin is created. Seed also inserts that admin, plus two sample centres.

```bash
curl.exe -X POST http://localhost:3000/auth/signup ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"Asha Rao\",\"email\":\"asha@example.com\",\"password\":\"password123\"}"
```

```bash
curl.exe -X POST http://localhost:3000/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"asha@example.com\",\"password\":\"password123\"}"
```

```bash
curl.exe http://localhost:3000/auth/me -H "Authorization: Bearer TOKEN"
```

Tokens last 7 days. Send `Authorization: Bearer <token>` on protected routes.

## Centres and tests

Listing centres and tests is public. Creating them requires an admin token.

```bash
curl.exe http://localhost:3000/centres?page=1&limit=10&location=Bengaluru
curl.exe http://localhost:3000/centres/1
curl.exe http://localhost:3000/centres/1/tests
```

```bash
curl.exe -X POST http://localhost:3000/centres ^
  -H "Authorization: Bearer ADMIN_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"EVE HSR\",\"location\":\"Bengaluru\"}"
```

```bash
curl.exe -X POST http://localhost:3000/centres/1/tests ^
  -H "Authorization: Bearer ADMIN_TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"CBC\",\"price\":499,\"description\":\"Complete blood count\"}"
```

`price` is a whole number of INR. Strings and decimals are rejected.

## Bookings

A booking stores the patient, centre, test, appointment, amount, and status. Amount is copied from the test price at booking time. The client cannot set it.

Status values: `PENDING`, `CONFIRMED`, `FAILED`, `CANCELLED`.

```bash
curl.exe -X POST http://localhost:3000/bookings ^
  -H "Authorization: Bearer TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"centre_id\":1,\"test_id\":1,\"appointment_at\":\"2026-10-15T09:30:00.000Z\"}"
```

```bash
curl.exe http://localhost:3000/bookings -H "Authorization: Bearer TOKEN"
curl.exe http://localhost:3000/bookings/1 -H "Authorization: Bearer TOKEN"
curl.exe -X POST http://localhost:3000/bookings/1/cancel -H "Authorization: Bearer TOKEN"
```

Patients only see their own bookings. Admins can list all of them, and filter with `user_id` and `status`.

`appointment_at` must be a future UTC timestamp, within 180 days. A `PENDING` or `CONFIRMED` booking holds that centre + test + time. `FAILED` and `CANCELLED` release the slot.

Cancel is allowed for `PENDING` and `FAILED`. Calling cancel again on an already cancelled booking returns the same booking. Confirmed bookings cannot be cancelled here, because that would need a refund.

## Payments

`POST /payments` and `POST /payments/` both work. The trailing slash is stripped before routing.

This is a mock. Pass `outcome` as `SUCCESS` or `FAILED`. If you omit it, the mock succeeds. A real gateway would decide the outcome itself.

```bash
curl.exe -X POST http://localhost:3000/payments/ ^
  -H "Authorization: Bearer TOKEN" ^
  -H "Content-Type: application/json" ^
  -d "{\"booking_id\":1,\"outcome\":\"SUCCESS\"}"
```

Success moves the booking to `CONFIRMED`. Failure moves it to `FAILED`. A failed booking can be paid again. A confirmed booking cannot be paid again. You can only pay for your own booking.

## Webhook

`POST /payments/webhook/` accepts a status update from the simulated provider. Send the shared secret in `X-Webhook-Secret`. The value comes from `WEBHOOK_SECRET`.

```bash
curl.exe -X POST http://localhost:3000/payments/webhook/ ^
  -H "Content-Type: application/json" ^
  -H "X-Webhook-Secret: whsec_local_dev" ^
  -d "{\"event_id\":\"evt_demo_001\",\"booking_id\":1,\"status\":\"SUCCESS\",\"amount\":499}"
```

`event_id` is the idempotency key. The same event is stored once. A replay returns the original result with `replayed: true` and does not insert another payment or change the booking.

Invalid payloads are not stored, so a bad amount or an unknown booking id can be corrected and sent again. A later event with a new id cannot downgrade `CONFIRMED` to `FAILED`, and cannot confirm a `CANCELLED` booking. Those are acknowledged with HTTP 200 and `applied: false`, so a provider does not retry forever and corrupt state.

User payments and webhooks go through the same transaction. If the mock payment returns an `event_id` and the provider later posts that same id, the webhook is a no-op.

## Schema

| Table          | What it holds                                                      |
| -------------- | ------------------------------------------------------------------ |
| users          | name, unique email, password hash, role (`patient` or `admin`) |
| centres        | name and location, unique together                                 |
| tests          | belongs to one centre, unique name per centre, price in whole INR  |
| bookings       | user, centre, test, appointment, snapshotted amount, status        |
| payments       | one row per applied attempt, unique`event_id`                    |
| webhook_events | processed event id and the stored response, used for replays       |

Foreign keys are on. Status and price are checked in the database, not only in the route. Indexes cover centre tests, a user's bookings, the slot lookup, and payments by booking.

The file lives at `DATABASE_PATH` (default `./data/eve.sqlite`). Tests use an in-memory database and do not touch that file.

## Layout

```
index.js                          starts the server
src/app.js                        wires express
src/config/                       env
src/db/                           schema, connection, seed
src/middleware/                   auth, errors, rate limit, logs
src/utils/                        tokens, passwords, errors
src/validators/                   shared request helpers
src/auth/                         routes, controller, service
src/centres/                      routes, controller, service
src/bookings/                     routes, controller, service
src/payments/                     routes, controller, service
tests/                            node:test coverage
```

Each API folder has a router and a controller. The router only maps the path and middleware. The controller reads the request, checks it, calls the service, and sends the response.

## Assumptions

- SQLite is enough for the MVP. The schema stays boring on purpose so it can move to Postgres later.
- Prices are whole INR, not paise, so the API does not deal with floats.
- One active booking per centre, test, and appointment time. Slot capacity is 1.
- Browsing centres does not require an account. Writing the catalog does.
- The mock payment endpoint is synchronous. `outcome` exists so demos and tests are not random.
- Webhooks are authenticated with a shared secret, not a user JWT.
- Provider retries are safe because of `event_id`. Returning 200 for an ignored terminal conflict is deliberate.
- Signup and login are rate limited in memory (20 requests per minute per IP). The limit is off when `NODE_ENV=test`.
- Logs are one JSON line per request. Tokens are not logged.

## What I would improve with more time

- Postgres, with the same tables and a migration tool.
- HMAC signature on the raw webhook body, not only a static secret.
- Refunds, so a confirmed booking can be cancelled.
- Centre working hours and a slot capacity greater than 1.
- Expire a `PENDING` booking if it is not paid within a few minutes, so the slot is not held forever.
- Redis for the rate limit and for the public centre list.
- Refresh tokens, and an invite flow for admins instead of an email match.

## Docker

Optional.

```bash
docker compose up --build
```

The database file is stored in the `eve-data` volume. After the container is up, seed from a one-off command if you want the sample centres:

```bash
docker compose run --rm api node src/db/seed.js
```
