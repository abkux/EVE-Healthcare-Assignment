import "dotenv/config";
import { getConfig } from "../config/index.js";
import { log } from "../utils/logger.js";
import { hashPassword } from "../utils/passwords.js";
import { openDatabase } from "./index.js";

const sampleCentres = [
  {
    name: "EVE Diagnostics Koramangala",
    location: "Bengaluru",
    tests: [
      { name: "Complete Blood Count", price: 499, description: "CBC with differential" },
      { name: "Lipid Profile", price: 899, description: "Cholesterol and triglycerides" },
      { name: "Thyroid Profile", price: 749, description: "T3, T4 and TSH" },
    ],
  },
  {
    name: "EVE Diagnostics Andheri",
    location: "Mumbai",
    tests: [
      { name: "HbA1c", price: 599, description: "Average blood sugar" },
      { name: "Vitamin D", price: 1299, description: "25-OH Vitamin D" },
      { name: "Liver Function Test", price: 799, description: "LFT panel" },
    ],
  },
];

export function seedDatabase(db) {
  const config = getConfig();
  const now = new Date().toISOString();
  const report = { admin: null, centres: [] };

  if (config.adminEmail && config.adminPassword) {
    if (config.adminPassword.length < 8) {
      report.admin = "skipped, ADMIN_PASSWORD must be at least 8 characters";
    } else {
      const existing = db.prepare("SELECT id, role FROM users WHERE email = ?").get(config.adminEmail);
      if (existing) {
        report.admin = `already present (id ${existing.id})`;
      } else {
        const info = db.prepare(`
          INSERT INTO users (name, email, password_hash, role, created_at)
          VALUES (?, ?, ?, 'admin', ?)
        `).run(config.adminName, config.adminEmail, hashPassword(config.adminPassword), now);
        report.admin = `created (id ${Number(info.lastInsertRowid)})`;
      }
    }
  } else {
    report.admin = "skipped, set ADMIN_EMAIL and ADMIN_PASSWORD";
  }

  const findCentre = db.prepare("SELECT id FROM centres WHERE name = ? AND location = ?");
  const insertCentre = db.prepare("INSERT INTO centres (name, location, created_at) VALUES (?, ?, ?)");
  const findTest = db.prepare("SELECT id FROM tests WHERE centre_id = ? AND name = ?");
  const insertTest = db.prepare(`
    INSERT INTO tests (centre_id, name, price, description, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const centre of sampleCentres) {
    let row = findCentre.get(centre.name, centre.location);
    let centreId;
    let created = false;
    if (row) {
      centreId = row.id;
    } else {
      const info = insertCentre.run(centre.name, centre.location, now);
      centreId = Number(info.lastInsertRowid);
      created = true;
    }

    let testsAdded = 0;
    for (const test of centre.tests) {
      if (findTest.get(centreId, test.name)) continue;
      insertTest.run(centreId, test.name, test.price, test.description, now);
      testsAdded += 1;
    }
    report.centres.push({ id: centreId, name: centre.name, created, testsAdded });
  }

  return report;
}

const invokedDirectly = process.argv[1] && process.argv[1].endsWith("seed.js");
if (invokedDirectly) {
  const config = getConfig();
  const db = openDatabase(config.databasePath);
  const report = seedDatabase(db);
  log.info("seed finished", report);
  db.close();
}
