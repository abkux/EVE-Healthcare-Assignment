export function getConfig() {
  const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
  const bcryptRounds = Number.isInteger(rounds) && rounds >= 4 && rounds <= 15 ? rounds : 10;

  return {
    port: Number(process.env.PORT || 3000),
    jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
    webhookSecret: process.env.WEBHOOK_SECRET || "dev-webhook-secret",
    databasePath: process.env.DATABASE_PATH || "./data/eve.sqlite",
    adminEmail: String(process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    adminPassword: process.env.ADMIN_PASSWORD || "",
    adminName: process.env.ADMIN_NAME || "EVE Admin",
    bcryptRounds,
  };
}

// added fallback value incase of missing env variable for admin email, password.
