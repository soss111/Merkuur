"use strict";

const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");

const TABLES = [
  `CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    quote TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT '',
    org TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    image TEXT NOT NULL,
    caption TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    href TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`
];

function isPostgres(url) {
  return /^postgres(ql)?:\/\//i.test(String(url || "").trim());
}

function sqliteFile(dataDir, databaseUrl) {
  const url = String(databaseUrl || "").trim();
  if (!url) return path.join(dataDir, "content.sqlite");
  if (path.isAbsolute(url) && /\.(sqlite|sqlite3|db)$/i.test(url)) return url;
  if (url.startsWith("file:")) return fileURLToPath(url);
  const match = /^sqlite:(.*)$/i.exec(url);
  if (!match) {
    throw Object.assign(new Error("DATABASE_URL peab olema postgres://, sqlite: või file: aadress."), { status: 500 });
  }
  let spec = match[1];
  if (spec.startsWith("///")) spec = spec.slice(2);
  else if (spec.startsWith("//")) spec = spec.slice(2);
  if (!path.isAbsolute(spec)) spec = path.resolve(dataDir, spec);
  return spec;
}

function driverFor(databaseUrl, dataDir) {
  const url = String(databaseUrl || "").trim();
  if (isPostgres(url)) {
    let name = "database";
    try { name = new URL(url).pathname.replace(/^\//, "") || name; } catch (err) { name = "database"; }
    return { driver: "postgres", label: "postgres " + name };
  }
  const file = sqliteFile(dataDir || ".", url);
  return { driver: "sqlite", file: file, label: "sqlite " + file };
}

function mapFeedback(row) {
  return { id: row.id, quote: row.quote, name: row.name, role: row.role, org: row.org, createdAt: row.created_at };
}

function mapPost(row) {
  const url = row.url || (row.body ? "/post/" + row.slug : "");
  return { id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt, body: row.body, url: url, image: row.image, createdAt: row.created_at };
}

function mapPhoto(row) {
  return { id: row.id, image: row.image, caption: row.caption, createdAt: row.created_at };
}

function mapService(row) {
  return { id: row.id, title: row.title, summary: row.summary, href: row.href, image: row.image, createdAt: row.created_at };
}

const DEFAULT_STATS = {
  since: "2016",
  workshops: "3500+",
  youth: "30 000",
  mobiles: "4",
  solutions: "100+",
  asOf: "detsember 2023"
};

function statsFrom(raw) {
  const stats = Object.assign({}, DEFAULT_STATS);
  if (!raw) return stats;
  Object.keys(DEFAULT_STATS).forEach((key) => {
    if (typeof raw[key] === "string" && raw[key].trim()) stats[key] = raw[key].trim();
  });
  return stats;
}

function api(driver) {
  return {
    label: driver.label,
    async importJsonOnce(contentFile) {
      if (await driver.setting("imported_json", "") === "1") return;
      let raw = { address: "", testimonials: [], news: [], gallery: [] };
      try { raw = Object.assign(raw, JSON.parse(fs.readFileSync(contentFile, "utf8"))); } catch (err) { raw = { address: "", testimonials: [], news: [], gallery: [] }; }
      for (const item of raw.testimonials || []) {
        if (!item || !item.id) continue;
        await driver.run(
          "INSERT INTO feedback (id, quote, name, role, org, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
          [item.id, item.quote || "", item.name || "", item.role || "", item.org || "", item.createdAt || new Date().toISOString()]
        );
      }
      for (const item of raw.news || []) {
        if (!item || !item.id) continue;
        await driver.run(
          "INSERT INTO posts (id, slug, title, excerpt, body, url, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
          [item.id, item.slug || item.id, item.title || "", item.excerpt || "", item.body || "", item.url || "", item.image || "", item.createdAt || new Date().toISOString()]
        );
      }
      for (const item of raw.gallery || []) {
        if (!item || !item.id) continue;
        await driver.run(
          "INSERT INTO photos (id, image, caption, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
          [item.id, item.image || "", item.caption || "", item.createdAt || new Date().toISOString()]
        );
      }
      if (typeof raw.address === "string" && raw.address && !(await driver.setting("address", ""))) await driver.setSetting("address", raw.address);
      await driver.setSetting("imported_json", "1");
    },
    async readContent() {
      let stored = null;
      try { stored = JSON.parse(await driver.setting("stats", "")); } catch (err) { stored = null; }
      return {
        address: await driver.setting("address", ""),
        stats: statsFrom(stored),
        testimonials: (await driver.all("SELECT * FROM feedback ORDER BY created_at DESC")).map(mapFeedback),
        news: (await driver.all("SELECT * FROM posts ORDER BY created_at DESC")).map(mapPost),
        gallery: (await driver.all("SELECT * FROM photos ORDER BY created_at DESC")).map(mapPhoto),
        services: (await driver.all("SELECT * FROM services ORDER BY created_at ASC")).map(mapService)
      };
    },
    async countOf(table) {
      const allowed = { feedback: 1, posts: 1, photos: 1, services: 1 };
      if (!allowed[table]) throw new Error("Tundmatu tabel.");
      const row = await driver.get("SELECT COUNT(*) AS n FROM " + table);
      return Number(row.n);
    },
    async insertFeedback(item) {
      await driver.run(
        "INSERT INTO feedback (id, quote, name, role, org, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [item.id, item.quote, item.name, item.role, item.org, item.createdAt]
      );
    },
    async insertPost(item) {
      await driver.run(
        "INSERT INTO posts (id, slug, title, excerpt, body, url, image, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.slug, item.title, item.excerpt, item.body, item.url, item.image, item.createdAt]
      );
    },
    async insertPhoto(item) {
      await driver.run(
        "INSERT INTO photos (id, image, caption, created_at) VALUES (?, ?, ?, ?)",
        [item.id, item.image, item.caption, item.createdAt]
      );
    },
    async insertService(item) {
      await driver.run(
        "INSERT INTO services (id, title, summary, href, image, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        [item.id, item.title, item.summary, item.href, item.image, item.createdAt]
      );
    },
    async deleteItem(kind, id) {
      const table = { testimonials: "feedback", news: "posts", gallery: "photos", services: "services" }[kind];
      if (!table) return false;
      const changes = await driver.run("DELETE FROM " + table + " WHERE id = ?", [id]);
      return changes > 0;
    },
    async saveAddress(address) {
      await driver.setSetting("address", address);
    },
    async saveStats(stats) {
      await driver.setSetting("stats", JSON.stringify(statsFrom(stats)));
    },
    async slugTaken(slug) {
      return Boolean(await driver.get("SELECT 1 AS ok FROM posts WHERE slug = ?", [slug]));
    },
    async postBySlug(slug) {
      const row = await driver.get("SELECT * FROM posts WHERE slug = ?", [slug]);
      return row ? mapPost(row) : null;
    },
    async saveMedia(name, mime, bytes) {
      await driver.run(
        "INSERT INTO media (name, mime, bytes) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET mime = excluded.mime, bytes = excluded.bytes",
        [name, mime, bytes]
      );
    },
    async readMedia(name) {
      const row = await driver.get("SELECT mime, bytes FROM media WHERE name = ?", [name]);
      if (!row) return null;
      return { mime: row.mime, bytes: Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes) };
    }
  };
}

function sqliteDriver(file) {
  const { DatabaseSync } = require("node:sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  TABLES.forEach((sql) => db.exec(sql));
  db.exec("CREATE TABLE IF NOT EXISTS media (name TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL)");
  return api({
    label: "sqlite " + file,
    all(sql, params) { return db.prepare(sql).all(...(params || [])); },
    get(sql, params) { return db.prepare(sql).get(...(params || [])) || null; },
    run(sql, params) { return db.prepare(sql).run(...(params || [])).changes; },
    setting(key, fallback) {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
      return row ? row.value : fallback;
    },
    setSetting(key, value) {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
    }
  });
}

async function postgresDriver(url) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url, max: 5 });
  const query = async (sql, params) => {
    let i = 0;
    const text = sql.replace(/\?/g, () => "$" + (++i));
    return pool.query(text, params || []);
  };
  for (const sql of TABLES) await query(sql);
  await query("CREATE TABLE IF NOT EXISTS media (name TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BYTEA NOT NULL)");
  const info = driverFor(url, ".");
  return api({
    label: info.label,
    async all(sql, params) { return (await query(sql, params)).rows; },
    async get(sql, params) { return (await query(sql, params)).rows[0] || null; },
    async run(sql, params) { return (await query(sql, params)).rowCount; },
    async setting(key, fallback) {
      const row = (await query("SELECT value FROM settings WHERE key = ?", [key])).rows[0];
      return row ? row.value : fallback;
    },
    async setSetting(key, value) {
      await query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
    }
  });
}

async function openDatabase(dataDir, databaseUrl) {
  const url = databaseUrl == null ? process.env.DATABASE_URL : databaseUrl;
  if (isPostgres(url)) return postgresDriver(String(url).trim());
  return sqliteDriver(sqliteFile(dataDir, url));
}

module.exports = { openDatabase, driverFor, isPostgres, sqliteFile, DEFAULT_STATS };
