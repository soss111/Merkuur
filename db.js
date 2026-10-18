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

const SEED_SERVICES = [
  {
    id: "5eed5e4700000001",
    title: "Töötoad",
    summary: "Käed-külge töötoad puidu- ja metallitööst, elektroonikast, bioonikast ja inseneeriast noortele (7–18) ja täiskasvanutele – ka sünnipäevadele ja meeskonnaüritustele. Teemasid saab omavahel kokku panna.",
    href: "/tootoad",
    image: "https://static.wixstatic.com/media/a7f28e_49c2a64583b44ef894a64e2770e6c94b~mv2.jpg/v1/fill/w_980,h_655,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:01.000Z"
  },
  {
    id: "5eed5e4700000002",
    title: "Tehnoloogiatunnid",
    summary: "Mobiilsed huviringid, koolitused ja gümnaasiumi inseneeria valikkursused – seadmed otse klassiruumis.",
    href: "/huviringid",
    image: "https://static.wixstatic.com/media/a7f28e_d96711c8a73f4287a56272f4e6fe22a1~mv2.jpg/v1/fill/w_980,h_732,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:02.000Z"
  },
  {
    id: "5eed5e4700000003",
    title: "Õpilahenduste arendus",
    summary: "Digiõpik «Arvjuhitavad seadmed», tunnikavad ja õppematerjalid, mis aitavad tehnoloogiat koolitundi tuua.",
    href: "/õpik-arvjuhitavad-seadmed-cnc",
    image: "https://static.wixstatic.com/media/a7f28e_7df29537faf14ca3bf3bca541e40da4b~mv2_d_6000_4000_s_4_2.jpg/v1/fill/w_980,h_653,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:03.000Z"
  },
  {
    id: "5eed5e4700000004",
    title: "Makerspace ja tehnoloogiaklass",
    summary: "Rajame koolidele ja noortekeskustele tehnoloogia õppeklassi – seadmed, sisu ja koolitus ühes paketis.",
    href: "/futureclassroomlab",
    image: "https://static.wixstatic.com/media/a7f28e_c34f073e4336408ca677769001eef86c~mv2_d_4943_3296_s_4_2.jpg/v1/fill/w_980,h_653,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:04.000Z"
  },
  {
    id: "5eed5e4700000005",
    title: "Mobiilsed töökojad",
    summary: "Iseehitatud liikuv õppeklass: metalli- ja puidutöökoda ratastel. Tuleme kooliõuele, külla või üritusele – seadmed ja tööriistad kaasas.",
    href: "/mobileworkshops",
    image: "https://static.wixstatic.com/media/a7f28e_a8fffa03b3bd41cd9d7cf3f80f7251c6~mv2.jpg/v1/fill/w_980,h_653,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:05.000Z"
  },
  {
    id: "5eed5e4700000006",
    title: "Karjääriteemad",
    summary: "Karjääriinfo ja -nõustamine (individuaalne ja grupinõustamine) ning karjääriteadlikkust tõstvad tegevused. Neid juhib Liis, kogenud karjäärinõustaja.",
    href: "/bettercareer",
    image: "https://static.wixstatic.com/media/a7f28e_ffc213a6c24c4383912ea94d55ce198d~mv2.jpg/v1/fill/w_980,h_653,al_c,q_85/a.jpg",
    createdAt: "2016-01-01T00:00:06.000Z"
  }
];

const SEED_POSTS = [
  {
    id: "5eed905700000001",
    slug: "tule-töötuppa-või-muidu-tuleb-töötuba-sinu-juurde-1",
    title: "Tule töötuppa! Või muidu tuleb töötuba sinu juurde!",
    excerpt: "",
    body: "",
    url: "/post/tule-töötuppa-või-muidu-tuleb-töötuba-sinu-juurde-1",
    image: "https://static.wixstatic.com/media/a7f28e_68073d44abf044bf913b61f880205682~mv2.jpg/v1/fill/w_700,h_460,fp_0.50_0.50,q_90/a.jpg",
    createdAt: "2025-01-20T12:00:00.000Z"
  },
  {
    id: "5eed905700000002",
    slug: "ida-viru-projektis-osales-kokku-354-osalejat",
    title: "Ida-Viru projektis osales kokku 354 osalejat",
    excerpt: "",
    body: "",
    url: "/post/ida-viru-projektis-osales-kokku-354-osalejat",
    image: "https://static.wixstatic.com/media/a7f28e_ffc213a6c24c4383912ea94d55ce198d~mv2.jpg/v1/fill/w_700,h_460,fp_0.50_0.50,q_90/a.jpg",
    createdAt: "2024-12-01T12:00:00.000Z"
  },
  {
    id: "5eed905700000003",
    slug: "tule-töötuppa-või-muidu-tuleb-töötuba-sinu-juurde",
    title: "Tule töötuppa! Või muidu tuleb töötuba sinu juurde!",
    excerpt: "",
    body: "",
    url: "/post/tule-töötuppa-või-muidu-tuleb-töötuba-sinu-juurde",
    image: "https://static.wixstatic.com/media/a7f28e_9792dc3de2404bb69f8caebfb630e963~mv2.jpg/v1/fill/w_700,h_460,fp_0.50_0.50,q_90/a.jpg",
    createdAt: "2024-07-10T12:00:00.000Z"
  }
];

const SEED_PHOTOS = [
  {
    id: "5eedf07000000001",
    image: "https://static.wixstatic.com/media/a7f28e_1804c8ea80de4870aaba580d4528a812~mv2.jpg/v1/fill/w_700,h_700,al_c,q_85/a.jpg",
    caption: "Neeme küla",
    createdAt: "2024-04-01T12:00:00.000Z"
  },
  {
    id: "5eedf07000000002",
    image: "https://static.wixstatic.com/media/a7f28e_a2de679276f844059b3e5e041ec508c1~mv2.jpg/v1/fill/w_700,h_700,al_c,q_85/a.jpg",
    caption: "Metalli töötuba, Tartu",
    createdAt: "2024-03-01T12:00:00.000Z"
  },
  {
    id: "5eedf07000000003",
    image: "https://static.wixstatic.com/media/a7f28e_67ca9d735af24001a6ba630a22aa21d7~mv2.jpg/v1/fill/w_700,h_700,al_c,q_85/a.jpg",
    caption: "Mart Müllerbeck",
    createdAt: "2024-02-01T12:00:00.000Z"
  },
  {
    id: "5eedf07000000004",
    image: "https://static.wixstatic.com/media/a7f28e_ffc213a6c24c4383912ea94d55ce198d~mv2.jpg/v1/fill/w_700,h_700,al_c,q_85/a.jpg",
    caption: "Ida-Viru projekt",
    createdAt: "2024-01-01T12:00:00.000Z"
  }
];

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
    async seedCatalogOnce() {
      if ((await this.countOf("services")) === 0) {
        for (const item of SEED_SERVICES) await this.insertService(item);
      }
      if ((await this.countOf("posts")) === 0) {
        for (const item of SEED_POSTS) await this.insertPost(item);
      }
      if ((await this.countOf("photos")) === 0) {
        for (const item of SEED_PHOTOS) await this.insertPhoto(item);
      }
      if (!(await driver.setting("stats", ""))) await this.saveStats(DEFAULT_STATS);
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
